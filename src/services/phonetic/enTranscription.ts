/**
 * enTranscription.ts
 *
 * English grapheme-to-IPA syllabification.
 * Strategy: rule-based grapheme clusters → IPA approximation, then split on vowels.
 * Covers the most common patterns well enough for poetry stress/syllable display.
 */

export interface EnSyllable {
  /** IPA phonetic string for this syllable */
  ipa: string;
  /** Whether this syllable is stressed */
  stressed: boolean;
  /** Whether this syllable ends with a vowel (open) */
  isOpen: boolean;
}

// ── Digraph / trigraph replacements (order matters — longer first) ────────────
const GRAPHEME_RULES: [RegExp, string][] = [
  // Trigraphs
  [/tch/g,  'tʃ'],
  [/sch/g,  'ʃ'],
  // Digraphs — consonant clusters
  [/ph/g,   'f'],
  [/ch/g,   'tʃ'],
  [/sh/g,   'ʃ'],
  [/th/g,   'ð'],  // default voiced; voiceless in "think" but voiced more common in poetry
  [/wh/g,   'w'],
  [/gh/g,   ''],   // silent in "night", "light"
  [/ng/g,   'ŋ'],
  [/nk/g,   'ŋk'],
  [/qu/g,   'kw'],
  [/ck/g,   'k'],
  [/dg/g,   'dʒ'],
  [/ge/g,   'dʒ'],
  [/gi/g,   'dʒ'],
  // Digraphs — vowels
  [/ee/g,   'iː'],
  [/ea/g,   'iː'],
  [/oo/g,   'uː'],
  [/ou/g,   'aʊ'],
  [/ow/g,   'aʊ'],
  [/oi/g,   'ɔɪ'],
  [/oy/g,   'ɔɪ'],
  [/au/g,   'ɔː'],
  [/aw/g,   'ɔː'],
  [/ai/g,   'eɪ'],
  [/ay/g,   'eɪ'],
  [/igh/g,  'aɪ'],
  [/ie/g,   'iː'],
  // Magic-e patterns (very common): vowel + consonant(s) + e
  [/a([bcdfghjklmnpqrstvwxyz])e\b/gi, 'eɪ$1'],
  [/i([bcdfghjklmnpqrstvwxyz])e\b/gi, 'aɪ$1'],
  [/o([bcdfghjklmnpqrstvwxyz])e\b/gi, 'oʊ$1'],
  [/u([bcdfghjklmnpqrstvwxyz])e\b/gi, 'juː$1'],
  // Single vowels (context-free approximation)
  [/\ba\b/g,  'ə'],   // "a" as article
  [/\bthe\b/g,'ðə'],
  // Simple vowel maps (fall-through for remaining letters)
];

// Single-letter IPA approximations (applied after digraph rules)
const LETTER_IPA: Record<string, string> = {
  a: 'æ', e: 'ɛ', i: 'ɪ', o: 'ɒ', u: 'ʌ',
  y: 'ɪ',
  b: 'b', c: 'k', d: 'd', f: 'f', g: 'g',
  h: 'h', j: 'dʒ', k: 'k', l: 'l', m: 'm',
  n: 'n', p: 'p', q: 'k', r: 'r', s: 's',
  t: 't', v: 'v', w: 'w', x: 'ks', z: 'z',
};

// IPA symbols that are vowel nuclei for splitting
const IPA_VOWELS_RE = /[æɛɪɒʌaeiouɑɔəɜʊuː]+/;

function graphemesToIPA(word: string): string {
  let s = word.toLowerCase();
  for (const [re, rep] of GRAPHEME_RULES) {
    s = s.replace(re, rep);
  }
  // Map remaining plain letters
  s = s.split('').map((ch) => LETTER_IPA[ch] ?? ch).join('');
  return s;
}

/**
 * Split an IPA string into syllable strings.
 * Simple rule: each vowel cluster is a nucleus; consonants before it are onset,
 * consonants after it are coda (shared with next onset by one).
 */
function splitIpaToSyllables(ipa: string): string[] {
  if (!ipa) return [];

  // Find positions of vowel nuclei
  const nuclei: number[] = [];
  let i = 0;
  while (i < ipa.length) {
    const sub = ipa.slice(i);
    const m = sub.match(/^[æɛɪɒʌaeiouɑɔəɜʊuː]+/);
    if (m) {
      nuclei.push(i);
      i += m[0].length;
    } else {
      i++;
    }
  }

  if (nuclei.length === 0) return [ipa]; // no vowels — whole word is one syllable

  const syllables: string[] = [];
  let prev = 0;

  for (let ni = 0; ni < nuclei.length; ni++) {
    const nucStart = nuclei[ni]!;

    // Find end of this nucleus
    const afterNuc = ipa.slice(nucStart).match(/^[æɛɪɒʌaeiouɑɔəɜʊuː]+/);
    const nucEnd = nucStart + (afterNuc ? afterNuc[0].length : 1);

    // Find end of coda (consonants after nucleus, until next nucleus or end)
    const nextNucStart = nuclei[ni + 1] ?? ipa.length;
    const betweenConsonants = ipa.slice(nucEnd, nextNucStart);

    let codaEnd: number;
    if (ni < nuclei.length - 1) {
      // Single consonant → onset of next; cluster → split 1 to coda, rest to next onset
      codaEnd = betweenConsonants.length > 1 ? nucEnd + 1 : nucEnd;
    } else {
      codaEnd = ipa.length; // last syllable takes all trailing consonants
    }

    syllables.push(ipa.slice(prev, codaEnd));
    prev = codaEnd;
  }

  return syllables.filter((s) => s.length > 0);
}

/**
 * Transcribe an English word into syllables with IPA.
 * @param word        - original English word text
 * @param stressIndex - 0-based index of stressed syllable
 */
export function transcribeEnglish(word: string, stressIndex: number): EnSyllable[] {
  const ipa = graphemesToIPA(word);
  const parts = splitIpaToSyllables(ipa);

  if (parts.length === 0) {
    return [{ ipa: ipa || word, stressed: true, isOpen: false }];
  }

  return parts.map((part, idx) => ({
    ipa:      part,
    stressed: idx === stressIndex,
    isOpen:   IPA_VOWELS_RE.test(part[part.length - 1] ?? ''),
  }));
}
