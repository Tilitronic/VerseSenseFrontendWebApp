/**
 * ipaStreamExport.ts
 *
 * Serialises the confirmed portion of a poem into a structured IPA stream JSON
 * suitable for handoff to an external phonetic-annotation service.
 *
 * ── Output format ─────────────────────────────────────────────────────────────
 *
 * {
 *   "metadata": {
 *     "version": "1.1",
 *     "generatedAt": "2026-05-08T14:22:00.000Z",
 *     "confirmedLineCount": 4,
 *     "totalWordCount": 18,
 *     "languagesPresent": ["uk", "pl"]
 *   },
 *   "stream": [
 *     {
 *       "type": "word",
 *       "id": "w-abc123",           // stable token ID for round-trip
 *       "lineIndex": 0,             // 0-based confirmed-line index
 *       "wordIndex": 0,             // 0-based word index within line
 *       "language": "uk",
 *       "original": "башук",
 *       "syllableCount": 2,
 *       "stressedSyllable": 1,      // 0-based index; -1 if no stress detected
 *       "stressSource": "dict",     // "dict" | "ml" | "manual"
 *       "syllables": [
 *         { "ipa": "ba", "tokens": ["b","a"], "grapheme": "ба", "stressed": false, "isOpen": true  },
 *         { "ipa": "ʃuk","tokens": ["ʃ","u","k"],"grapheme":"шук","stressed":true, "isOpen": false }
 *       ]
 *     },
 *     { "type": "whitespace" },
 *     { "type": "word", ... },
 *     { "type": "line_break", "lineIndex": 0 },   // marks end of that line
 *     ...
 *   ]
 * }
 *
 * ── Syllable fields ───────────────────────────────────────────────────────────
 *
 *   ipa      — full IPA string of the syllable (e.g. "ʃuk")
 *   tokens   — ordered discrete phoneme tokens (e.g. ["ʃ","u","k"])
 *   grapheme — original grapheme chunk aligned to this syllable (best-effort)
 *   stressed — true on the syllable bearing primary stress
 *   isOpen   — true when the syllable ends on a vowel (open syllable structure)
 *
 * ── Stress source ─────────────────────────────────────────────────────────────
 *
 *   "dict"   — resolved by WASM dictionary (highest confidence)
 *   "ml"     — predicted by Luscinia ML model (OOV word)
 *   "manual" — explicitly confirmed / overridden by the user
 *
 * ── Punctuation ──────────────────────────────────────────────────────────────
 *
 * Standard punctuation tokens are included in the stream:
 *   , . : ; ? ! ( ) [ ] « » „ " " ' ' … —
 *
 * Dash normalisation — all of the following are emitted as "—" (U+2014 em-dash):
 *   - (standalone hyphen surrounded by spaces, i.e. not a compound-word HYPHEN)
 *   – (en-dash, U+2013)
 *   | or || (pipe characters used as dash in plain-text poetry)
 *   — (em-dash — already correct)
 *   ... (three dots) → emitted as "…" (U+2026 ellipsis)
 *
 * HYPHEN tokens (compound-word connectors, e.g. "Пеггінг-потяг") are NOT emitted.
 * TAB tokens are NOT emitted.
 * WORD tokens without any letter grapheme (e.g. lone "—" typed as a word) are
 * skipped — those cases are handled by the PUNCT path when "—" is a separate chunk.
 *
 * ── Stream rules ─────────────────────────────────────────────────────────────
 *
 * • Only CONFIRMED lines are emitted.
 * • The stream is driven directly from the token sequence:
 *     WORD  → "word" item
 *     PUNCT → "punctuation" item (after normalisation; unknown punct skipped)
 *     GAP   → "whitespace" item
 *     HYPHEN, TAB → skipped
 * • { "type": "line_break", "lineIndex": N } between confirmed lines.
 *   lineIndex is the index of the line that just ended (0-based).
 *   No trailing line_break after the last line.
 */

import type { IPoetryDocument, IWordToken } from 'src/model/Token';
import { transcribeWord } from './wordTranscription';

// ── Re-export IPA stream types from the engine package ────────────────────────

export type {
  StressSource,
  IpaStreamSyllable,
  IpaStreamWord,
  IpaStreamWhitespace,
  IpaStreamLineBreak,
  IpaStreamMetadata,
  IpaStream,
} from 'ipa-poetry-engine';
// Backward-compatible aliases for the local names used before the migration.
export type { IpaStreamPunctuation as IpaStreamPunct } from 'ipa-poetry-engine';
export type { StreamElement as IpaStreamItem } from 'ipa-poetry-engine';

import type {
  StressSource,
  IpaStreamSyllable,
  StreamElement,
  IpaStream,
} from 'ipa-poetry-engine';

// ── Punctuation normalisation ─────────────────────────────────────────────────

/**
 * Dash variants: standalone hyphen, en-dash, pipe(s) → em-dash.
 * Matches the full text of a PUNCT token, not a substring.
 */
const DASH_RE = /^[-–|]+$/;

