/**
 * enTranscription.ts
 *
 * English grapheme → IPA syllabification.
 *
 * Primary source: CMU Pronouncing Dictionary (134k+ words, Carnegie Mellon).
 * The CMU dict gives ARPABET phonemes with stress digits (0/1/2) embedded,
 * e.g. "gold" → "G OW1 L D".  We convert ARPABET → IPA and extract the
 * stressed syllable from the `1` (primary) digit.
 *
 * Fallback: rule-based grapheme→IPA for words not in the CMU dict
 * (proper nouns, neologisms, unusual spellings).
 */

import { dictionary as CMU } from 'cmu-pronouncing-dictionary';
import { tokenizeIPA } from './ipaTokenizer';

export interface EnSyllable {
  /** IPA phonetic string for this syllable */
  ipa: string;
  /** Whether this syllable is stressed */
  stressed: boolean;
  /** Whether this syllable ends with a vowel (open) */
  isOpen: boolean;
}

// ── ARPABET → IPA symbol map ──────────────────────────────────────────────────
// Each ARPABET phoneme may appear with a trailing stress digit (0/1/2) for
// vowels; consonants have no digit.  We strip the digit separately.
// Source: https://en.wikipedia.org/wiki/ARPABET
const ARPABET_TO_IPA: Record<string, string> = {
  // Vowels
  AA: 'ɑ',
  AE: 'æ',
  AH: 'ʌ',
  AO: 'ɔ',
  AW: 'aʊ',
  AX: 'ə',
  AY: 'aɪ',
  EH: 'ɛ',
  ER: 'ɜr',
  EY: 'eɪ',
  IH: 'ɪ',
  IX: 'ɨ',
  IY: 'iː',
  OW: 'oʊ',
  OY: 'ɔɪ',
  UH: 'ʊ',
  UW: 'uː',
  UX: 'ʉ',
  // Consonants
  B: 'b',
  CH: 'tʃ',
  D: 'd',
  DH: 'ð',
  DX: 'ɾ',
  EL: 'l̩',
  EM: 'm̩',
  EN: 'n̩',
  F: 'f',
  G: 'g',
  HH: 'h',
  JH: 'dʒ',
  K: 'k',
  L: 'l',
  M: 'm',
  N: 'n',
  NG: 'ŋ',
  NX: 'ɾ̃',
  P: 'p',
  Q: 'ʔ',
  R: 'r',
  S: 's',
  SH: 'ʃ',
  T: 't',
  TH: 'θ',
  V: 'v',
  W: 'w',
  WH: 'ʍ',
  Y: 'j',
  Z: 'z',
  ZH: 'ʒ',
};

/**
 * Convert a single ARPABET token (possibly with stress digit) to IPA.
 * Returns [ipaSymbol, stressLevel] where stressLevel is 0|1|2 for vowels, -1 for consonants.
 */
function arpabetTokenToIpa(token: string): [string, number] {
  const m = token.match(/^([A-Z]+)([012]?)$/);
  if (!m) return [token.toLowerCase(), -1];
  const base = m[1]!;
  const digit = m[2];
  const stress = digit ? parseInt(digit, 10) : -1;

  // AH with stress 0 → schwa (unstressed function-word vowel)
  const ipa = base === 'AH' && stress === 0 ? 'ə' : (ARPABET_TO_IPA[base] ?? base.toLowerCase());

  return [ipa, stress];
}

// ── IPA vowel set (for nucleus detection) ─────────────────────────────────────
const IPA_VOWEL_TOKENS = new Set([
  'a',
  'e',
  'i',
  'o',
  'u',
  'æ',
  'ɛ',
  'ɪ',
  'ɒ',
  'ʌ',
  'ɑ',
  'ɔ',
  'ə',
  'ɜ',
  'ʊ',
  'ɨ',
  'ʉ',
  'iː',
  'uː',
  'aː',
  'eː',
  'oː',
  'ɑː',
  'ɔː',
  'ɜː',
  'eɪ',
  'aɪ',
  'ɔɪ',
  'aʊ',
  'oʊ',
  'ɪə',
  'eə',
  'ʊə',
  'ɜr', // rhotic centre vowel from CMU ER
]);

