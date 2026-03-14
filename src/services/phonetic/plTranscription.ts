/**
 * plTranscription.ts
 *
 * Polish grapheme-to-IPA syllabification.
 * Polish orthography is highly phonemic (~90% predictable), making rule-based
 * transcription reliable for poetry analysis.
 *
 * Stress: always falls on the PENULTIMATE syllable (with very rare exceptions).
 */

export interface PlSyllable {
  ipa: string;
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

function splitIpaToSyllables(ipa: string): string[] {
  if (!ipa) return [];

  // Collect vowel nucleus positions (single-char vowels for simplicity)
  const nuclei: number[] = [];
  for (let i = 0; i < ipa.length; i++) {
    if (isIPAVowelStart(ipa[i]!)) nuclei.push(i);
  }

  if (nuclei.length === 0) return [ipa];

  const syllables: string[] = [];
  let prev = 0;

  for (let ni = 0; ni < nuclei.length; ni++) {
    const nucStart = nuclei[ni]!;
    const nucEnd = nucStart + 1;
    const nextNuc = nuclei[ni + 1] ?? ipa.length;
    const between = ipa.slice(nucEnd, nextNuc);

    let codaEnd: number;
    if (ni < nuclei.length - 1) {
      codaEnd = between.length > 1 ? nucEnd + 1 : nucEnd;
    } else {
      codaEnd = ipa.length;
    }

    syllables.push(ipa.slice(prev, codaEnd));
    prev = codaEnd;
  }

  return syllables.filter((s) => s.length > 0);
}

/**
 * Transcribe a Polish word into syllables with IPA.
 * Stress is always penultimate; stressIndex parameter overrides this
 * (for cases where the user has manually marked stress).
 * @param word        - original Polish word text
 * @param stressIndex - 0-based index; pass -1 to use penultimate rule
 */
export function transcribePolish(word: string, stressIndex: number): PlSyllable[] {
  const ipa = graphemesToIPA(word);
  const parts = splitIpaToSyllables(ipa);

  if (parts.length === 0) {
    return [{ ipa: ipa || word, stressed: true, isOpen: false }];
  }

  // Default: penultimate stress
  const effectiveStress =
    stressIndex >= 0 && stressIndex < parts.length ? stressIndex : Math.max(0, parts.length - 2);

  return parts.map((part, idx) => ({
    ipa: part,
    stressed: idx === effectiveStress,
    isOpen: isIPAVowelStart(part[part.length - 1] ?? ''),
  }));
}
