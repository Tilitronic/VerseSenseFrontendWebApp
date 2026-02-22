/**
 * wordScript.ts
 *
 * Determines which script a word is written in so the UI can:
 *   - Hide Cyrillic language options for Latin-script words
 *   - Hide Latin language options for Cyrillic-script words
 *   - Lock Polish when PL diacritics are detected
 *   - Lock Ukrainian when UA-exclusive Cyrillic chars are detected
 *
 * "Lock" means: auto-assign the language without showing other options.
 */

import type { Language } from 'src/model/Language';

const CYRILLIC         = /[\u0400-\u04FF]/;
const LATIN            = /[a-zA-Z\u00C0-\u024F]/;          // basic + extended
const UA_EXCLUSIVE     = /[єїґ]/i;                          // never in RU/BG
const UA_I             = /і/g;                               // U+0456
const PL_EXCLUSIVE     = /[ąćęłńóśźż]/i;

export type WordScript = 'cyrillic' | 'latin' | 'mixed' | 'other';

export interface WordScriptInfo {
  script: WordScript;
  /**
   * If non-null the language is unambiguously determined by the script/chars
   * and the UI should NOT offer other choices — just display this as locked.
   */
  lockedLanguage: Language | null;
  /** Languages the user may legitimately choose (empty = use lockedLanguage) */
  allowedLanguages: Language[];
}

export function getWordScriptInfo(word: string): WordScriptInfo {
  const hasCyrillic = CYRILLIC.test(word);
  const hasLatin    = LATIN.test(word);

  // Mixed script — unusual; allow everything
  if (hasCyrillic && hasLatin) {
    return { script: 'mixed', lockedLanguage: null, allowedLanguages: ['ua', 'pl', 'en-us', 'en-gb'] };
  }

  // ── Cyrillic ──────────────────────────────────────────────────────────────
  if (hasCyrillic) {
    // UA-exclusive letters → definitely Ukrainian
    if (UA_EXCLUSIVE.test(word)) {
      return { script: 'cyrillic', lockedLanguage: 'ua', allowedLanguages: [] };
    }
    // Multiple UA-і → strong UA signal
    const iCount = (word.match(UA_I) ?? []).length;
    if (iCount >= 2) {
      return { script: 'cyrillic', lockedLanguage: 'ua', allowedLanguages: [] };
    }
    // Cyrillic but ambiguous → only Cyrillic-language options (we only support UA)
    return { script: 'cyrillic', lockedLanguage: null, allowedLanguages: ['ua'] };
  }

  // ── Latin ─────────────────────────────────────────────────────────────────
  if (hasLatin) {
    // Polish diacritics → definitely Polish
    if (PL_EXCLUSIVE.test(word)) {
      return { script: 'latin', lockedLanguage: 'pl', allowedLanguages: [] };
    }
    // Plain Latin → English or Polish
    return { script: 'latin', lockedLanguage: null, allowedLanguages: ['pl', 'en-us', 'en-gb'] };
  }

  // Punctuation / numbers / other
  return { script: 'other', lockedLanguage: null, allowedLanguages: [] };
}
