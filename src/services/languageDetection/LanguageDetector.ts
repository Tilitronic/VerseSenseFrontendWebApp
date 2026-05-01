/**
 * LanguageDetector.ts
 *
 * Detects the most likely Language for a given text string using the `franc`
 * library as the statistical backbone, combined with a fast character-set
 * heuristic layer that resolves ambiguity in Cyrillic scripts (UA vs BUL/RUS).
 *
 * Strategy:
 *  1. Character heuristic first — UA-specific letters (є, ї, ґ, і used as
 *     vowel) are unambiguous. PL-specific diacritics (ą, ę, ó, ź…) too.
 *     If a strong signal is found, return immediately without calling franc.
 *  2. Franc fallback — for ambiguous or Latin-only text, use francAll() scores
 *     mapped to our 4 supported languages.
 *  3. Confidence threshold — if best score < MIN_CONFIDENCE, return null
 *     (caller should keep whatever language is already set, or use the
 *     document-level default).
 *
 * Supported output languages: 'ua' | 'pl' | 'en-us' | 'en-gb'
 * (we collapse all English variants from franc into 'en-us' as default)
 */

import { francAll } from 'franc';
import type { Language } from 'src/model/Language';

const ALL_LANGUAGES: Language[] = ['ua', 'pl', 'en-us', 'en-gb'];

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Minimum franc confidence score to trust a detection result */
const MIN_CONFIDENCE = 0.5;

/**
 * UA-exclusive characters that never appear in Bulgarian, Russian, or Belarusian.
 * Presence of any of these is a definitive UA signal.
 */
const UA_EXCLUSIVE_CHARS = /[єїґ]/i;

/**
 * Ukrainian 'і' (U+0456) — looks like Latin 'i' but is a distinct codepoint.
 * Used as a vowel in UA; absent in Russian/Bulgarian which use 'и' only.
 * We count occurrences; 2+ in a short text is a strong UA signal.
 */
const UA_VOWEL_I = /і/g; // U+0456, not Latin i

/**
 * Polish-exclusive diacritic characters.
 */
const PL_EXCLUSIVE_CHARS = /[ąćęłńóśźż]/i;

/**
 * Cyrillic character range — used to distinguish Cyrillic from Latin scripts.
 */
const CYRILLIC = /[\u0400-\u04FF]/;

/**
 * Latin character range (basic + extended). Used to detect pure-Latin words.
 */
const LATIN_ONLY = /[a-zA-Z\u00C0-\u024F]/;

/**
 * Franc ISO 639-3 codes → our Language type.
 * We include close Slavic relatives so we can promote ukr even when franc
 * picks bul/rus as #1.
 */
const FRANC_TO_LANGUAGE: Record<string, Language> = {
  ukr: 'ua',
  bul: 'ua', // Cyrillic → assume UA if heuristic didn't catch it
  rus: 'ua', // same — we don't support Russian, map to closest
  bel: 'ua', // same
  pol: 'pl',
  eng: 'en-us',
  sco: 'en-us', // Scots — very close to English, treat as en
  afr: 'en-us', // Afrikaans sometimes fires on short EN — treat as en
};

/** ISO 639-3 codes franc will consider; limits search space for performance */
const ONLY_LANGS = ['ukr', 'bul', 'rus', 'bel', 'pol', 'eng', 'sco'];

const LANGUAGE_TO_FRANC_CODES: Record<Language, string[]> = {
  ua: ['ukr', 'bul', 'rus', 'bel'],
  pl: ['pol'],
  'en-us': ['eng', 'sco', 'afr'],
  'en-gb': ['eng', 'sco', 'afr'],
};

export interface DetectionOptions {
  enabledLanguages?: Iterable<Language>;
}

function normalizeEnabledLanguages(options?: DetectionOptions): Set<Language> {
  const fromOptions = options?.enabledLanguages;
  if (!fromOptions) return new Set(ALL_LANGUAGES);
  const set = new Set(fromOptions);
  if (set.size === 0) return new Set(ALL_LANGUAGES);
  return set;
}

function mapToEnabledLanguage(lang: Language, enabled: Set<Language>): Language | null {
  if (enabled.has(lang)) return lang;
  if ((lang === 'en-us' || lang === 'en-gb') && enabled.has('en-us')) return 'en-us';
  if ((lang === 'en-us' || lang === 'en-gb') && enabled.has('en-gb')) return 'en-gb';
  return null;
}

