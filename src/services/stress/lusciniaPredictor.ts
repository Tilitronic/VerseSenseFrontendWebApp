/**
 * LusciniaPredictor — main-thread proxy for the Luscinia ONNX predictor.
 *
 * All ONNX inference runs in a dedicated Web Worker so the UI thread is
 * never blocked. The ua-stress-ml package provides the actual model logic.
 */

import type { IMlStressPredictor } from './types';

/** Human-readable display name shown in UI tooltips. */
export const LUSCINIA_MODEL_DISPLAY = 'Luscinia LGBMv1';
export const LUSCINIA_REPO_URL = 'https://github.com/Tilitronic/ua-stress-engine';

type WorkerInferResult = { id: string; result: number | null; error?: string };
type WorkerControlMessage = { type: 'ready' } | { type: 'error'; error: string };
type WorkerOutboundMessage = WorkerInferResult | WorkerControlMessage;

function isControlMessage(m: WorkerOutboundMessage): m is WorkerControlMessage {
  return 'type' in m;
}

export class LusciniaPredictor implements IMlStressPredictor {
  private readonly modelUrl: string;
  private worker: Worker | null = null;
  private pending = new Map<string, { resolve: (v: number | null) => void }>();
  private nextId = 0;

  /**
   * Resolves when the ONNX model has been compiled and cached in the worker.
   * Awaited by predict() so stale infer messages never accumulate during load.
   */
  readonly modelReady: Promise<void>;
  private _modelReadyResolve!: () => void;

  /**
   * @param modelUrl URL of the `.onnx.gz` model file.
   *   Defaults to the route served by the Vite plugin in quasar.config.ts.
   */
  constructor(modelUrl = '/models/luscinia.onnx.gz') {
    this.modelUrl = modelUrl;
    this.modelReady = new Promise<void>((resolve) => {
      this._modelReadyResolve = resolve;
    });
    console.debug('[LusciniaPredictor] created with modelUrl:', modelUrl);
    // Eagerly spawn the worker and start model loading immediately.
    this.getWorker();
  }

  private getWorker(): Worker {
    if (!this.worker) {
      console.debug('[LusciniaPredictor] spawning Web Worker...');
      this.worker = new Worker(new URL('./lusciniaWorker.ts', import.meta.url), { type: 'module' });
      console.debug('[LusciniaPredictor] worker spawned:', this.worker);
      this.worker.onmessage = (e: MessageEvent<WorkerOutboundMessage>) => {
        const msg = e.data;
        if (isControlMessage(msg)) {
          if (msg.type === 'ready') {
            console.debug('[LusciniaPredictor] model ready — inference queue open');
            this._modelReadyResolve();
          } else {
            console.error('[LusciniaPredictor] worker warmup error:', msg.error);
            // Resolve anyway so predict() callers aren’t stuck forever.
            this._modelReadyResolve();
          }
          return;
        }
        const { id, result, error } = msg;
        console.debug(
          `[LusciniaPredictor] response id=${id} result=${result} error=${error ?? 'none'}`,
        );
        const entry = this.pending.get(id);
        if (!entry) return;
        this.pending.delete(id);
        if (error) console.error('[LusciniaPredictor] worker reported error:', error);
        entry.resolve(result);
      };
      this.worker.onerror = (e) => {
        console.error('[LusciniaPredictor] worker onerror:', e.message, e);
        for (const entry of this.pending.values()) entry.resolve(null);
        this.pending.clear();
        this.worker = null;
      };
      this.worker.onmessageerror = (e) => {
        console.error('[LusciniaPredictor] worker message deserialization error:', e);
      };
      // Send warmup immediately — worker will start loading the model right away.
      this.worker.postMessage({ type: 'warmup', modelUrl: this.modelUrl });
      console.debug('[LusciniaPredictor] warmup sent to worker');
    }
    return this.worker;
  }

  async predict(word: string, signal?: AbortSignal): Promise<number | null> {
    if (signal?.aborted) return null;

    // Wait for the model to finish loading before posting to the worker.
    // This prevents stale infer messages from piling up in the serial queue
    // while the model is being compiled — the primary cause of the abort loop.
    await this.modelReady;

    if (signal?.aborted) return null;

    const id = String(this.nextId++);
    console.debug(`[LusciniaPredictor] predict id=${id} word="${word}"`);
    return new Promise<number | null>((resolve) => {
      this.pending.set(id, { resolve });
      this.getWorker().postMessage({ type: 'infer', id, word, modelUrl: this.modelUrl });

      signal?.addEventListener(
        'abort',
        () => {
          if (this.pending.has(id)) {
            console.debug(`[LusciniaPredictor] id=${id} aborted — dropping result`);
            this.pending.delete(id);
            resolve(null);
          }
        },
        { once: true },
      );
    });
  }
}
