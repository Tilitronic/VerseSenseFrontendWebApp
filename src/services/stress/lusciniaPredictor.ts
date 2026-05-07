/**
 * LusciniaPredictor — main-thread proxy for the Luscinia ONNX predictor.
 *
 * All ONNX inference runs in a dedicated Web Worker so the UI thread is
 * never blocked. The ua-stress-ml package provides the actual model logic.
 */

import type { IMlStressPredictor } from './types';
import { mlLog } from 'src/services/logging';

/** Human-readable display name shown in UI tooltips. */
export const LUSCINIA_MODEL_DISPLAY = 'Luscinia LGBMv1';
export const LUSCINIA_REPO_URL = 'https://github.com/Tilitronic/ua-stress-engine';

type WorkerInferResult = { id: string; result: number | null; error?: string };
type WorkerControlMessage = { type: 'error'; error: string };
type WorkerOutboundMessage = WorkerInferResult | WorkerControlMessage;

function isControlMessage(m: WorkerOutboundMessage): m is WorkerControlMessage {
  return 'type' in m;
}

export class LusciniaPredictor implements IMlStressPredictor {
  private readonly modelUrl: string;
  private worker: Worker | null = null;
  private pending = new Map<string, { resolve: (v: number | null) => void }>();
  private nextId = 0;
  private mlDisabled = false;

  /**
   * @param modelUrl URL of the `.onnx.gz` model file.
   *   Defaults to the route served by the Vite plugin in quasar.config.ts.
   */
  constructor(modelUrl = '/models/luscinia.onnx.gz') {
    this.modelUrl = modelUrl;
    // Keep ML startup lazy so first paint is never blocked by ONNX init.
    mlLog.info('neural stress model ready in lazy mode (loads on first OOV inference)');
  }

  private isFatalAllocError(errorText: string): boolean {
    return /bad_alloc|error_code:\s*6/i.test(errorText);
  }

  private disableMl(reason: string): void {
    if (this.mlDisabled) return;
    this.mlDisabled = true;
    mlLog.error(`[LusciniaPredictor] disabling ML for this session: ${reason}`);
    for (const entry of this.pending.values()) entry.resolve(null);
    this.pending.clear();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  private getWorker(): Worker {
    if (!this.worker) {
      console.debug('[LusciniaPredictor] spawning Web Worker...');
      this.worker = new Worker(new URL('./lusciniaWorker.ts', import.meta.url), { type: 'module' });
      console.debug('[LusciniaPredictor] worker spawned:', this.worker);
      this.worker.onmessage = (e: MessageEvent<WorkerOutboundMessage>) => {
        const msg = e.data;
        if (isControlMessage(msg)) {
          console.error('[LusciniaPredictor] worker error:', msg.error);
          if (this.isFatalAllocError(msg.error)) this.disableMl(msg.error);
          return;
        }
        const { id, result, error } = msg;
        console.debug(
          `[LusciniaPredictor] response id=${id} result=${result} error=${error ?? 'none'}`,
        );
        const entry = this.pending.get(id);
        if (!entry) return;
        this.pending.delete(id);
        if (error) {
          console.error('[LusciniaPredictor] worker reported error:', error);
          if (this.isFatalAllocError(error)) this.disableMl(error);
        }
        entry.resolve(result);
      };
      this.worker.onerror = (e) => {
        console.error('[LusciniaPredictor] worker onerror:', e.message, e);
        if (this.isFatalAllocError(String(e.message ?? ''))) {
          this.disableMl(String(e.message));
          return;
        }
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

  async predict(word: string, signal?: AbortSignal): Promise<number | null> {
    if (this.mlDisabled) return null;
    if (signal?.aborted) return null;

    const id = String(this.nextId++);
    mlLog.debug(`queued inference for “${word}”`);
    return new Promise<number | null>((resolve) => {
      this.pending.set(id, { resolve });
      this.getWorker().postMessage({ type: 'infer', id, word, modelUrl: this.modelUrl });

      signal?.addEventListener(
        'abort',
        () => {
          if (this.pending.has(id)) {
            mlLog.debug(`inference for “${word}” cancelled`);
            this.pending.delete(id);
            resolve(null);
          }
        },
        { once: true },
      );
    });
  }
}
