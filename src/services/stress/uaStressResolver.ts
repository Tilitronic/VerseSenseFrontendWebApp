/**
 * UaStressResolver
 *
 * Resolves the stressed syllable for Ukrainian words using the ua-word-stress
 * DB trie and, optionally, an ML predictor for out-of-vocabulary words.
 *
 * Resolution rules
 * ─────────────────────────────────────────────────────────────────
 * 1. Monosyllable (≤ 1 vowel)  → syllable 0, confirmed automatically.
 * 2. Found in DB, unique entry → use trie stress, confirmed automatically.
 * 3. Found in DB, heteronym    → use first (trie default) stress, needs confirmation.
 * 4. Not in DB                 → run ML predictor (if provided), needs confirmation.
 * 5. No ML / ML returns null   → unresolved (syllableIndex: null, confirmed: false).
 */

import { type UaStressTrie, UA_VOWELS } from 'ua-word-stress';
import type { IMlStressPredictor, StressResolution } from './types';

/** Count the Ukrainian vowels in a (lowercased) word. */
function countVowels(word: string): number {
  let n = 0;
  for (const ch of word) {
    if (UA_VOWELS.has(ch)) n++;
  }
  return n;
}

/** Strip non-Ukrainian-letter characters (punctuation, spaces, etc.) before lookup. */
function cleanWord(word: string): string {
  // Keep Cyrillic letters and apostrophes (both kinds used in Ukrainian)
  return word.replace(/[^\u0400-\u04FF'\u2019\u02BC]/g, '');
}

/**
 * Returns true if the word contains at least one character that is
 * exclusive to Ukrainian Cyrillic and cannot appear in Russian or Belarusian.
 * Ukrainian-specific code points: і (0456), ї (0457), є (0454), ґ (0491)
 * and their uppercase equivalents.
 * A word that is pure common-Cyrillic (no UA-exclusive letters) is treated
 * as non-Ukrainian and rejected.
 */
function isUkrainianWord(word: string): boolean {
  return /[\u0404\u0406\u0407\u0490\u0454\u0456\u0457\u0491]/.test(word);
}

export class UaStressResolver {
  private readonly trie: UaStressTrie;
  private readonly ml: IMlStressPredictor | null;

  constructor(trie: UaStressTrie, ml: IMlStressPredictor | null = null) {
    this.trie = trie;
    this.ml = ml;
  }

  /**
   * Resolve the stressed syllable for `word`.
   *
   * `word` may be in any case; it is normalised internally.
   */
  async resolve(word: string): Promise<StressResolution> {
    if (!isUkrainianWord(word)) {
      return { syllableIndex: null, confirmed: false, source: 'unresolved' };
    }

    const lower = cleanWord(word).toLowerCase();
    const vowelCount = countVowels(lower);

    // ── Rule 1: monosyllable ────────────────────────────────────────────────
    if (vowelCount <= 1) {
      return { syllableIndex: 0, confirmed: true, source: 'monosyllable' };
    }

    // ── Rule 2 / 3: DB trie lookup ─────────────────────────────────────────
    const result = this.trie.lookupFull(lower);

    if (result !== null) {
      if (!result.uncertain) {
        // Unique, unambiguous entry — auto-confirmed.
        return {
          syllableIndex: result.stress,
          confirmed: true,
          source: 'db',
          stressType: 'unique',
        };
      }

      // Heteronym or variative — pick the trie's first (default) stress, require confirmation.
      const src = result.type === 'variative' ? 'variative' : 'heteronym';
      return {
        syllableIndex: result.stress,
        confirmed: false,
        source: src,
        stresses: result.stresses,
        stressType: result.type,
      };
    }

    // ── Rule 4: ML fallback ─────────────────────────────────────────────────
    if (this.ml !== null) {
      const predicted = await this.ml.predict(lower);
      if (predicted !== null) {
        const clamped = Math.max(0, Math.min(predicted, vowelCount - 1));
        return { syllableIndex: clamped, confirmed: false, source: 'ml' };
      }
    }

    // ── Rule 5: unresolved ──────────────────────────────────────────────────
    return { syllableIndex: null, confirmed: false, source: 'unresolved' };
  }

  /**
   * Synchronous resolve — skips ML (which is async).
   * Useful when you need an immediate best-guess without waiting for a model.
   */
  resolveSync(word: string): StressResolution {
    if (!isUkrainianWord(word)) {
      return { syllableIndex: null, confirmed: false, source: 'unresolved' };
    }

    const lower = cleanWord(word).toLowerCase();
    const vowelCount = countVowels(lower);

    if (vowelCount <= 1) {
      return { syllableIndex: 0, confirmed: true, source: 'monosyllable' };
    }

    const result = this.trie.lookupFull(lower);

    if (result !== null) {
      if (!result.uncertain) {
        return {
          syllableIndex: result.stress,
          confirmed: true,
          source: 'db',
          stressType: 'unique',
        };
      }
      const src = result.type === 'variative' ? 'variative' : 'heteronym';
      return {
        syllableIndex: result.stress,
        confirmed: false,
        source: src,
        stresses: result.stresses,
        stressType: result.type,
      };
    }

    return { syllableIndex: null, confirmed: false, source: 'unresolved' };
  }
}
