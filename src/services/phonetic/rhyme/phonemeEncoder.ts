/**
 * rhyme/phonemeEncoder.ts
 *
 * Maps IPA token strings to integer codes used by the motif finder.
 *
 * ── Two encoding layers ───────────────────────────────────────────────────────
 *
 *  EXACT encoding   — each unique IPA token gets its own integer.
 *                     Used for exact-match motif discovery.
 *
 *  FUZZY encoding   — tokens that belong to the same psychoacoustic equivalence
 *                     class share the same integer.
 *                     Used for near/structural motif discovery.
 *
 * ── Fuzzy equivalence classes ────────────────────────────────────────────────
 *
 *  The fuzzy classes are deliberately coarser than the full psychoacoustic
 *  groups in ipaColorMap.ts so that:
 *
 *   - Voiced/voiceless pairs collapse:  p=b, t=d, k=g, s=z, f=v, ʃ=ʒ …
 *   - Soft/hard pairs collapse:         l=lʲ, n=nʲ, r=rʲ, s=sʲ, z=zʲ …
 *   - Long/short vowels collapse:       a=aː, i=iː, u=uː …
 *   - Diphthongs → nearest monophthong: eɪ→e, aɪ→a, ɔɪ→ɔ …
 *
 * Structural encoding goes one step further: all vowels → VOWEL_CLASS,
 * all consonants → their broad manner class (stop, fricative, nasal, sonorant).
 * This lets the motif finder discover "same CV skeleton" patterns.
 *
 * ── Separator ────────────────────────────────────────────────────────────────
 *
 * Code 0 is reserved as a WORD_BOUNDARY sentinel.
 * Code 1 is reserved as a LINE_BOUNDARY sentinel.
 * Actual phoneme codes start at 2.
 */

import {
  CONSONANTS,
  VOWELS,
} from 'src/services/poetryEngines/shared/ipaService/consts/ipa-symbols.const';

export const WORD_BOUNDARY = 0;
export const LINE_BOUNDARY = 1;
const FIRST_PHONEME_CODE  = 2;

// ── Consonant fuzzy-class mapping ─────────────────────────────────────────────
//
// We map each consonant to a "root" symbol: the canonical form that
// collapses voiced/voiceless and soft/hard pairs.

const VOICED_TO_VOICELESS: Record<string, string> = {
  b: 'p', d: 't', g: 'k', v: 'f', z: 's', ʒ: 'ʃ',
  ɣ: 'x', ʁ: 'χ', ð: 'θ', dz: 'ts', dʒ: 'tʃ', dʑ: 'tɕ', dʐ: 'tʂ',
  β: 'ɸ', ɦ: 'h',
};

const SOFT_TO_HARD: Record<string, string> = {
  lʲ: 'l', nʲ: 'n', rʲ: 'r', sʲ: 's', zʲ: 'z', tʲ: 't', dʲ: 'd',
};

// Root of a consonant symbol (for fuzzy matching)
function consonantRoot(sym: string): string {
  return SOFT_TO_HARD[sym] ?? VOICED_TO_VOICELESS[sym] ?? sym;
}

// ── Vowel fuzzy-class mapping ─────────────────────────────────────────────────
//
// Long vowels → short; diphthongs → first component monophthong.

const DIPHTHONG_ROOT: Record<string, string> = {
  'eɪ': 'e', 'aɪ': 'a', 'ɔɪ': 'ɔ', 'aʊ': 'a', 'oʊ': 'o',
  'ɪə': 'ɪ', 'eə': 'e', 'ʊə': 'ʊ',
};
const LONG_VOWEL_ROOT: Record<string, string> = {
  'iː': 'i', 'uː': 'u', 'aː': 'a', 'eː': 'e', 'oː': 'o',
  'ɑː': 'ɑ', 'ɔː': 'ɔ', 'ɜː': 'ɜ',
};

function vowelRoot(sym: string): string {
  return DIPHTHONG_ROOT[sym] ?? LONG_VOWEL_ROOT[sym] ?? sym;
}

// ── Structural (CV skeleton) codes ───────────────────────────────────────────
//
// All vowels share one structural code; consonants are grouped by broad manner.

export const STRUCT_VOWEL   = 'V';
export const STRUCT_STOP    = 'C_stop';
export const STRUCT_FRIC    = 'C_fric';
export const STRUCT_NASAL   = 'C_nasal';
export const STRUCT_SONOR   = 'C_sonor';
export const STRUCT_OTHER   = 'C_other';

function consonantStructClass(manner: string): string {
  if (manner === 'PLOSIVE' || manner === 'IMPLOSIVE') return STRUCT_STOP;
  if (
    manner === 'SIBILANT FRICATIVE' ||
    manner === 'NON-SIBILANT FRICATIVE' ||
    manner === 'LATERAL FRICATIVE' ||
    manner === 'SIBILANT AFFRICATE' ||
    manner === 'NON-SIBILANT AFFRICATE' ||
    manner === 'LATERAL AFFRICATE'
  )
    return STRUCT_FRIC;
  if (manner === 'NASAL') return STRUCT_NASAL;
  if (
    manner === 'APPROXIMANT' ||
    manner === 'LATERAL APPROXIMANT' ||
    manner === 'TRILL' ||
    manner === 'TAP/FLAP' ||
    manner === 'LATERAL TAP/FLAP'
  )
    return STRUCT_SONOR;
  return STRUCT_OTHER;
}

// ── Build lookup maps ─────────────────────────────────────────────────────────

