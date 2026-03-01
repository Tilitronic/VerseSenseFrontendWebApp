/**
 * vowelAllophonePass.ts — Pass 4: Stress-aware vowel allophone selection
 *
 * Ukrainian has 6 vowel phonemes. In unstressed positions:
 * - /ɛ/ → [ɛ̝] (pulls toward /ɪ/)
 * - /ɪ/ → [ɪ̞] (pulls toward /ɛ/)
 * - /ɔ/ → [ɔ̝] (narrows toward /u/) ONLY before stressed /u/ or /i/
 * - /i/, /u/, /ɑ/ are stable — no change
 *
 * This pass also assigns the `stressed` flag on the correct vowel token.
 *
 * Sources: Савченко 2014, Мойсієнко 2010, Тоцька 1997.
 */

import type { PhoneticToken } from './types';

// ── Constants ───────────────────────────────────────────────────────────────

/** High vowel IPAs that trigger /ɔ/ narrowing when stressed in a following syllable */
const HIGH_VOWELS = new Set(['u', 'i']);

/** Allophone mappings */
const UNSTRESSED_E = 'ɛ̝';  // [еи] — е pulling toward и
const UNSTRESSED_Y = 'ɪ̞';  // [ие] — и pulling toward е
const UNSTRESSED_O_BEFORE_HIGH = 'ɔ̝'; // [оу] — о narrowing toward у

// ── Pass implementation ─────────────────────────────────────────────────────

/**
 * Apply stress assignment and vowel allophone rules.
 *
 * @param tokens - The token array (modified in place)
 * @param stressedVowelIndex - 0-based index of the stressed vowel in the word
 *                             (among vowels only, not all tokens)
 */
export function applyVowelAllophones(
  tokens: PhoneticToken[],
  stressedVowelIndex: number,
): void {
  // ── Step 1: Assign stress flag ──────────────────────────────────────────
  for (const tok of tokens) {
    if (tok.type === 'vowel') {
      tok.stressed = tok.vowelIndex === stressedVowelIndex;
    }
  }

  // ── Step 2: Find stressed vowel IPA (for /ɔ/ rule) ─────────────────────
  const stressedToken = tokens.find(
    (t) => t.type === 'vowel' && t.vowelIndex === stressedVowelIndex,
  );
  const stressedIpa = stressedToken?.ipa ?? '';

  // ── Step 3: Apply allophone rules to unstressed vowels ──────────────────
  for (const tok of tokens) {
    if (tok.type !== 'vowel') continue;
    if (tok.stressed) continue; // stressed vowels stay as-is

    switch (tok.ipa) {
      case 'ɛ':
        // Unstressed /е/ → [ɛ̝] (pulls toward и)
        tok.ipa = UNSTRESSED_E;
        if (tok.vowelFeatures) {
          tok.vowelFeatures = {
            ...tok.vowelFeatures,
            height: 'high-mid', // shifted up from mid
            stable: false,
          };
        }
        break;

      case 'ɪ':
        // Unstressed /и/ → [ɪ̞] (pulls toward е)
        tok.ipa = UNSTRESSED_Y;
        if (tok.vowelFeatures) {
          tok.vowelFeatures = {
            ...tok.vowelFeatures,
            height: 'mid', // shifted down from high-mid
            stable: false,
          };
        }
        break;

      case 'ɔ':
        // Unstressed /о/ → [ɔ̝] only if the stressed vowel is high (/у/ or /і/)
        if (
          tok.vowelIndex < stressedVowelIndex &&
          HIGH_VOWELS.has(stressedIpa)
        ) {
          tok.ipa = UNSTRESSED_O_BEFORE_HIGH;
          if (tok.vowelFeatures) {
            tok.vowelFeatures = {
              ...tok.vowelFeatures,
              height: 'high-mid', // narrowed toward у
              stable: false,
            };
          }
        }
        break;

      // /i/, /u/, /ɑ/ — stable, no change
      default:
        break;
    }
  }
}
