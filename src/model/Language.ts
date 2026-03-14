/**
 * Language.ts
 *
 * Supported language identifiers for phonetic engine selection.
 * These are the languages VerseSense can phonetize.
 */

export type Language = 'ua' | 'pl' | 'en-us' | 'en-gb';

export const LANGUAGES: Language[] = ['ua', 'pl', 'en-us', 'en-gb'];

export const DEFAULT_LANGUAGE: Language = 'ua';

/** Human-readable label + flag emoji for UI display */
export const LANGUAGE_META: Record<Language, { label: string; flag: string }> = {
  ua: { label: 'Ukrainian', flag: '🇺🇦' },
  pl: { label: 'Polish', flag: '🇵🇱' },
  'en-us': { label: 'English (US)', flag: '🇺🇸' },
  'en-gb': { label: 'English (GB)', flag: '🇬🇧' },
};
