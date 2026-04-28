/**
 * useStressTrie — Vue composable
 *
 * Manages a singleton UaStressTrie instance with reactive loading state.
 * The trie is shared across all callers (module-level singletons).
 *
 * Usage:
 *   const { resolver, loading, error } = useStressTrie();
 */

import { ref, shallowRef, readonly, markRaw } from 'vue';
import { UaStressTrie } from 'ua-word-stress';
import { UaStressResolver } from 'src/services/stress/uaStressResolver';
import type { IMlStressPredictor } from 'src/services/stress/types';

// Import the trie data file as a URL so Vite handles it as a static asset.
// In dev, Vite resolves this to /@fs/...ctrie.gz (served from node_modules).
// In production, Vite copies it to the dist/assets folder (content-hashed).
// ua-word-stress must be in optimizeDeps.exclude (quasar.config.ts) so Vite
// does not pre-bundle it, which would break the ?url asset import.
import trieUrl from 'ua-word-stress/data/ua_stress.ctrie.gz?url';

// ── Module-level singletons (shared across all composable calls) ──────────────

const _resolver = shallowRef<UaStressResolver | null>(null);
const _loading = ref(false);
const _error = ref<Error | null>(null);
let _initPromise: Promise<void> | null = null;

/**
 * Fetch and decompress the trie file, bypassing the deadlock in
 * UaStressTrie.fromUrl() which writes all compressed bytes then tries to close
 * the writer before reading — blocking forever when backpressure fills the
 * DecompressionStream buffer on large files (~80 MB decompressed).
 *
 * Strategy:
 * - If server sends Content-Encoding: gzip the browser has already decompressed;
 *   pass the buffer straight to fromBuffer().
 * - Otherwise pipe resp.body through DecompressionStream — this connects the
 *   readable and writable streams concurrently so backpressure flows correctly.
 */
async function _fetchAndParseTrie(url: string): Promise<InstanceType<typeof UaStressTrie>> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`[useStressTrie] HTTP ${resp.status} fetching ${url}`);

  const contentEncoding = resp.headers.get('content-encoding');
  if (contentEncoding?.toLowerCase().includes('gzip')) {
    // Browser transparently decompressed — buffer is already raw ctrie bytes.
    const buf = await resp.arrayBuffer();
    return UaStressTrie.fromBuffer(buf);
  }

  // Server sent raw gzip bytes. Use streaming decompression to avoid deadlock.
  if (!resp.body) throw new Error('[useStressTrie] Response body is null');
  const decompressed = resp.body.pipeThrough(new DecompressionStream('gzip'));
  const buf = await new Response(decompressed).arrayBuffer();
  return UaStressTrie.fromBuffer(buf);
}

/**
 * Kick off trie loading. Called by the boot file so it starts early.
 * Subsequent calls return the same promise.
 */
export async function initStressTrie(ml: IMlStressPredictor | null = null): Promise<void> {
  if (_resolver.value !== null || _initPromise !== null) return _initPromise ?? Promise.resolve();

  _loading.value = true;
  _error.value = null;
  console.debug('[useStressTrie] starting trie load from:', trieUrl);

  // Diagnostic: check response headers so we can detect Netlify transparent
  // gzip-encoding the .gz file (Content-Encoding: gzip → browser decompresses →
  // DecompressionStream inside ua-word-stress receives raw bytes → hang).
  void fetch(trieUrl, { method: 'HEAD' })
    .then((r) =>
      console.debug('[useStressTrie] HEAD response:', {
        status: r.status,
        ok: r.ok,
        contentType: r.headers.get('content-type'),
        contentEncoding: r.headers.get('content-encoding'),
        contentLength: r.headers.get('content-length'),
        cacheControl: r.headers.get('cache-control'),
      }),
    )
    .catch((e) => console.warn('[useStressTrie] HEAD request failed:', e));

  // Race trie load against a timeout so a silent hang is surfaced in the logs.
  const _trieLoad = Promise.race([
    _fetchAndParseTrie(trieUrl),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('[useStressTrie] trie load timed out after 30 s')), 30_000),
    ),
  ]);

  _initPromise = _trieLoad
    .then((trie) => {
      console.debug('[useStressTrie] trie loaded successfully, wordCount =', trie.wordCount);
      _resolver.value = markRaw(new UaStressResolver(trie, ml));
    })
    .catch((err: unknown) => {
      _error.value = err instanceof Error ? err : new Error(String(err));
      console.error('[useStressTrie] trie load FAILED — trieUrl was:', trieUrl, err);
      _initPromise = null; // allow retry
      return; // ensure catch handler returns void, not null
    })
    .finally(() => {
      _loading.value = false;
    });

  return _initPromise;
}

/**
 * Returns reactive state for the shared stress trie/resolver.
 */
export function useStressTrie() {
  return {
    /** The resolver; null while loading or on error. */
    resolver: readonly(_resolver),
    /** True while the trie data file is being fetched and parsed. */
    loading: readonly(_loading),
    /** Set if loading failed. */
    error: readonly(_error),
    /** Trigger loading (idempotent). */
    init: initStressTrie,
  };
}