// ── CMU-based transcription ───────────────────────────────────────────────────

interface CmuResult {
  ipaTokens: string[];
  /** -1 = consonant, 0 = unstressed vowel, 1 = primary stress, 2 = secondary stress */
  stresses: number[];
}

function transcribeFromCmu(word: string): CmuResult | null {
  const key = word.toLowerCase().replace(/['']/g, "'");
  const arpabet = (CMU as Record<string, string>)[key];
  if (!arpabet) return null;

  const ipaTokens: string[] = [];
  const stresses: number[] = [];

  for (const p of arpabet.split(' ')) {
    const [ipa, stress] = arpabetTokenToIpa(p);
    ipaTokens.push(ipa);
    stresses.push(stress);
  }

  return { ipaTokens, stresses };
}

/**
 * Build syllables from a CmuResult.
 * Stress digit 1 in the ARPABET marks primary-stressed vowel → stressed syllable.
 */
function syllabifyFromCmu(result: CmuResult): { ipa: string; stressed: boolean }[] {
  const { ipaTokens, stresses } = result;

  // Collect vowel positions and identify primary-stress syllable index
  const vowelIndices: number[] = [];
  let primaryVowelPos = -1; // position in vowelIndices array

  for (let i = 0; i < ipaTokens.length; i++) {
    if (stresses[i]! >= 0) {
      if (stresses[i] === 1) primaryVowelPos = vowelIndices.length;
      vowelIndices.push(i);
    }
  }

  if (vowelIndices.length === 0) {
    return [{ ipa: ipaTokens.join(''), stressed: false }];
  }
  if (vowelIndices.length === 1) {
    // Monosyllable: stressed if primary or if it's the only vowel
    return [
      {
        ipa: ipaTokens.join(''),
        stressed: primaryVowelPos === 0 || stresses[vowelIndices[0]!]! >= 0,
      },
    ];
  }

  // Split into syllables
  const ranges: Array<[number, number]> = [];
  let rangeStart = 0;

  for (let vi = 0; vi < vowelIndices.length; vi++) {
    const nucEnd = vowelIndices[vi]! + 1;
    const nextNuc = vowelIndices[vi + 1] ?? ipaTokens.length;
    const between = nextNuc - nucEnd;
    const codaEnd =
      vi < vowelIndices.length - 1 ? (between > 1 ? nucEnd + 1 : nucEnd) : ipaTokens.length;

    ranges.push([rangeStart, codaEnd]);
    rangeStart = codaEnd;
  }

  return ranges.map(([s, e], sylIdx) => ({
    ipa: ipaTokens.slice(s, e).join(''),
    stressed: sylIdx === primaryVowelPos,
  }));
}

// ── Rule-based fallback ───────────────────────────────────────────────────────
// Used only for words not found in the CMU dictionary.

const GRAPHEME_RULES: [RegExp, string][] = [
  [/tch/g, 'tʃ'],
  [/sch/g, 'ʃ'],
  [/ph/g, 'f'],
  [/ch/g, 'tʃ'],
  [/sh/g, 'ʃ'],
  [/th/g, 'θ'],
  [/wh/g, 'w'],
  [/gh/g, ''],
  [/ng/g, 'ŋ'],
  [/nk/g, 'ŋk'],
  [/qu/g, 'kw'],
  [/ck/g, 'k'],
  [/dg/g, 'dʒ'],
  [/ee/g, 'iː'],
  [/ea/g, 'iː'],
  [/oo/g, 'uː'],
  [/ou/g, 'aʊ'],
  [/ow/g, 'aʊ'],
  [/oi/g, 'ɔɪ'],
  [/oy/g, 'ɔɪ'],
  [/au/g, 'ɔː'],
  [/aw/g, 'ɔː'],
  [/ai/g, 'eɪ'],
  [/ay/g, 'eɪ'],
  [/igh/g, 'aɪ'],
  [/ie/g, 'iː'],
  [/a([bcdfghjklmnpqrstvwxyz])e\b/gi, 'eɪ$1'],
  [/i([bcdfghjklmnpqrstvwxyz])e\b/gi, 'aɪ$1'],
  [/o([bcdfghjklmnpqrstvwxyz])e\b/gi, 'oʊ$1'],
  [/u([bcdfghjklmnpqrstvwxyz])e\b/gi, 'juː$1'],
  [/^y(?=[aeiouæɛɪɒʌɑɔəɜʊ])/i, 'j'],
];

