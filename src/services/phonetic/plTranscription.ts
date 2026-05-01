/**
 * plTranscription.ts
 *
 * Polish syllabification/transcription adapter.
 *
 * Primary source of IPA is @tilitronic/polish-stress-wasm (via cached
 * stress info from plStressService). Local grapheme rules are retained only
 * as a fallback when package IPA is unavailable.
 *
 * Stress position comes from the stress service unless explicitly overridden.
 */

import { peekPolishStressInfo } from 'src/services/stress/plStressService';

export interface PlSyllable {
  ipa: string;
  text: string;
  stressed: boolean;
  isOpen: boolean;
}

// ── Digraph / trigraph rules (longest match first) ────────────────────────────
const GRAPHEME_RULES: [RegExp, string][] = [
  // Trigraphs
  [/dzi/g, 'dʑ'],
  [/dzi/gi, 'dʑ'],
  [/dżi/gi, 'dʐ'],
  // Digraphs — affricates and special clusters
  [/cz/gi, 'tʂ'],
  [/sz/gi, 'ʂ'],
  [/ch/gi, 'x'],
  [/dz/gi, 'dz'],
  [/dż/gi, 'dʐ'],
  [/dź/gi, 'dʑ'],
  [/rz/gi, 'ʐ'],
  // Single special Polish letters
  [/ą/g, 'ɔ̃'], // nasal o (before fricatives) or on+C
  [/ę/g, 'ɛ̃'], // nasal e
  [/ó/g, 'u'],
  [/ś/gi, 'ɕ'],
  [/ź/gi, 'ʑ'],
  [/ć/gi, 'tɕ'],
  [/ń/gi, 'ɲ'],
  [/ż/gi, 'ʐ'],
  [/ł/gi, 'w'],
  // Softening: consonant + i + vowel → palatal consonant
  [/si(?=[aeouąę])/gi, 'ɕ'],
  [/zi(?=[aeouąę])/gi, 'ʑ'],
  [/ci(?=[aeouąę])/gi, 'tɕ'],
  [/ni(?=[aeouąę])/gi, 'ɲ'],
];

const LETTER_IPA: Record<string, string> = {
  a: 'a',
  e: 'ɛ',
  i: 'i',
  o: 'ɔ',
  u: 'u',
  y: 'ɨ',
  b: 'b',
  c: 'ts',
  d: 'd',
  f: 'f',
  g: 'g',
  h: 'x',
  j: 'j',
  k: 'k',
  l: 'l',
  m: 'm',
  n: 'n',
  p: 'p',
  r: 'r',
  s: 's',
  t: 't',
  w: 'v',
  z: 'z',
};

// IPA vowel characters used in the output
const IPA_VOWELS = new Set(['a', 'ɛ', 'i', 'ɔ', 'u', 'ɨ', 'ɛ̃', 'ɔ̃']);

function graphemesToIPA(word: string): string {
  let s = word.toLowerCase();
  for (const [re, rep] of GRAPHEME_RULES) {
    s = s.replace(re, rep);
  }
  s = s
    .split('')
    .map((ch) => LETTER_IPA[ch] ?? ch)
    .join('');
  return s;
}

function isIPAVowelStart(ch: string): boolean {
  return IPA_VOWELS.has(ch);
}

function endsWithIpaVowel(ipa: string): boolean {
  return /(?:a|ɛ|i|ɔ|u|ɨ|ɛ̃|ɔ̃)$/.test(ipa);
}

function splitIpaToSyllables(ipa: string): string[] {
  if (!ipa) return [];

  // Collect vowel nucleus positions
  const nuclei: number[] = [];
  for (let i = 0; i < ipa.length; i++) {
    if (isIPAVowelStart(ipa[i]!)) nuclei.push(i);
  }

  if (nuclei.length === 0) return [ipa];
  if (nuclei.length === 1) {
    // Single vowel — return the whole word as one syllable
    return [ipa];
  }

  const syllables: string[] = [];
  let prev = 0;

  for (let ni = 0; ni < nuclei.length; ni++) {
    const nucStart = nuclei[ni]!;
    const nucEnd = nucStart + 1;
    const isLastVowel = ni === nuclei.length - 1;

    if (isLastVowel) {
      // Last vowel nucleus — take everything from prev to the end
      syllables.push(ipa.slice(prev));
    } else {
      const nextNuc = nuclei[ni + 1]!;
      const between = ipa.slice(nucEnd, nextNuc);

      // Consonant cluster handling: first consonant after vowel goes to coda,
      // rest go to next syllable's onset. Single consonant goes to next syllable.
      let codaEnd = nucEnd;
      if (between.length > 1) {
        // Multiple consonants: keep one in coda
        codaEnd = nucEnd + 1;
      }
      // else: single or no consonant → onset of next syllable

      syllables.push(ipa.slice(prev, codaEnd));
      prev = codaEnd;
    }
  }

  return syllables.filter((s) => s.length > 0);
}

function buildFromService(word: string, stressIndex: number): PlSyllable[] | null {
  const info = peekPolishStressInfo(word);
  if (!info || info.syllables.length === 0) return null;

  const effectiveStress =
    stressIndex >= 0 && stressIndex < info.syllables.length
      ? stressIndex
      : Math.max(0, Math.min(info.syllableIndex, info.syllables.length - 1));

  const ipaFromPackage = (info.ipa ?? '').replace(/[ˈˌ]/g, '').trim();
  const packageIpaSyllables =
    Array.isArray(info.ipaSyllables) && info.ipaSyllables.length > 0
      ? info.ipaSyllables
      : ipaFromPackage
        ? splitIpaToSyllables(ipaFromPackage)
        : [];

  return info.syllables.map((part, idx) => {
    const ipa = packageIpaSyllables[idx] ?? graphemesToIPA(part) ?? part;
    return {
      ipa,
      text: part,
      stressed: idx === effectiveStress,
      isOpen: endsWithIpaVowel(ipa),
    };
  });
}

/**
 * Transcribe a Polish word into syllables with IPA.
 * Stress is always penultimate; stressIndex parameter overrides this
 * (for cases where the user has manually marked stress).
 * @param word        - original Polish word text
 * @param stressIndex - 0-based index; pass -1 to use penultimate rule
 */
export function transcribePolish(word: string, stressIndex: number): PlSyllable[] {
  const serviceSyllables = buildFromService(word, stressIndex);
  if (serviceSyllables) return serviceSyllables;

  const ipa = graphemesToIPA(word);
  if (!ipa || ipa.length === 0) {
    return [{ ipa: word, text: word, stressed: true, isOpen: false }];
  }

  const parts = splitIpaToSyllables(ipa);

  if (parts.length === 0) {
    return [{ ipa: ipa || word, text: word, stressed: true, isOpen: false }];
  }

  // Default: penultimate stress
  const effectiveStress =
    stressIndex >= 0 && stressIndex < parts.length ? stressIndex : Math.max(0, parts.length - 2);

  return parts.map((part, idx) => ({
    ipa: part,
    text: part,
    stressed: idx === effectiveStress,
    isOpen: endsWithIpaVowel(part),
  }));
}