/**
 * token string → { exactCode, fuzzyCode, structCode }
 * Built once at module load from the CONSONANTS/VOWELS tables.
 */
interface TokenCodes {
  exactCode: number;
  fuzzyCode: number;
  structCode: number;
}

function buildCodeMaps(): Map<string, TokenCodes> {
  // Phase 1: collect all unique exact, fuzzy-root, and struct-class strings
  const exactStrings  = new Set<string>();
  const fuzzyStrings  = new Set<string>();
  const structStrings = new Set<string>();

  for (const c of CONSONANTS) {
    exactStrings.add(c.symbol);
    fuzzyStrings.add(consonantRoot(c.symbol));
    structStrings.add(consonantStructClass(c.manner));
  }
  // Also add soft/hard and voiced/voiceless variants that appear in real transcription
  for (const [from] of Object.entries({ ...SOFT_TO_HARD, ...VOICED_TO_VOICELESS })) {
    exactStrings.add(from);
    fuzzyStrings.add(consonantRoot(from));
  }

  for (const v of VOWELS) {
    exactStrings.add(v.symbol);
    fuzzyStrings.add(vowelRoot(v.symbol));
    structStrings.add(STRUCT_VOWEL);
  }
  // Long vowels and diphthongs from tokenizer
  for (const [from] of Object.entries({ ...DIPHTHONG_ROOT, ...LONG_VOWEL_ROOT })) {
    exactStrings.add(from);
    fuzzyStrings.add(vowelRoot(from));
    structStrings.add(STRUCT_VOWEL);
  }

  // Phase 2: assign stable integer codes (sorted for determinism)
  let next = FIRST_PHONEME_CODE;
  const exactCode  = new Map<string, number>([...exactStrings].sort().map((s) => [s, next++]));
  const fuzzyCode  = new Map<string, number>([...fuzzyStrings].sort().map((s) => [s, next++]));
  const structCode = new Map<string, number>([...structStrings].sort().map((s) => [s, next++]));

  // Phase 3: build combined map for every exact symbol
  const result = new Map<string, TokenCodes>();

  const allSymbols = new Set([
    ...exactStrings,
    ...Object.keys(SOFT_TO_HARD),
    ...Object.keys(VOICED_TO_VOICELESS),
    ...Object.keys(DIPHTHONG_ROOT),
    ...Object.keys(LONG_VOWEL_ROOT),
  ]);

  for (const sym of allSymbols) {
    const isVowel = VOWELS.some((v) => v.symbol === sym) ||
                    sym in DIPHTHONG_ROOT || sym in LONG_VOWEL_ROOT;
    const consonantEntry = CONSONANTS.find((c) => c.symbol === sym);

    const fRoot  = isVowel ? vowelRoot(sym) : consonantRoot(sym);
    const sClass = isVowel
      ? STRUCT_VOWEL
      : consonantEntry
        ? consonantStructClass(consonantEntry.manner)
        : STRUCT_OTHER;

    // Fall back to fresh codes for unknown symbols so nothing crashes
    const ec = exactCode.get(sym)  ?? (next++);
    const fc = fuzzyCode.get(fRoot) ?? (next++);
    const sc = structCode.get(sClass) ?? (next++);

    result.set(sym, { exactCode: ec, fuzzyCode: fc, structCode: sc });
  }

  return result;
}

const CODE_MAP = buildCodeMaps();

// ── Public API ────────────────────────────────────────────────────────────────

export type EncodingLayer = 'exact' | 'fuzzy' | 'structural';

/**
 * Encode a single IPA token to an integer for the given layer.
 * Unknown tokens get a unique code derived from their UTF-16 values (never 0 or 1).
 */
export function encodeToken(token: string, layer: EncodingLayer): number {
  const entry = CODE_MAP.get(token);
  if (entry) {
    if (layer === 'exact')      return entry.exactCode;
    if (layer === 'fuzzy')      return entry.fuzzyCode;
    return entry.structCode;
  }
  // Unknown token: hash to a stable code outside the reserved range
  let h = FIRST_PHONEME_CODE + 10000;
  for (let i = 0; i < token.length; i++) h = (h * 31 + token.charCodeAt(i)) & 0x7fffffff;
  return Math.max(FIRST_PHONEME_CODE, h);
}

/**
 * Encode a full IPA token array to integer array.
 * Used to build the flat poem sequence for the suffix-array / n-gram passes.
 */
export function encodeTokens(tokens: string[], layer: EncodingLayer): number[] {
  return tokens.map((t) => encodeToken(t, layer));
}

/**
 * True when two tokens are equivalent under the given layer.
 * Convenience wrapper used by DTW scoring.
 */
export function tokensMatch(a: string, b: string, layer: EncodingLayer): boolean {
  return encodeToken(a, layer) === encodeToken(b, layer);
}

/**
 * Phonetic substitution cost between two tokens (0 = identical, 1 = unrelated).
 *
 * Cost matrix:
 *   exact match           → 0.0
 *   fuzzy match (same root) → 0.15  (voiced/voiceless, soft/hard)
 *   structural match      → 0.45   (same manner class, different root)
 *   completely different  → 1.0
 */
export function substitutionCost(a: string, b: string): number {
  if (a === b) return 0.0;
  if (encodeToken(a, 'fuzzy') === encodeToken(b, 'fuzzy')) return 0.15;
  if (encodeToken(a, 'structural') === encodeToken(b, 'structural')) return 0.45;
  return 1.0;
}