const LETTER_IPA: Record<string, string> = {
  a: 'æ',
  e: 'ɛ',
  i: 'ɪ',
  o: 'ɒ',
  u: 'ʌ',
  y: 'ɪ',
  b: 'b',
  c: 'k',
  d: 'd',
  f: 'f',
  g: 'g',
  h: 'h',
  j: 'dʒ',
  k: 'k',
  l: 'l',
  m: 'm',
  n: 'n',
  p: 'p',
  q: 'k',
  r: 'r',
  s: 's',
  t: 't',
  v: 'v',
  w: 'w',
  x: 'ks',
  z: 'z',
};

function graphemesToIPA(word: string): string {
  let s = word.toLowerCase().replace(/['']/g, "'");
  for (const [re, rep] of GRAPHEME_RULES) s = s.replace(re, rep);
  s = s
    .split('')
    .map((ch) => LETTER_IPA[ch] ?? ch)
    .join('');
  return s;
}

function splitIpaToSyllables(ipa: string): string[] {
  if (!ipa) return [];
  const tokens = tokenizeIPA(ipa);
  const nucleiIdx: number[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (IPA_VOWEL_TOKENS.has(tokens[i]!)) nucleiIdx.push(i);
  }
  if (nucleiIdx.length <= 1) return [ipa];

  const ranges: Array<[number, number]> = [];
  let rangeStart = 0;
  for (let ni = 0; ni < nucleiIdx.length; ni++) {
    const nucEnd = nucleiIdx[ni]! + 1;
    const nextNuc = nucleiIdx[ni + 1] ?? tokens.length;
    const between = nextNuc - nucEnd;
    const codaEnd = ni < nucleiIdx.length - 1 ? (between > 1 ? nucEnd + 1 : nucEnd) : tokens.length;
    ranges.push([rangeStart, codaEnd]);
    rangeStart = codaEnd;
  }
  return ranges.map(([s, e]) => tokens.slice(s, e).join('')).filter(Boolean);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Transcribe an English word into IPA syllables.
 * Uses CMU pronouncing dictionary when available; falls back to rule-based.
 * @param word        - original English word text
 * @param stressIndex - 0-based override for stressed syllable (used only for CMU-missing fallback)
 */
export function transcribeEnglish(word: string, stressIndex: number): EnSyllable[] {
  // ── CMU path ──────────────────────────────────────────────────────────────
  const cmu = transcribeFromCmu(word);
  if (cmu) {
    const syllables = syllabifyFromCmu(cmu);
    // Monosyllables in CMU don't always have stress=1 (e.g. function words).
    // If no syllable is marked stressed, fall back to stressIndex.
    const hasExplicitStress = syllables.some((s) => s.stressed);
    return syllables.map((s, idx) => {
      const stressed = hasExplicitStress
        ? s.stressed
        : idx === Math.min(stressIndex, syllables.length - 1);
      const lastToken = tokenizeIPA(s.ipa).at(-1) ?? '';
      return {
        ipa: s.ipa,
        stressed,
        isOpen: IPA_VOWEL_TOKENS.has(lastToken),
      };
    });
  }

  // ── Rule-based fallback ───────────────────────────────────────────────────
  const ipa = graphemesToIPA(word);
  const parts = splitIpaToSyllables(ipa);

  if (parts.length === 0) {
    return [{ ipa: ipa || word, stressed: true, isOpen: false }];
  }

  return parts.map((part, idx) => {
    const lastToken = tokenizeIPA(part).at(-1) ?? '';
    return {
      ipa: part,
      stressed: idx === stressIndex,
      isOpen: IPA_VOWEL_TOKENS.has(lastToken),
    };
  });
}
