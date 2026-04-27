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

// Must be set before any InferenceSession is created.
const ORT_WASM_PATH: string =
  (import.meta.env.VITE_ORT_WASM_PATH as string | undefined) ??
  'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/';
console.debug('[LusciniaWorker] setting ort.env.wasm.wasmPaths =', ORT_WASM_PATH);
ort.env.wasm.wasmPaths = ORT_WASM_PATH;

let predictorPromise: Promise<LusciniaPredictor> | null = null;
let currentModelUrl = '';

function getPredictor(modelUrl: string): Promise<LusciniaPredictor> {
  if (predictorPromise && currentModelUrl === modelUrl) {
    console.debug('[LusciniaWorker] reusing cached predictor for', modelUrl);
    return predictorPromise;
  }
  console.debug('[LusciniaWorker] loading model from', modelUrl);
  currentModelUrl = modelUrl;
  predictorPromise = LusciniaPredictor.fromUrl(modelUrl, ort)
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

self.onmessage = async (e: MessageEvent<{ id: string; word: string; modelUrl: string }>) => {
  const { id, word, modelUrl } = e.data;
  console.debug(`[LusciniaWorker] received msg id=${id} word="${word}"`);
  try {
    const predictor = await getPredictor(modelUrl);
    const result = await predictor.predict(word);
    console.debug(`[LusciniaWorker] id=${id} word="${word}" -> vowelIdx=${result}`);
    self.postMessage({ id, result });
  } catch (err) {
    console.error(`[LusciniaWorker] inference error id=${id} word="${word}":`, err);
    self.postMessage({ id, result: null, error: String(err) });
  }
};