/**
 * Punctuation characters that are passed through as-is (after dash normalisation).
 * Covers the basic set for Ukrainian, Polish, and English.
 */
const PASSTHROUGH_PUNCT = new Set([
  '—',  // em-dash (U+2014)
  ',', '.', ':', ';', '?', '!',
  '(', ')', '[', ']',
  '«', '»',              // Ukrainian/Polish guillemets
  '„', '"', '"',         // typographic double quotes
  '\u2018', '\u2019',    // typographic single quotes ' '
  '…',                   // ellipsis (U+2026)
]);

/**
 * Normalise a raw PUNCT token text.
 * Returns the normalised string, or null to skip the token entirely.
 */
function normalisePunct(raw: string): string | null {
  if (DASH_RE.test(raw)) return '—';
  if (raw === '...') return '…';
  if (PASSTHROUGH_PUNCT.has(raw)) return raw;
  return null; // unknown / exotic — skip
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function resolveStressSource(
  tok: IWordToken,
  pendingStressIds: ReadonlyMap<string, string>,
  confirmedWords: ReadonlySet<string>,
): StressSource {
  if (pendingStressIds.get(tok.id) === 'ml') return 'ml';
  if (confirmedWords.has(tok.id)) return 'manual';
  return 'dict';
}

function wordToIpaSyllables(tok: IWordToken): IpaStreamSyllable[] {
  const tw = transcribeWord(tok);
  return tw.syllables.map((syl) => ({
    ipa: syl.ipa,
    tokens: [...syl.ipaTokens],
    grapheme: syl.text,
    stressed: syl.stressed,
    isOpen: syl.isOpen,
  }));
}

// ── Builder ───────────────────────────────────────────────────────────────────

const HAS_LETTER = /\p{L}/u;

export interface IpaStreamOptions {
  /**
   * Map from token ID to pending stress kind.
   * Pass `store.pendingStressIds` to enable stressSource = 'ml' detection.
   */
  pendingStressIds?: ReadonlyMap<string, string>;
  /**
   * Set of token IDs that have been manually confirmed by the user.
   * Pass `store.confirmedWords` to enable stressSource = 'manual' detection.
   */
  confirmedWords?: ReadonlySet<string>;
}

/**
 * Build an IpaStream from all confirmed lines of the document.
 *
 * @param doc              Parsed poem document.
 * @param isLineConfirmed  Predicate (lineId → boolean) from the poetry store.
 * @param options          Optional store refs for richer stress-source metadata.
 */
export function buildIpaStream(
  doc: IPoetryDocument,
  isLineConfirmed: (lineId: string) => boolean,
  options: IpaStreamOptions = {},
): IpaStream {
  const { pendingStressIds = new Map(), confirmedWords = new Set() } = options;

  const stream: StreamElement[] = [];
  let confirmedLineCount = 0;
  let totalWordCount = 0;
  const languagesPresent = new Set<string>();

  for (const line of doc.lines) {
    if (!isLineConfirmed(line.id)) continue;

    const confirmedLineIndex = confirmedLineCount;

    // Line separator before every line except the first.
    if (confirmedLineCount > 0) {
      stream.push({ type: 'line_break', lineIndex: confirmedLineIndex - 1 });
    }
    confirmedLineCount++;

    // Drive stream directly from token sequence:
    //   WORD  → word item
    //   PUNCT → punctuation item (normalised; unknown punct skipped)
    //   GAP   → whitespace item
    //   HYPHEN, TAB → skipped (compound connectors and indents have no phonetic role)
    let wordIndex = 0;

    for (const tok of line.tokens) {
      if (tok.kind === 'GAP') {
        stream.push({ type: 'whitespace' });
        continue;
      }

      if (tok.kind === 'PUNCT') {
        const normalised = normalisePunct(tok.text);
        if (normalised !== null) {
          stream.push({ type: 'punctuation', text: normalised });
        }
        continue;
      }

      if (tok.kind === 'WORD' && HAS_LETTER.test(tok.text)) {
        const syllables = wordToIpaSyllables(tok);
        const stressedSyllable = syllables.findIndex((s) => s.stressed);

        languagesPresent.add(tok.language);
        totalWordCount++;

        stream.push({
          type: 'word',
          id: tok.id,
          lineIndex: confirmedLineIndex,
          wordIndex,
          language: tok.language,
          original: tok.text,
          syllableCount: syllables.length,
          stressedSyllable,
          stressSource: resolveStressSource(tok, pendingStressIds, confirmedWords),
          syllables,
        });

        wordIndex++;
      }

      // HYPHEN and TAB — skip silently
    }
  }

  return {
    metadata: {
      version: '1.1',
      generatedAt: new Date().toISOString(),
      confirmedLineCount,
      totalWordCount,
      languagesPresent: [...languagesPresent].sort(),
    },
    stream,
  };
}

// ── Download helper ───────────────────────────────────────────────────────────

/**
 * Trigger a browser download of the IPA stream as a JSON file.
 */
export function downloadIpaStream(stream: IpaStream, filename = 'ipa-stream.json'): void {
  const json = JSON.stringify(stream, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
