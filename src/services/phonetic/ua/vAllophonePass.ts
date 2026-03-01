/**
 * vAllophonePass.ts — Pass 5: Positional allophones of /в/
 *
 * Ukrainian /в/ has three positional allophones:
 * - [ʋ] — default: before vowels, word-initial before consonant
 * - [w] — after a vowel, before a consonant (bilabial approximant)
 * - [u̯] — word-final after a vowel (non-syllabic u)
 *
 * Examples:
 *   вода    → [ʋɔdɑ]      (before vowel → ʋ default)
 *   правда  → [prɑwdɑ]    (after vowel, before consonant → w)
 *   кров    → [krɔu̯]      (word-final after vowel → u̯)
 *   вправо  → [ʋprɑwɔ]    (word-initial before consonant → ʋ; after vowel before consonant → w)
 *   вклад   → [ʋklɑd]     (word-initial before consonant → ʋ)
 *
 * Note: /в/ after a consonant before a vowel stays [ʋ] (default).
 *
 * Sources: graphemes.json vAllophones section.
 */

import type { PhoneticToken } from './types';
import graphemeData from './data/graphemes';

const vAllophones = graphemeData.vAllophones;
const V_DEFAULT = vAllophones.default; // ʋ
const V_POST_VOCALIC_PRE_C = vAllophones.postVocalicPreConsonantal; // w
const V_WORD_FINAL = vAllophones.wordFinalPostVocalic; // u̯

// ── Helpers ─────────────────────────────────────────────────────────────────

function isVowelToken(t: PhoneticToken | undefined): boolean {
  return t?.type === 'vowel';
}

function isConsonantLike(t: PhoneticToken | undefined): boolean {
  if (!t) return false;
  return t.type === 'consonant' || t.type === 'glide' || t.type === 'glottal';
}

// ── Pass implementation ─────────────────────────────────────────────────────

/**
 * Apply positional allophone rules for /в/.
 *
 * @param tokens - The token array (modified in place)
 */
export function applyVAllophones(tokens: PhoneticToken[]): void {
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!;

    // Only process tokens whose base IPA is /ʋ/ (в)
    if (tok.ipa !== V_DEFAULT) continue;

    const prev = tokens[i - 1];
    const next = tokens[i + 1];

    // ── Rule 1: word-final after vowel → [u̯] ──────────────────────────
    if (!next && prev && isVowelToken(prev)) {
      tok.ipa = V_WORD_FINAL;
      tok.type = 'glide'; // non-syllabic vowel-like
      tok.consonantFeatures = null;
      continue;
    }

    // ── Rule 2: after vowel, before consonant → [w] ───────────────────
    if (prev && isVowelToken(prev) && next && isConsonantLike(next)) {
      tok.ipa = V_POST_VOCALIC_PRE_C;
      tok.type = 'glide';
      tok.consonantFeatures = null;
      continue;
    }

    // ── Rule 3: all other positions → [ʋ] (default, no change needed) ─
    // This includes: word-initial, before vowel, after consonant, etc.
  }
}
