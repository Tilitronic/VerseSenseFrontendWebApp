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

type WorkerResponse = { id: string; result: number | null; error?: string };

export class LusciniaPredictor implements IMlStressPredictor {
  private readonly modelUrl: string;
  private worker: Worker | null = null;
  private pending = new Map<string, { resolve: (v: number | null) => void }>();
  private nextId = 0;

  /**
   * @param modelUrl URL of the `.onnx.gz` model file.
   *   Defaults to the route served by the Vite plugin in quasar.config.ts.
   */
  constructor(modelUrl = '/models/luscinia.onnx.gz') {
    this.modelUrl = modelUrl;
    console.debug('[LusciniaPredictor] created with modelUrl:', modelUrl);
  }

  private getWorker(): Worker {
    if (!this.worker) {
      console.debug('[LusciniaPredictor] spawning Web Worker...');
      this.worker = new Worker(new URL('./lusciniaWorker.ts', import.meta.url), { type: 'module' });
      console.debug('[LusciniaPredictor] worker spawned:', this.worker);
      this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const { id, result, error } = e.data;
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
    }
    return this.worker;
  }

  async predict(word: string): Promise<number | null> {
    const id = String(this.nextId++);
    console.debug(`[LusciniaPredictor] predict id=${id} word="${word}"`);
    return new Promise<number | null>((resolve) => {
      this.pending.set(id, { resolve });
      this.getWorker().postMessage({ id, word, modelUrl: this.modelUrl });
    });
  }
}
