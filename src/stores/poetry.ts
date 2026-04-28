/**
 * poetry.ts — Pinia store
 *
 * Holds the raw poem text, detected document-level language, and per-word
 * language overrides set by the user.
 *
 * Language detection runs automatically (debounced) whenever rawText changes.
 * The user can always override:
 *   - documentLanguage: the fallback applied to every word without an override
 *   - wordLanguages: per-word map (keyed by word token id once model exists,
 *     keyed by "lineIdx:wordIdx" as a stable interim key)
 */

import { defineStore } from 'pinia';
import { ref, watch, computed } from 'vue';
import {
  detectDocumentLanguage,
  detectLanguage,
} from 'src/services/languageDetection/LanguageDetector';
import { DEFAULT_LANGUAGE, type Language } from 'src/model/Language';
import { parseDocument } from 'src/model/DocumentParser';
import type { IPoetryDocument, IWordToken } from 'src/model/Token';
import { getPhoneme } from 'src/services/poetryEngines/ua/Phonetizer';
import { Sylabizer, type Syllable } from 'src/services/poetryEngines/ua/Sylabizer';
import { getWordScriptInfo } from 'src/services/languageDetection/wordScript';
import { countVowels } from 'src/services/poetryEngines/shared/wordVowels';
import { useStressTrie } from 'src/composables/useStressTrie';
import { useAppStore } from 'src/stores/app';
import { stressSyncLog, stressAsyncLog } from 'src/services/logging';

const STORAGE_KEY_TEXT = 'verseSense_poemText';
const STORAGE_KEY_DOC_LANG = 'verseSense_docLanguage';
const STORAGE_KEY_ANNOTATIONS = 'verseSense_annotations';
const DETECTION_DEBOUNCE_MS = 600;

/**
 * Bump this when the annotation format changes in a breaking way.
 * On mismatch the saved blob is discarded silently.
 */
const ANNOTATIONS_VERSION = 1;

/** Serialised form of per-word editor state (stored in localStorage). */
interface WordAnnotation {
  /** 0-based stressed syllable index, or null = not set */
  stress: number | null;
  /** Explicit language override chosen by user (absent = auto-detected) */
  lang?: Language;
  /** Whether the user confirmed the language for this word */
  confirmed: boolean;
  /** Source of auto-resolved stress pending user confirmation (absent = not pending) */
  stressPendingSource?: 'ml' | 'heteronym' | 'variative';
}

/** Root blob stored under STORAGE_KEY_ANNOTATIONS */
interface AnnotationsBlob {
  version: number;
  /**
   * Keys are "L{lineIdx}:W{wordIdx}" where wordIdx counts only WORD tokens
   * (not GAP / TAB / HYPHEN). Stable across text-unchanged reloads.
   */
  words: Record<string, WordAnnotation>;
}

/** Strip leading spaces (not tabs) from every line of raw poem text */
function normalizeLeadingSpaces(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/^ +/, ''))
    .join('\n');
}