function francOnlyCodes(enabled: Set<Language>): string[] {
  const codes = new Set<string>();
  enabled.forEach((lang) => {
    for (const code of LANGUAGE_TO_FRANC_CODES[lang]) codes.add(code);
  });
  return ONLY_LANGS.filter((code) => codes.has(code));
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface DetectionResult {
  /** Detected language, or null if confidence is too low */
  language: Language | null;
  /** Confidence score 0.0–1.0 from franc (or 1.0 for heuristic hits) */
  confidence: number;
  /** How the result was determined */
  method: 'heuristic' | 'franc' | 'undetermined';
}

/**
 * Detects the language of a text segment (word, line, or whole poem).
 *
 * Best accuracy with 20+ characters. For single short words the heuristic
 * layer still works well (UA/PL diacritics are decisive); franc falls back
 * gracefully for ambiguous short inputs.
 *
 * @param text - The text to analyze
 * @returns DetectionResult with language (nullable) and confidence
 */
export function detectLanguage(text: string, options?: DetectionOptions): DetectionResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { language: null, confidence: 0, method: 'undetermined' };
  }
  const enabled = normalizeEnabledLanguages(options);

  // ── 0. Script guard ─────────────────────────────────────────────────────
  // Pure Latin text cannot be Ukrainian (Cyrillic). Skip all UA heuristics.
  const isLatin = LATIN_ONLY.test(trimmed) && !CYRILLIC.test(trimmed);
  const isCyrillic = CYRILLIC.test(trimmed) && !LATIN_ONLY.test(trimmed);

  // ── 1. Heuristic layer ─────────────────────────────────────────────────────

  // UA-exclusive Cyrillic characters → definitive UA
  if (!isLatin && UA_EXCLUSIVE_CHARS.test(trimmed) && enabled.has('ua')) {
    return { language: 'ua', confidence: 1.0, method: 'heuristic' };
  }

  // Multiple UA-vowel-і characters → strong UA signal
  const uaICount = (trimmed.match(UA_VOWEL_I) ?? []).length;
  if (!isLatin && uaICount >= 2 && enabled.has('ua')) {
    return { language: 'ua', confidence: 0.95, method: 'heuristic' };
  }

  // PL diacritics → definitive PL
  if (PL_EXCLUSIVE_CHARS.test(trimmed) && enabled.has('pl')) {
    return { language: 'pl', confidence: 1.0, method: 'heuristic' };
  }

  // Cyrillic but no UA markers → likely UA (our primary Cyrillic language)
  if (isCyrillic && uaICount === 1 && enabled.has('ua')) {
    return { language: 'ua', confidence: 0.8, method: 'heuristic' };
  }

  // ── 2. Franc statistical layer ─────────────────────────────────────────────

  const onlyCodes = francOnlyCodes(enabled);
  if (onlyCodes.length === 0) {
    return { language: null, confidence: 0, method: 'undetermined' };
  }

  const scores = francAll(trimmed, { only: onlyCodes }) as [string, number][];
  const first = scores[0];
  if (!first) {
    return { language: null, confidence: 0, method: 'undetermined' };
  }
  const [topCode, topScore] = first;

  if (topScore < MIN_CONFIDENCE) {
    // Pure Cyrillic with no UA markers and no clear franc winner → default UA
    if (isCyrillic && enabled.has('ua')) {
      return { language: 'ua', confidence: 0.6, method: 'franc' };
    }
    // Latin or other — undetermined; caller uses document default
    return { language: null, confidence: topScore, method: 'undetermined' };
  }

  const mappedRaw = FRANC_TO_LANGUAGE[topCode] ?? null;
  const mapped = mappedRaw ? mapToEnabledLanguage(mappedRaw, enabled) : null;
  return { language: mapped, confidence: topScore, method: 'franc' };
}

/**
 * Detects language for an entire document by analysing all lines together.
 * More accurate than per-word detection. Use this to set the document default.
 *
 * @param fullText - The complete raw poem text
 * @returns The dominant language or 'ua' as fallback
 */
export function detectDocumentLanguage(fullText: string, options?: DetectionOptions): Language {
  const enabled = normalizeEnabledLanguages(options);
  const result = detectLanguage(fullText, options);
  if (result.language) return result.language;
  if (enabled.has('ua')) return 'ua';
  if (enabled.has('pl')) return 'pl';
  if (enabled.has('en-us')) return 'en-us';
  if (enabled.has('en-gb')) return 'en-gb';
  return 'ua';
}
