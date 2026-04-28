/**
 * lusciniaWorker.ts — Web Worker for Luscinia ONNX inference.
 *
 * Uses LusciniaPredictor from ua-stress-ml which handles model loading,
 * decompression, and ONNX inference internally.
 *
 * ua-stress-ml is excluded from Vite's dep pre-bundler (see quasar.config.ts
 * optimizeDeps.exclude) so the live dist/index.js is always used.
 *
 * Message protocol:
 *   IN:  { id: string; word: string; modelUrl: string }
 *   OUT: { id: string; result: number | null; error?: string }
 */

import * as ort from 'onnxruntime-web';
import { LusciniaPredictor } from 'ua-stress-ml';

console.debug('[LusciniaWorker] module loaded');

// Guard: SharedArrayBuffer is required by the onnxruntime-web threaded WASM backend.
// It is only available when the page is served with Cross-Origin-Opener-Policy: same-origin
// and Cross-Origin-Embedder-Policy: require-corp.
if (typeof SharedArrayBuffer === 'undefined') {
  console.error(
    '[LusciniaWorker] SharedArrayBuffer is NOT available. ' +
      'The page must be served with COOP: same-origin + COEP: require-corp ' +
      'for onnxruntime-web to work. ML stress prediction is disabled.',
  );
}

// In dev, onnxruntime-web is excluded from Vite pre-bundling and served from
// node_modules via /@fs/. Its dynamic .mjs glue imports resolve relative to
// their own location — Vite serves them untransformed. No wasmPaths needed.
//
// In production, ort is bundled into the worker chunk and constructs absolute
// URLs for glue imports. Point it to /ort/ where the files are static assets
// (copied from node_modules into public/ort/ — see public/ort/).
if (import.meta.env.PROD) {
  ort.env.wasm.wasmPaths = '/ort/';
  console.debug('[LusciniaWorker] PROD — ort.env.wasm.wasmPaths = /ort/');

  // Diagnostic: check which WASM binaries are actually reachable at /ort/.
  // numThreads=1 may cause ort to load the non-threaded binary (ort-wasm-simd.wasm)
  // instead of ort-wasm-simd-threaded.wasm — if that file is missing we get a
  // 200 HTML SPA-fallback response which is not valid WASM → silent hang.
  const wasmCandidates = [
    'ort-wasm-simd-threaded.wasm',
    'ort-wasm-simd.wasm',
    'ort-wasm.wasm',
    'ort-wasm-simd-threaded.mjs',
  ];
  for (const f of wasmCandidates) {
    void fetch(`/ort/${f}`, { method: 'HEAD' })
      .then((r) =>
        console.debug(
          `[LusciniaWorker] /ort/${f} →`,
          r.status,
          r.ok ? 'OK' : 'MISSING/ERROR',
          'content-type:',
          r.headers.get('content-type'),
        ),
      )
      .catch((e) => console.error(`[LusciniaWorker] HEAD /ort/${f} failed:`, e));
  }
} else {
  console.debug('[LusciniaWorker] DEV — using default ort WASM path resolution');
}

// Force single-threaded WASM backend:
// 1. Avoids spawning sub-workers from inside a worker (can deadlock in some browsers).
// 2. Skips the JSEP (WebGPU) backend whose dynamic import hangs in Vite dev mode
//    when ort is excluded from pre-bundling (import resolves to /@fs/ path, Vite
//    queues a transform that never completes — causing getPredictor() to hang forever).
// The LightGBM model is small and fast; single-threaded WASM is more than sufficient.
ort.env.wasm.numThreads = 1;
console.debug('[LusciniaWorker] numThreads=1, executionProviders=[wasm]');

// Options forwarded to InferenceSession.create — skip all non-WASM backends.
// Typed as plain object (not ort.InferenceSession.SessionOptions) so it is
// assignable to LusciniaOptions, which expects a mutable string[] for executionProviders.
const ORT_SESSION_OPTIONS = {
  executionProviders: ['wasm'] as string[],
};

let predictorPromise: Promise<LusciniaPredictor> | null = null;
let currentModelUrl = '';

// Serialize inference — ONNX WASM cannot handle concurrent session.run() calls.
// Each incoming message is chained onto this promise so they execute one at a time.
let _inferenceQueue: Promise<void> = Promise.resolve();

function getPredictor(modelUrl: string): Promise<LusciniaPredictor> {
  if (predictorPromise && currentModelUrl === modelUrl) {
    return predictorPromise;
  }
  console.debug('[LusciniaWorker] loading model from', modelUrl);
  currentModelUrl = modelUrl;
  predictorPromise = Promise.race([
    LusciniaPredictor.fromUrl(modelUrl, ort, ORT_SESSION_OPTIONS),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('[LusciniaWorker] model load timed out after 30 s')),
        30_000,
      ),
    ),
  ])
    .then((p) => {
      console.debug('[LusciniaWorker] model loaded successfully');
      return p;
    })
    .catch((err) => {
      console.error('[LusciniaWorker] model load failed:', err);
      predictorPromise = null;
      throw err;
    });
  return predictorPromise;
}

type WorkerInboundMessage =
  | { type: 'warmup'; modelUrl: string }
  | { type: 'infer'; id: string; word: string; modelUrl: string };

self.onmessage = (e: MessageEvent<WorkerInboundMessage>) => {
  const msg = e.data;

  if (msg.type === 'warmup') {
    // Pre-load the model so it is compiled and cached before any predict() arrives.
    // Runs outside the inference queue — sends ready/error back to main thread.
    console.debug('[LusciniaWorker] warmup — pre-loading model from', msg.modelUrl);
    void getPredictor(msg.modelUrl)
      .then(() => {
        console.debug('[LusciniaWorker] warmup complete — model ready');
        self.postMessage({ type: 'ready' });
      })
      .catch((err) => {
        console.error('[LusciniaWorker] warmup failed:', err);
        self.postMessage({ type: 'error', error: String(err) });
      });
    return;
  }

  const { id, word, modelUrl } = msg;
  console.debug(`[LusciniaWorker] infer id=${id} word="${word}"`);

  // Chain each inference onto the queue — guarantees serial execution.
  _inferenceQueue = _inferenceQueue.then(async () => {
    try {
      const predictor = await getPredictor(modelUrl);
      const result = await predictor.predict(word);
      console.debug(`[LusciniaWorker] id=${id} word="${word}" -> vowelIdx=${result}`);
      self.postMessage({ id, result });
    } catch (err) {
      console.error(`[LusciniaWorker] inference error id=${id} word="${word}":`, err);
      self.postMessage({ id, result: null, error: String(err) });
    }
  });
};
