/**
 * Type declaration for the untyped `ipa-symbols` npm package.
 * The package exports plain arrays of consonant/vowel data objects.
 */
declare module 'ipa-symbols/ipa_symbols.js' {
  export interface RawConsonantEntry {
    symbol: string;
    place: string;
    manner: string;
    voiced: boolean;
    url: string;
  }

  export interface RawVowelEntry {
    symbol: string;
    height: string;
    backness: string;
    roundedness?: string;
    url: string;
  }

  export const CONSONANTS: RawConsonantEntry[];
  export const VOWELS: RawVowelEntry[];
  export const places: string[];
  export const manners: string[];
  export const heights: string[];
  export const backnesses: string[];
}
