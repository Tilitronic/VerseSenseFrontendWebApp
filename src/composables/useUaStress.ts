/**
 * useUaStress — Vue composable
 *
 * Manages the Luscinia ML resolver singleton for Ukrainian OOV words.
 * WASM init is also triggered here so the ua-word-stress-wasm dictionary is
 * ready as early as possible.
 *
 * The WASM binary resolves stress, IPA, and syllabification for the vast
 * majority of words upfront in a single batch call; Luscinia handles OOV.
 *
 * Usage:
 *   const { resolver, loading, error } = useUaStress();
 */

import { ref, shallowRef, readonly, markRaw } from 'vue';
import { initUaWasm } from 'src/services/stress/uaWasmService';
import { UaStressResolver } from 'src/services/stress/uaStressResolver';
import type { IMlStressPredictor } from 'src/services/stress/types';
import { trieLog } from 'src/services/logging';

// ── Module-level singletons (shared across all composable calls) ──────────────

const _resolver = shallowRef<UaStressResolver | null>(null);
const _loading = ref(false);
const _error = ref<Error | null>(null);
let _initPromise: Promise<void> | null = null;

/**
 * Kick off WASM initialisation. Called by the boot file so it starts early.
 * Subsequent calls return the same promise.
 */
export async function initUaStress(ml: IMlStressPredictor | null = null): Promise<void> {
  if (_resolver.value !== null || _initPromise !== null) return _initPromise ?? Promise.resolve();

  _loading.value = true;
  _error.value = null;
  trieLog.debug('ua-word-stress-wasm: starting WASM init');

  _initPromise = initUaWasm()
    .then(() => {
      _resolver.value = markRaw(new UaStressResolver(ml));
    })
    .catch((err: unknown) => {
      _error.value = err instanceof Error ? err : new Error(String(err));
      trieLog.error('ua-word-stress-wasm init FAILED', err);
      _initPromise = null; // allow retry
    })
    .finally(() => {
      _loading.value = false;
    });

  return _initPromise;
}

/**
 * Returns reactive state for the shared ML stress resolver.
 */
export function useUaStress() {
  return {
    /** The ML resolver; null while loading or on error. */
    resolver: readonly(_resolver),
    /** True while the WASM module is initialising. */
    loading: readonly(_loading),
    /** Set if initialisation failed. */
    error: readonly(_error),
    /** Trigger initialisation (idempotent). */
    init: initUaStress,
  };
}
