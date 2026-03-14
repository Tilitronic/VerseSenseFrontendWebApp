/**
 * wordVowels.ts
 *
 * Given a word string and its language, returns the indices of vowel characters
 * within that string. Used by the stress picker to know which character slots
 * are clickable.
 */

import type { Language } from 'src/model/Language';
import { UA_VOWELS } from 'src/services/poetryEngines/ua/consts/ua-alphabet.const';

/** Polish vowels (a e i o u ó y + ą ę) */
const PL_VOWELS = new Set<string>([
  'a',
  'e',
  'i',
  'o',
  'u',
  'y',
  'ó',
  'ą',
  'ę',
  'A',
  'E',
  'I',
  'O',
  'U',
  'Y',
  'Ó',
  'Ą',
  'Ę',
]);

/**
 * English vowels — includes 'y'/'Y' because it functions as a vowel
 * in words like "my", "by", "sky", "gym", "type" (the only vowel sound).
 */
const EN_VOWELS = new Set<string>(['a', 'e', 'i', 'o', 'u', 'y', 'A', 'E', 'I', 'O', 'U', 'Y']);

function vowelSetFor(lang: Language): Set<string> {
  if (lang === 'ua') return UA_VOWELS;
  if (lang === 'pl') return PL_VOWELS;
  if (lang === 'en-us' || lang === 'en-gb') return EN_VOWELS;
  return EN_VOWELS;
}

export interface CharSlot {
  char: string;
  /** character index in the original word string */
  index: number;
  isVowel: boolean;
}

/**
 * Returns one CharSlot per character of the word, marking which are vowels.
 * Apostrophes and hyphens are included as non-vowel slots.
 */
export function getWordCharSlots(word: string, lang: Language): CharSlot[] {
  const vowels = vowelSetFor(lang);
  return Array.from(word).map((char, index) => ({
    char,
    index,
    isVowel: vowels.has(char),
  }));
}

/**
 * Count vowels in a word for a given language.
 */
export function countVowels(word: string, lang: Language): number {
  const vowels = vowelSetFor(lang);
  let n = 0;
  for (const ch of word) if (vowels.has(ch)) n++;
  return n;
}

/**
 * Returns the 0-based index of the N-th vowel (0-based) within the word string.
 * Used to map stressIndex (syllable index) → character index for highlighting.
 */
export function vowelCharIndex(word: string, lang: Language, vowelOrdinal: number): number | null {
  const vowels = vowelSetFor(lang);
  let seen = 0;
  for (let i = 0; i < word.length; i++) {
    if (vowels.has(word[i]!)) {
      if (seen === vowelOrdinal) return i;
      seen++;
    }
  }
  return null;
}