export const usePoetryStore = defineStore('poetry', () => {
  // ── Stress trie resolver ───────────────────────────────────────────────────
  const { resolver: stressResolver } = useStressTrie();
  const appStore = useAppStore();

  // ── State ──────────────────────────────────────────────────────────────────

  /** Raw text as typed by the user */
  const rawText = ref<string>(normalizeLeadingSpaces(localStorage.getItem(STORAGE_KEY_TEXT) ?? ''));

  /**
   * 0-based index of the line currently active in the editor (cursor position).
   * Written by PoetryEditor, read by PhoneticPanel for scroll-sync.
   */
  const activeLineIndex = ref<number | null>(null);

  /** Parsed document — re-derived whenever rawText or documentLanguage changes */
  const document = ref<IPoetryDocument>(parseDocument(rawText.value));

  /** Phonetized syllables cache: token id → Syllable[] */
  const syllableCache = ref<Map<string, Syllable[]>>(new Map());

  /**
   * Document-level language — auto-detected from rawText, overridable by user.
   * Applied to every word that doesn't have a per-word override.
   */
  const documentLanguage = ref<Language>(
    (localStorage.getItem(STORAGE_KEY_DOC_LANG) as Language | null) ??
      detectDocumentLanguage(rawText.value) ??
      DEFAULT_LANGUAGE,
  );

  /**
   * Whether the document language was manually set by the user.
   * When true, auto-detection will NOT override it on text changes.
   */
  const documentLanguageManual = ref<boolean>(localStorage.getItem(STORAGE_KEY_DOC_LANG) !== null);

  /**
   * Per-word language overrides.
   * Key: stable word identifier — "line:word" index string for now,
   *      will become UUID once the full document model (Phase 2) is in.
   * Value: the Language the user explicitly chose for that word.
   */
  const wordLanguages = ref<Map<string, Language>>(new Map());

  /**
   * Set of word token IDs whose language has been explicitly confirmed by
   * the user (either by picking from dropdown or clicking "Confirm").
   * Words with lockedLanguage (script-determined) are implicitly always
   * confirmed and do NOT need to be in this set.
   * A line is only counted as 'all' (green) when every word is locked OR confirmed.
   */
  const confirmedWords = ref<Set<string>>(new Set());

  /**
   * Map from word token ID to the source of auto-resolved stress.
   *   'ml'        → ML prediction (displayed in blue)
   *   'heteronym' → Trie heteronym — multiple valid forms (displayed in yellow)
   * Absent from map → stress was confirmed (by user or from DB).
   */
  const pendingStressIds = ref<Map<string, 'ml' | 'heteronym' | 'variative'>>(new Map());
  /** Alternative stress positions for heteronym/variative words, used by tooltips. Not persisted. */
  const pendingStressAlts = ref<Map<string, number[]>>(new Map());

  /**
   * Confidence of the last auto-detection (0.0–1.0).
   * Exposed so the UI can show a low-confidence warning badge.
   */
  const detectionConfidence = ref<number>(1.0);

  // ── Internal debounce timers ───────────────────────────────────────────────

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let stressDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  const STRESS_DEBOUNCE_MS = 600;

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Immutably update fields on a single word token, producing new ILine and
   * IPoetryDocument references so Vue's prop-change detection fires correctly.
   */
  function replaceTokenField(
    doc: IPoetryDocument,
    wordId: string,
    fields: Partial<IWordToken>,
  ): IPoetryDocument {
    const oldTok = doc.tokenIndex.get(wordId);
    if (!oldTok || oldTok.kind !== 'WORD') return doc;
    const newTok: IWordToken = { ...oldTok, ...fields };
    const newTokenIndex = new Map(doc.tokenIndex);
    newTokenIndex.set(wordId, newTok);
    const newLines = doc.lines.map((line) => {
      const idx = line.tokens.findIndex((t) => t.id === wordId);
      if (idx === -1) return line;
      const newTokens = line.tokens.slice();
      newTokens[idx] = newTok;
      return { ...line, tokens: newTokens };
    });
    return { lines: newLines, tokenIndex: newTokenIndex };
  }

  // ── Annotation persistence ─────────────────────────────────────────────────

  let annotationSaveTimer: ReturnType<typeof setTimeout> | null = null;

  /** Persist current word annotations (debounced to avoid thrashing). */
  function scheduleSaveAnnotations() {
    if (annotationSaveTimer) clearTimeout(annotationSaveTimer);
    annotationSaveTimer = setTimeout(() => saveAnnotations(), 400);
  }

  function saveAnnotations() {
    const words: Record<string, WordAnnotation> = {};
    document.value.lines.forEach((line, lineIdx) => {
      let wordIdx = 0;
      for (const tok of line.tokens) {
        if (tok.kind !== 'WORD') continue;
        const key = `L${lineIdx}:W${wordIdx}`;
        const { lockedLanguage } = getWordScriptInfo(tok.text);
        const langOverride = wordLanguages.value.get(tok.id);
        const ann: WordAnnotation = {
          stress: tok.stressIndex,
          confirmed: lockedLanguage !== null || confirmedWords.value.has(tok.id),
        };
        if (langOverride !== undefined) ann.lang = langOverride;
        const pendingSrc = pendingStressIds.value.get(tok.id);
        if (pendingSrc) ann.stressPendingSource = pendingSrc;
        // Only persist if there is something non-trivial to store
        if (
          ann.stress !== null ||
          ann.lang !== undefined ||
          ann.confirmed ||
          ann.stressPendingSource !== undefined
        ) {
          words[key] = ann;
        }
        wordIdx++;
      }
    });
    const blob: AnnotationsBlob = { version: ANNOTATIONS_VERSION, words };
    try {
      localStorage.setItem(STORAGE_KEY_ANNOTATIONS, JSON.stringify(blob));
    } catch {
      /* quota exceeded — ignore */
    }
  }

  /** Load saved annotations and return them, or null if missing/version mismatch. */
  function loadAnnotations(): AnnotationsBlob['words'] | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_ANNOTATIONS);
      if (!raw) return null;
      const blob = JSON.parse(raw) as AnnotationsBlob;
      if (blob.version !== ANNOTATIONS_VERSION) {
        localStorage.removeItem(STORAGE_KEY_ANNOTATIONS);
        return null;
      }
      return blob.words;
    } catch {
      return null;
    }
  }

  /**
   * Replay saved annotations onto the current document.
   * Called once after the initial parse. Mutates `document.value` directly
   * (before reactivity kicks in) and populates wordLanguages / confirmedWords.
   */
  function applyAnnotations(saved: AnnotationsBlob['words']) {
    const newTokenIndex = new Map(document.value.tokenIndex);
    const newLangMap = new Map(wordLanguages.value);
    const newConfirmed = new Set(confirmedWords.value);
    const newPending = new Map(pendingStressIds.value);
    let anyChange = false;

    const newLines = document.value.lines.map((line, lineIdx) => {
      let wordIdx = 0;
      let lineChanged = false;
      const newTokens = line.tokens.map((tok) => {
        if (tok.kind !== 'WORD') return tok;
        const key = `L${lineIdx}:W${wordIdx++}`;
        const ann = saved[key];
        if (!ann) return tok;

        const newTok: IWordToken = {
          ...tok,
          stressIndex: ann.stress ?? tok.stressIndex,
          language: ann.lang ?? tok.language,
        };
        if (ann.lang) newLangMap.set(tok.id, ann.lang);
        if (ann.confirmed) newConfirmed.add(tok.id);
        if (ann.stressPendingSource) newPending.set(tok.id, ann.stressPendingSource);
        newTokenIndex.set(tok.id, newTok);
        lineChanged = true;
        anyChange = true;
        return newTok;
      });
      return lineChanged ? { ...line, tokens: newTokens } : line;
    });

    if (anyChange) {
      document.value = { lines: newLines, tokenIndex: newTokenIndex };
      wordLanguages.value = newLangMap;
      confirmedWords.value = newConfirmed;
      pendingStressIds.value = newPending;
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  /** Update raw text, persist, re-parse document */
  function setRawText(text: string) {
    // Strip leading spaces (but not tabs) from every line — leading spaces were
    // never intentional (artifact of old broken indentWithTab that inserted spaces).
    const normalized = normalizeLeadingSpaces(text);
    rawText.value = normalized;
    localStorage.setItem(STORAGE_KEY_TEXT, normalized);
    rebuildDocument(normalized);
  }

  /**
   * Manually override the document-level language.
   * Marks it as manual so auto-detection stops overriding it.
   */
  function setDocumentLanguage(lang: Language) {
    documentLanguage.value = lang;
    documentLanguageManual.value = true;
    localStorage.setItem(STORAGE_KEY_DOC_LANG, lang);
  }

  /**
   * Reset document language back to auto-detection.
   * Triggers an immediate re-detection from current rawText.
   */
  function resetDocumentLanguageToAuto() {
    documentLanguageManual.value = false;
    localStorage.removeItem(STORAGE_KEY_DOC_LANG);
    runDetection(rawText.value);
  }

  /**
   * Set a per-word language override.
   * @param wordId - token id from IWordToken
   * @param lang   - Language chosen by the user
   */
  function setWordLanguage(wordId: string, lang: Language) {
    wordLanguages.value = new Map(wordLanguages.value).set(wordId, lang);
    // Picking a language explicitly = user confirmation
    confirmedWords.value = new Set(confirmedWords.value).add(wordId);
    document.value = replaceTokenField(document.value, wordId, { language: lang });
    const sc = new Map(syllableCache.value);
    sc.delete(wordId);
    syllableCache.value = sc;
  }

  /**
   * Remove a per-word language override.
   * @param wordId - token id
   */
  function clearWordLanguage(wordId: string) {
    const next = new Map(wordLanguages.value);
    next.delete(wordId);
    wordLanguages.value = next;
    document.value = replaceTokenField(document.value, wordId, {
      language: documentLanguage.value,
    });
    const sc = new Map(syllableCache.value);
    sc.delete(wordId);
    syllableCache.value = sc;
  }

  /**
   * Set stress syllable index for a word.
   * @param wordId      - token id
   * @param syllableIdx - 0-based syllable index, or null to clear
   */
  function setWordStress(wordId: string, syllableIdx: number | null) {
    const tok = document.value.tokenIndex.get(wordId);
    if (!tok || tok.kind !== 'WORD') return;
    document.value = replaceTokenField(document.value, wordId, { stressIndex: syllableIdx });
    const sc = new Map(syllableCache.value);
    sc.delete(wordId);
    syllableCache.value = sc;
    // Manual user pick clears the pending flag for this word
    if (pendingStressIds.value.has(wordId)) {
      const next = new Map(pendingStressIds.value);
      next.delete(wordId);
      pendingStressIds.value = next;
    }
    // When user sets a stress, try to auto-confirm the line
    const line = document.value.lines.find((l) => l.tokens.some((t) => t.id === wordId));
    if (line) tryAutoConfirmLine(line.id);
  }

  /**
   * Resolve the effective language for a word.
   */
  function getWordLanguage(wordId: string): Language {
    return wordLanguages.value.get(wordId) ?? documentLanguage.value;
  }

  function hasWordOverride(wordId: string): boolean {
    return wordLanguages.value.has(wordId);
  }

  /**
   * Mark every word on a line as confirmed if it has no genuine language
   * ambiguity (locked by script or only one script-compatible option).
   * Called automatically after detection and after the user sets a stress.
   */
  function tryAutoConfirmLine(lineId: string) {
    const line = document.value.lines.find((l) => l.id === lineId);
    if (!line) return;
    const next = new Set(confirmedWords.value);
    let changed = false;
    for (const tok of line.tokens) {
      if (tok.kind !== 'WORD') continue;
      if (next.has(tok.id)) continue;
      const { lockedLanguage, allowedLanguages } = getWordScriptInfo(tok.text);
      // Auto-confirm if locked OR only one possible language (no real choice)
      if (lockedLanguage !== null || allowedLanguages.length <= 1) {
        next.add(tok.id);
        changed = true;
      }
    }
    if (changed) confirmedWords.value = next;
  }

  /**
   * Mark every non-locked word on a line as language-confirmed.
   * Called when user clicks the \"Confirm\" button on a LinePanel.
   */
  function confirmLine(lineId: string) {
    const line = document.value.lines.find((l) => l.id === lineId);
    if (!line) return;
    const next = new Set(confirmedWords.value);
    const nextPending = new Map(pendingStressIds.value);
    for (const tok of line.tokens) {
      if (tok.kind !== 'WORD') continue;
      const { lockedLanguage } = getWordScriptInfo(tok.text);
      if (lockedLanguage === null) next.add(tok.id);
      nextPending.delete(tok.id);
    }
    confirmedWords.value = next;
    pendingStressIds.value = nextPending;
  }

  /** Remove all non-locked words on a line from confirmedWords (toggle back). */
  function unconfirmLine(lineId: string) {
    const line = document.value.lines.find((l) => l.id === lineId);
    if (!line) return;
    const next = new Set(confirmedWords.value);
    for (const tok of line.tokens) {
      if (tok.kind !== 'WORD') continue;
      const { lockedLanguage } = getWordScriptInfo(tok.text);
      if (lockedLanguage === null) next.delete(tok.id);
    }
    confirmedWords.value = next;
  }

  /**
   * Whether every word on a line is fully valid:
   *   1. Has a stress set (stressIndex !== null)
   *   2. Has its language confirmed (locked by script, or in confirmedWords)
   * Returns false if the line has no words.
   */
  function isLineConfirmed(lineId: string): boolean {
    const line = document.value.lines.find((l) => l.id === lineId);
    if (!line) return false;
    const words = line.tokens.filter((t): t is IWordToken => t.kind === 'WORD');
    if (words.length === 0) return false;
    for (const tok of words) {
      const vc = countVowels(tok.text, tok.language);
      // Zero-vowel words (e.g. "з", "в") need no stress and are always satisfied
      if (vc === 0) continue;
      // Must have stress set
      if (tok.stressIndex === null) return false;
      // Must have language confirmed
      const { lockedLanguage } = getWordScriptInfo(tok.text);
      if (lockedLanguage === null && !confirmedWords.value.has(tok.id)) return false;
    }
    return true;
  }

  /**
   * Get phonetized syllables for a word token (cached).
   * Currently only UA is implemented; other languages fall back to letter-split.
   */
  function getSyllables(wordId: string): Syllable[] {
    if (syllableCache.value.has(wordId)) return syllableCache.value.get(wordId)!;
    const tok = document.value.tokenIndex.get(wordId);
    if (!tok || tok.kind !== 'WORD') return [];
    const wt = tok as IWordToken;
    let syllables: Syllable[] = [];
    try {
      const phonemes = getPhoneme(wt.text.toLowerCase());
      syllables = Sylabizer.createSyllables(phonemes, wt.stressIndex ?? 0);
    } catch {
      // Non-UA word or parse error — return empty
    }
    const next = new Map(syllableCache.value);
    next.set(wordId, syllables);
    syllableCache.value = next;
    return syllables;
  }

  /** All word tokens across the whole document (flat) */
  const allWordTokens = computed<IWordToken[]>(() => {
    const words: IWordToken[] = [];
    for (const line of document.value.lines) {
      for (const tok of line.tokens) {
        if (tok.kind === 'WORD') words.push(tok as IWordToken);
      }
    }
    return words;
  });

  // ── Internal ───────────────────────────────────────────────────────────────

  function rebuildDocument(text: string) {
    syllableCache.value = new Map();

    // ── Snapshot per-word annotations keyed by positional "L{li}:W{wi}" ─────
    // Using positional keys (not token IDs) means we survive re-parses that
    // generate new IDs.  We also snapshot the word *text* so we can detect
    // which words actually changed vs. which lines just shifted (e.g. an empty
    // line was inserted above).
    interface WordSnapshot {
      text: string;
      stressIndex: number | null;
      lang: Language | undefined;
      confirmed: boolean;
      pendingSource?: 'ml' | 'heteronym' | 'variative';
    }
    const prevByPos = new Map<string, WordSnapshot>(); // "L{li}:W{wi}" → snap
    const prevByText = new Map<string, WordSnapshot>(); // word text → snap (first occurrence)

    document.value.lines.forEach((line, li) => {
      let wi = 0;
      for (const tok of line.tokens) {
        if (tok.kind !== 'WORD') continue;
        const key = `L${li}:W${wi}`;
        const { lockedLanguage } = getWordScriptInfo(tok.text);
        const pendingSrc = pendingStressIds.value.get(tok.id);
        const snap: WordSnapshot = {
          text: tok.text,
          stressIndex: tok.stressIndex,
          lang: wordLanguages.value.get(tok.id),
          confirmed: lockedLanguage !== null || confirmedWords.value.has(tok.id),
          ...(pendingSrc !== undefined ? { pendingSource: pendingSrc } : {}),
        };
        prevByPos.set(key, snap);
        // Register first-occurrence text→snap for position-shift fallback
        if (!prevByText.has(tok.text)) prevByText.set(tok.text, snap);
        wi++;
      }
    });

    // Parse fresh — all tokens start with documentLanguage as default
    const doc = parseDocument(text, documentLanguage.value);

    // ── Migrate annotations to new token IDs ─────────────────────────────────
    // Primary:   match by positional key AND same text → preserve all annotations
    // Fallback:  match by word text alone (handles empty-line insertion/deletion)
    //            but only when the word text appears exactly once in old doc.
    const newConfirmed = new Set<string>();
    const newLangMap = new Map<string, Language>();
    const newPendingIds = new Map<string, 'ml' | 'heteronym' | 'variative'>();
    const stressPatches = new Map<string, number | null>(); // newId → stressIndex

    // Track which text-based snaps were already consumed by a positional match
    // so we don't double-apply them when the same word appears multiple times.
    const posMatchedTexts = new Set<string>();
    doc.lines.forEach((line, li) => {
      let wi = 0;
      for (const tok of line.tokens) {
        if (tok.kind !== 'WORD') continue;
        const key = `L${li}:W${wi}`;
        const snap = prevByPos.get(key);
        if (snap && snap.text === tok.text) {
          posMatchedTexts.add(tok.text);
        }
        wi++;
      }
    });

    doc.lines.forEach((line, li) => {
      let wi = 0;
      for (const tok of line.tokens) {
        if (tok.kind !== 'WORD') continue;
        const key = `L${li}:W${wi}`;
        const posSnap = prevByPos.get(key);
        let snap: WordSnapshot | undefined;

        if (posSnap && posSnap.text === tok.text) {
          // Exact positional + text match — best case
          snap = posSnap;
        } else if (!posMatchedTexts.has(tok.text)) {
          // No positional match for this text: try text-based fallback
          // (safe only when the word doesn't appear at its expected position,
          // meaning the line structure shifted without word content changing)
          snap = prevByText.get(tok.text);
        }

        if (snap) {
          if (snap.stressIndex !== null) stressPatches.set(tok.id, snap.stressIndex);
          if (snap.lang !== undefined) newLangMap.set(tok.id, snap.lang);
          if (snap.confirmed) newConfirmed.add(tok.id);
          if (snap.pendingSource) newPendingIds.set(tok.id, snap.pendingSource);
        }
        // No matching snap → annotations cleared (word is new or changed)
        wi++;
      }
    });

    // Apply stress patches and language overrides onto the freshly parsed doc
    const newTokenIndex = new Map(doc.tokenIndex);
    const newLines = doc.lines.map((line) => {
      let lineChanged = false;
      const newTokens = line.tokens.map((tok) => {
        if (tok.kind !== 'WORD') return tok;
        const newStress = stressPatches.get(tok.id);
        const newLang = newLangMap.get(tok.id);
        if (newStress === undefined && newLang === undefined) return tok;
        const newTok: IWordToken = {
          ...tok,
          stressIndex: newStress !== undefined ? newStress : tok.stressIndex,
          language: newLang !== undefined ? newLang : tok.language,
        };
        newTokenIndex.set(tok.id, newTok);
        lineChanged = true;
        return newTok;
      });
      return lineChanged ? { ...line, tokens: newTokens } : line;
    });

    document.value = { lines: newLines, tokenIndex: newTokenIndex };
    wordLanguages.value = newLangMap;
    confirmedWords.value = newConfirmed;
    pendingStressIds.value = newPendingIds;
    // pendingStressAlts is derived from live resolution, not migrated — reset it
    pendingStressAlts.value = new Map();

    // Debounce stress resolution — don't run while the user is still typing
    if (stressDebounceTimer) clearTimeout(stressDebounceTimer);
    stressDebounceTimer = setTimeout(() => {
      stressSyncLog.debug('debounce fired — running sync + async resolve');
      autoDetectAndStressWords();
      void resolveAllStressAsync();
    }, STRESS_DEBOUNCE_MS);
  }

  /**
   * For every word that has no manual language override:
   *   1. Run per-word language detection and update token.language.
   *      Ambiguous words (e.g. plain Latin) are resolved using a line-level
   *      franc detection — the full line text gives franc enough characters
   *      to produce a meaningful score instead of "undetermined".
   *   2. If language is 'ua' and the word has exactly one vowel,
   *      auto-set stressIndex = 0 (monosyllabic — always stressed).
   * Words that already have a stressIndex set by the user are NOT touched.
   */
  function autoDetectAndStressWords() {
    const docLang = documentLanguage.value;

    // ── Pre-compute script-aware language hints (two-pass) ───────────────────
    //
    // franc needs ~20+ chars for reliable scores. We compute ONE hint per
    // (lineIdx, script) pair so that a mixed line like "Ми влаштуємо Swinger"
    // produces a Cyrillic hint ('ua') AND a Latin hint ('en-us') independently.
    //
    // Context rules:
    //  - Only words whose script matches the target script are included.
    //    Latin words are NEVER mixed into a Cyrillic context and vice-versa.
    //  - Words that are 100% locked (lockedLanguage !== null) are still
    //    included in the context — they are unambiguous signals — but we
    //    never RUN detection for them (they never reach this hint lookup).
    //  - Pass 1: collect script-compatible words from the current line.
    //  - Pass 2: if still < MIN_CONTEXT_CHARS, expand ±CONTEXT_LINES
    //    neighbouring lines (same script filter applied).
    //
    const MIN_CONTEXT_CHARS = 20;
    const CONTEXT_LINES = 2;

    type WordScript = 'cyrillic' | 'latin';
    const CYRILLIC_RE = /[\u0400-\u04FF]/;
    const LATIN_RE = /[a-zA-Z\u00C0-\u024F]/;

    /** Script of a word: cyrillic, latin, or null for mixed/other */
    function wordScript(text: string): WordScript | null {
      const hasCyrillic = CYRILLIC_RE.test(text);
      const hasLatin = LATIN_RE.test(text);
      if (hasCyrillic && !hasLatin) return 'cyrillic';
      if (hasLatin && !hasCyrillic) return 'latin';
      return null; // mixed or neither
    }

    /** Collect words of a given script from a line, joined as a string */
    function scriptWords(line: (typeof document.value.lines)[0], script: WordScript): string {
      return line.tokens
        .filter((t): t is IWordToken => t.kind === 'WORD' && wordScript(t.text) === script)
        .map((t) => t.text)
        .join(' ');
    }

    const lines = document.value.lines;

    // Key: `${lineIdx}:${script}`  →  detected Language
    const lineScriptHint = new Map<string, Language>();

    // Determine which (lineIdx, script) pairs need a hint
    const neededHints = new Set<string>();
    lines.forEach((line, lineIdx) => {
      for (const t of line.tokens) {
        if (t.kind !== 'WORD') continue;
        if (wordLanguages.value.has(t.id)) continue;
        const info = getWordScriptInfo(t.text);
        if (info.lockedLanguage !== null) continue; // locked — no hint needed
        if (info.allowedLanguages.length === 0) continue; // mixed/other — handled separately
        const sc = wordScript(t.text);
        if (sc) neededHints.add(`${lineIdx}:${sc}`);
      }
    });

    neededHints.forEach((key) => {
      const [idxStr, sc] = key.split(':') as [string, WordScript];
      const lineIdx = Number(idxStr);

      // Pass 1: words of matching script from this line only
      let contextText = scriptWords(lines[lineIdx]!, sc);
      let result = detectLanguage(contextText);

      // Pass 2: still too short or undetermined → widen with neighbouring lines
      if (!result.language || contextText.length < MIN_CONTEXT_CHARS) {
        const lo = Math.max(0, lineIdx - CONTEXT_LINES);
        const hi = Math.min(lines.length - 1, lineIdx + CONTEXT_LINES);
        const wider = lines
          .slice(lo, hi + 1)
          .map((l) => scriptWords(l, sc))
          .filter(Boolean)
          .join(' ');
        if (wider.length > contextText.length) {
          const widerResult = detectLanguage(wider);
          if (widerResult.language) result = widerResult;
          contextText = wider;
        }
      }

      if (result.language) lineScriptHint.set(key, result.language);
    });

    // Build sets of what needs to change before mutating, so we can
    // produce new object references for changed tokens/lines (Vue reactivity).
    interface StressChange {
      syllableIndex: number;
      confirmed: boolean;
      source: 'monosyllable' | 'db' | 'heteronym' | 'variative' | 'ml';
      stresses: number[];
    }
    const langChanges = new Map<string, Language>(); // tokenId → new language
    const stressChanges = new Map<string, StressChange>(); // tokenId → resolved stress

    lines.forEach((line, lineIdx) => {
      for (const tok of line.tokens) {
        if (tok.kind !== 'WORD') continue;

        // ── 1. Language detection (skip manual overrides) ─────────────────────
        if (!wordLanguages.value.has(tok.id)) {
          const scriptInfo = getWordScriptInfo(tok.text);
          let detectedLang: Language;
          if (scriptInfo.lockedLanguage) {
            // Script uniquely determines language (UA-exclusive chars, PL diacritics)
            detectedLang = scriptInfo.lockedLanguage;
          } else if (scriptInfo.allowedLanguages.length > 0) {
            // Ambiguous — look up the script-aware hint for this (line, script) pair.
            // This guarantees a Cyrillic word only uses Cyrillic context and vice-versa.
            const sc = wordScript(tok.text);
            const lineHint = sc ? lineScriptHint.get(`${lineIdx}:${sc}`) : undefined;
            if (lineHint && scriptInfo.allowedLanguages.includes(lineHint)) {
              detectedLang = lineHint;
            } else {
              const result = detectLanguage(tok.text);
              detectedLang =
                result.language && scriptInfo.allowedLanguages.includes(result.language)
                  ? result.language
                  : scriptInfo.allowedLanguages[0]!;
            }
          } else {
            // Mixed script or other — run franc directly, fall back to doc lang
            const result = detectLanguage(tok.text);
            detectedLang = result.language ?? docLang;
          }
          if (tok.language !== detectedLang) {
            langChanges.set(tok.id, detectedLang);
          }
        }

        // ── 2. Auto-stress via trie resolver ─────────────────────────────────────
        if (tok.stressIndex === null) {
          const effectiveLang = langChanges.get(tok.id) ?? tok.language;
          const vowelCount = countVowels(tok.text, effectiveLang);
          stressSyncLog.debug(
            `word="${tok.text}" lang=${effectiveLang} vowels=${vowelCount} resolverReady=${!!stressResolver.value}`,
          );

          if (vowelCount === 1) {
            // Monosyllable — always confirmed.
            stressChanges.set(tok.id, {
              syllableIndex: 0,
              confirmed: true,
              source: 'monosyllable',
              stresses: [],
            });
            stressSyncLog.debug('monosyllable — auto-stressed');
          } else if (
            vowelCount > 1 &&
            effectiveLang === 'ua' &&
            stressResolver.value &&
            appStore.useDbStress
          ) {
            // Multi-syllable Ukrainian word — synchronous trie lookup.
            const resolution = stressResolver.value.resolveSync(tok.text);
            stressSyncLog.debug(
              `resolveSync result: syllable ${resolution.syllableIndex} (${resolution.source})`,
            );
            if (resolution.syllableIndex !== null) {
              stressChanges.set(tok.id, {
                syllableIndex: resolution.syllableIndex,
                confirmed: resolution.confirmed,
                source: resolution.source === 'unresolved' ? 'ml' : resolution.source,
                stresses: resolution.stresses ?? [],
              });
            }
          } else if (vowelCount > 1 && effectiveLang !== 'ua') {
            stressSyncLog.debug(`skipped (non-UA lang: ${effectiveLang})`);
          } else if (vowelCount > 1 && !stressResolver.value) {
            stressSyncLog.debug('skipped (resolver not ready yet)');
          }
        } else {
          stressSyncLog.debug(
            `word="${tok.text}" already has stressIndex=${tok.stressIndex} — skipped`,
          );
        }
      } // end for tok
    }); // end lines.forEach

    if (langChanges.size === 0 && stressChanges.size === 0) return;

    // Apply changes: produce new ILine/IToken object references so Vue
    // detects prop changes and re-renders LinePanel components.
    const newTokenIndex = new Map(document.value.tokenIndex);
    const newConfirmedAfterStress = new Set(confirmedWords.value);
    const newPendingAfterStress = new Map(pendingStressIds.value);
    const newPendingAltsAfterStress = new Map(pendingStressAlts.value);
    const newLines = document.value.lines.map((line) => {
      let lineChanged = false;
      const newTokens = line.tokens.map((tok) => {
        if (tok.kind !== 'WORD') return tok;
        const newLang = langChanges.get(tok.id);
        const sc = stressChanges.get(tok.id);
        if (!newLang && !sc) return tok;
        const newTok = {
          ...tok,
          language: newLang ?? tok.language,
          stressIndex: sc !== undefined ? sc.syllableIndex : tok.stressIndex,
        };
        newTokenIndex.set(tok.id, newTok);
        if (sc !== undefined) {
          syllableCache.value.delete(tok.id);
          if (sc.confirmed) {
            newConfirmedAfterStress.add(tok.id);
            newPendingAfterStress.delete(tok.id);
            newPendingAltsAfterStress.delete(tok.id);
          } else {
            const pSrc =
              sc.source === 'ml' ? 'ml' : sc.source === 'variative' ? 'variative' : 'heteronym';
            newPendingAfterStress.set(tok.id, pSrc);
            if (sc.stresses && sc.stresses.length > 1)
              newPendingAltsAfterStress.set(tok.id, sc.stresses);
          }
        }
        lineChanged = true;
        return newTok;
      });
      return lineChanged ? { ...line, tokens: newTokens } : line;
    });

    document.value = { lines: newLines, tokenIndex: newTokenIndex };
    confirmedWords.value = newConfirmedAfterStress;
    pendingStressIds.value = newPendingAfterStress;
    pendingStressAlts.value = newPendingAltsAfterStress;

    // Auto-confirm lines where every word has unambiguous language
    for (const line of document.value.lines) {
      tryAutoConfirmLine(line.id);
    }
  }

  function runDetection(text: string) {
    if (!text.trim()) return;
    const result = detectLanguage(text);
    detectionConfidence.value = result.confidence;
    if (result.language) {
      documentLanguage.value = result.language;
    }
  }

  // Save annotations whenever the document, confirmed set, or pending set changes
  watch(
    [() => document.value, () => confirmedWords.value, () => pendingStressIds.value],
    () => scheduleSaveAnnotations(),
    { deep: false },
  );

  // Watch rawText — debounced auto-detection (skipped if user set language manually)
  watch(rawText, (newText) => {
    if (documentLanguageManual.value) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => runDetection(newText), DETECTION_DEBOUNCE_MS);
  });

  // When document language changes, reset all non-overridden words to the new default,
  // then re-run per-word detection so Latin/PL words get corrected back immediately.
  watch(documentLanguage, () => {
    syllableCache.value = new Map();
    autoDetectAndStressWords();
  });

  // When the trie resolver becomes available, re-run stress detection so that
  // any words that were 'unresolved' on the first sync pass get their stress
  // filled in (from DB or ML).
  watch(stressResolver, (newResolver) => {
    if (newResolver) {
      autoDetectAndStressWords();
      // After the sync trie pass, run the async ML pass for any remaining OOV words.
      void resolveAllStressAsync();
    }
  });

  /**
   * Computed map: wordId → stress status
   *   'set'   — stressIndex is a number
   *   'auto'  — was auto-set (monosyllabic)
   *   'unset' — multi-syllable word, user hasn't set stress yet
   *
   * We reuse stressIndex: null means unset, 0+ means set.
   * The 'auto' distinction is tracked via autoStressedIds set.
   */
  const autoStressedIds = computed<Set<string>>(() => {
    const ids = new Set<string>();
    for (const tok of allWordTokens.value) {
      const vc = countVowels(tok.text, tok.language);
      // Monosyllabic (1 vowel) auto-stressed, OR no vowels at all (nothing to stress)
      if (vc === 0 || (tok.stressIndex !== null && vc === 1)) {
        ids.add(tok.id);
      }
    }
    return ids;
  });

  /** Per-word stress status for the gutter indicator */
  const wordStressStatus = computed<Map<string, 'set' | 'auto' | 'unset'>>(() => {
    const map = new Map<string, 'set' | 'auto' | 'unset'>();
    for (const tok of allWordTokens.value) {
      if (countVowels(tok.text, tok.language) === 0) {
        // No vowels — nothing to stress, treat as auto-satisfied
        map.set(tok.id, 'auto');
      } else if (tok.stressIndex !== null) {
        map.set(tok.id, autoStressedIds.value.has(tok.id) ? 'auto' : 'set');
      } else {
        map.set(tok.id, 'unset');
      }
    }
    return map;
  });

  // ── Expose ─────────────────────────────────────────────────────────────────

  // Run detection on initial load so saved text gets correct per-word languages immediately.
  // First replay any saved annotations (stress, language overrides, confirmed state).
  const _savedAnnotations = loadAnnotations();
  if (_savedAnnotations) applyAnnotations(_savedAnnotations);
  autoDetectAndStressWords();
  // Trigger one immediate save so fresh annotations are in sync
  saveAnnotations();

  // AbortController for the current async stress resolution pass.
  // Replaced each time resolveAllStressAsync() is called so an in-flight
  // ML call for a word the user has already edited is silently discarded.
  let _asyncStressAbort: AbortController | null = null;

  /**
   * Async pass: resolve stress for Ukrainian words that are still unresolved
   * (stressIndex === null) using the full resolver (sync trie + optional ML).
   * Only words that didn't get a sync result (OOV) are passed through the
   * async ML path. Results still needing confirmation are NOT auto-confirmed.
   *
   * Each new call aborts the previous pass so stale ML results for edited
   * words are never applied.
   */
  async function resolveAllStressAsync(): Promise<void> {
    // Abort any previous in-progress async pass.
    _asyncStressAbort?.abort();
    const ctl = new AbortController();
    _asyncStressAbort = ctl;
    const signal = ctl.signal;

    if (!stressResolver.value) {
      stressAsyncLog.debug('resolver not ready — skipping');
      return;
    }
    if (!appStore.useMlStress) {
      stressAsyncLog.debug('ML disabled — skipping');
      return;
    }
    const resolver = stressResolver.value;
    const unresolvedTokens = allWordTokens.value.filter(
      (t) => t.stressIndex === null && t.language === 'ua',
    );
    stressAsyncLog.info(
      `accenting ${unresolvedTokens.length} word${unresolvedTokens.length === 1 ? '' : 's'} via neural model…`,
    );

    const patches = new Map<
      string,
      {
        syllableIndex: number;
        confirmed: boolean;
        source: 'ml' | 'heteronym' | 'variative' | 'db';
        stresses?: number[];
      }
    >();

    for (const tok of allWordTokens.value) {
      if (signal.aborted) {
        stressAsyncLog.debug('aborted — stopping');
        return;
      }
      if (tok.stressIndex !== null) {
        stressAsyncLog.debug(`"${tok.text}" already resolved (${tok.stressIndex}) — skip`);
        continue;
      }
      if (tok.language !== 'ua') {
        stressAsyncLog.debug(`"${tok.text}" lang=${tok.language} — skip`);
        continue;
      }
      const textAtDispatch = tok.text;
      stressAsyncLog.info(`accenting “${tok.text}”…`);
      const resolution = await resolver.resolve(tok.text, signal);

      if (signal.aborted) {
        stressAsyncLog.debug('aborted while awaiting resolve — stopping');
        return;
      }

      // Validate the token still exists as a WORD and hasn't been edited since we dispatched.
      const currentTok = document.value.tokenIndex.get(tok.id);
      const currentWord = currentTok?.kind === 'WORD' ? currentTok : null;
      if (!currentWord || currentWord.text !== textAtDispatch) {
        stressAsyncLog.debug(`"${tok.id}" changed — discarding result`);
        continue;
      }

      stressAsyncLog.debug(
        `“${tok.text}” → syllable ${resolution.syllableIndex} via ${resolution.source}`,
      );
      if (resolution.syllableIndex !== null) {
        patches.set(tok.id, {
          syllableIndex: resolution.syllableIndex,
          confirmed: resolution.confirmed,
          source: resolution.source as 'ml' | 'heteronym' | 'variative' | 'db',
          stresses: resolution.stresses ?? [],
        });
      }
    }

    stressAsyncLog.info(`accented ${patches.size} word${patches.size === 1 ? '' : 's'}`);
    if (patches.size === 0) return;

    const newTokenIndex = new Map(document.value.tokenIndex);
    const newConfirmed = new Set(confirmedWords.value);
    const newPending = new Map(pendingStressIds.value);
    const newAlts = new Map(pendingStressAlts.value);
    const newLines = document.value.lines.map((line) => {
      let lineChanged = false;
      const newTokens = line.tokens.map((tok) => {
        if (tok.kind !== 'WORD') return tok;
        const patch = patches.get(tok.id);
        if (!patch) return tok;
        const newTok: IWordToken = { ...tok, stressIndex: patch.syllableIndex };
        newTokenIndex.set(tok.id, newTok);
        syllableCache.value.delete(tok.id);
        if (patch.confirmed) {
          newConfirmed.add(tok.id);
          newPending.delete(tok.id);
          newAlts.delete(tok.id);
        } else {
          const pSrc =
            patch.source === 'ml' ? 'ml' : patch.source === 'variative' ? 'variative' : 'heteronym';
          newPending.set(tok.id, pSrc);
          if (patch.stresses && patch.stresses.length > 1) newAlts.set(tok.id, patch.stresses);
        }
        lineChanged = true;
        return newTok;
      });
      return lineChanged ? { ...line, tokens: newTokens } : line;
    });

    document.value = { lines: newLines, tokenIndex: newTokenIndex };
    confirmedWords.value = newConfirmed;
    pendingStressIds.value = newPending;
    pendingStressAlts.value = newAlts;
    for (const line of document.value.lines) tryAutoConfirmLine(line.id);
  }

  return {
    // State
    rawText,
    document,
    documentLanguage,
    documentLanguageManual,
    wordLanguages,
    confirmedWords,
    pendingStressIds,
    pendingStressAlts,
    detectionConfidence,
    syllableCache,
    allWordTokens,
    wordStressStatus,
    activeLineIndex,
    // Actions
    setRawText,
    setDocumentLanguage,
    resetDocumentLanguageToAuto,
    setWordLanguage,
    clearWordLanguage,
    setWordStress,
    getWordLanguage,
    hasWordOverride,
    confirmLine,
    unconfirmLine,
    isLineConfirmed,
    tryAutoConfirmLine,
    getSyllables,
    autoDetectAndStressWords,
    resolveAllStressAsync,
    setActiveLineIndex: (idx: number | null) => {
      activeLineIndex.value = idx;
    },
  };
});
