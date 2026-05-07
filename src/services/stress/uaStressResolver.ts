/**
 * UaStressResolver
 *
 * ML fallback for Ukrainian out-of-vocabulary words.
 *
 * The WASM batch (`uaWasmLookupBatch`) resolves all known words upfront in
 * `resolveAllStressAsync`. Any word that reaches this resolver is confirmed
 * OOV — so we go straight to the ML predictor.
 *
 * As of ua-word-stress-wasm@0.5.2 the WASM dictionary always returns a
 * prediction, even for unknown words, so monosyllables and OOV words are
 * handled there. This resolver is the secondary fallback for any word the
 * WASM batch still leaves unresolved.
 *
 * Resolution rules
 * ─────────────────────────────────────────────────────────────────
 * 1. OOV + ML available  → ML prediction, unconfirmed.
 * 2. OOV + no ML         → unresolved.
 */

import { UA_VOWELS } from 'src/services/poetryEngines/ua/consts/ua-alphabet.const';
import { normalizeUaWord } from './uaWasmService';
import type { IMlStressPredictor, StressResolution } from './types';

/** Count the Ukrainian vowels in a (lowercased) word. */
function countVowels(word: string): number {
  let n = 0;
  for (const ch of word) {
    if (UA_VOWELS.has(ch)) n++;
  }
  return n;
}

export class UaStressResolver {
  private readonly ml: IMlStressPredictor | null;

  constructor(ml: IMlStressPredictor | null = null) {
    this.ml = ml;
  }

  /**
   * Resolve the stressed syllable for an OOV word via ML.
   *
   * `word` may be in any case; it is normalised internally.
   * Pass an `AbortSignal` to cancel an in-flight ML call.
   */
  async resolve(word: string, signal?: AbortSignal): Promise<StressResolution> {
    if (signal?.aborted) {
      return { syllableIndex: null, confirmed: false, source: 'unresolved' };
    }

    const lower = normalizeUaWord(word);
    if (!lower) return { syllableIndex: null, confirmed: false, source: 'unresolved' };

    if (this.ml !== null) {
      const vowelCount = countVowels(lower);
      const predicted = await this.ml.predict(lower, signal);
      if (signal?.aborted) {
        return { syllableIndex: null, confirmed: false, source: 'unresolved' };
      }
      if (predicted !== null) {
        return {
          syllableIndex: Math.max(0, Math.min(predicted, vowelCount - 1)),
          confirmed: false,
          source: 'ml',
        };
      }
    }

    return { syllableIndex: null, confirmed: false, source: 'unresolved' };
  }
}
