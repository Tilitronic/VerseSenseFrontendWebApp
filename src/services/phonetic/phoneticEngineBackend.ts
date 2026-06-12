import type { StreamAnalysisResult } from './analysisTypes';

type InitRequestMessage = {
  type: 'init';
  id: string;
};

type AnalyzeRequestMessage = {
  type: 'analyze';
  id: string;
  streamJson: string;
};

type OutboundMessage = InitRequestMessage | AnalyzeRequestMessage;

type InboundMessage =
  | { type: 'init-result'; id: string; ok: true; version: string }
  | { type: 'analyze-result'; id: string; ok: true; resultJson: string }
  | { type: 'error'; id: string; ok: false; error: string };

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

class PhoneticEngineBackend {
  private static readonly INIT_TIMEOUT_MS = 60000;
  private static readonly ANALYZE_TIMEOUT_MS = 120000;
  private static readonly MAX_INIT_RETRIES = 3;
  private worker: Worker | null = null;
  private pending = new Map<string, PendingRequest>();
  private nextId = 0;
  private initPromise: Promise<void> | null = null;
  private ready = false;
  private initRetries = 0;
  private permanentlyDead = false;

  private createId(): string {
    this.nextId += 1;
    return String(this.nextId);
  }

  private resetWorkerState(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.initPromise = null;
    this.ready = false;
  }

  private getWorker(): Worker {
    if (this.worker) return this.worker;

    const worker = new Worker(new URL('./phoneticEngineWorker.ts', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (event: MessageEvent<InboundMessage>) => {
      const message = event.data;
      const request = this.pending.get(message.id);
      if (!request) return;
      this.pending.delete(message.id);

      if (!message.ok) {
        console.error(
          `[engineBackend] analyze error id=${message.id} err="${message.error}"`,
          `ready=${this.ready} retries=${this.initRetries} dead=${this.permanentlyDead}`,
        );
        this.resetWorkerState();
        request.reject(new Error(message.error));
        return;
      }

      if (message.type === 'init-result') {
        this.ready = true;
        request.resolve(undefined);
        return;
      }

      if (message.type === 'analyze-result') {
        request.resolve(message.resultJson);
      }
    };

    worker.onerror = (event) => {
      this.onWorkerCrash(new Error(event.message || 'Phonetic engine worker crashed'));
    };

    worker.onmessageerror = () => {
      this.onWorkerCrash(new Error('Phonetic engine worker message deserialization failed'));
    };

    this.worker = worker;
    return worker;
  }

  private onWorkerCrash(error: Error): void {
    this.initRetries++;
    for (const req of this.pending.values()) req.reject(error);
    this.pending.clear();
    this.resetWorkerState();
    if (this.initRetries >= PhoneticEngineBackend.MAX_INIT_RETRIES) {
      this.permanentlyDead = true;
    }
  }

  async initialize(): Promise<void> {
    if (this.permanentlyDead) {
      throw new Error('Phonetic engine permanently disabled after repeated crashes');
    }
    if (this.ready) return;
    if (this.initPromise) return this.initPromise;

    const id = this.createId();
    const payload: InitRequestMessage = {
      type: 'init',
      id,
    };

    this.initPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        this.resetWorkerState();
        reject(new Error('Phonetic engine init timed out'));
      }, PhoneticEngineBackend.INIT_TIMEOUT_MS);

      this.pending.set(id, {
        resolve: () => {
          clearTimeout(timeout);
          this.initRetries = 0;
          resolve();
        },
        reject: (reason) => {
          clearTimeout(timeout);
          reject(reason instanceof Error ? reason : new Error(String(reason)));
        },
      });
      this.getWorker().postMessage(payload);
    }).finally(() => {
      this.initPromise = null;
    });

    return this.initPromise;
  }

  isReady(): boolean {
    return this.ready;
  }

  async analyze(streamJson: string): Promise<StreamAnalysisResult> {
    if (this.permanentlyDead) {
      throw new Error('Phonetic engine is unavailable after repeated crashes');
    }

    const doAnalyze = async (): Promise<string> => {
      await this.initialize();

      const id = this.createId();
      const payload: AnalyzeRequestMessage = { type: 'analyze', id, streamJson };

      return new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.pending.delete(id);
          this.resetWorkerState();
          reject(new Error('Phonetic engine analyze timed out'));
        }, PhoneticEngineBackend.ANALYZE_TIMEOUT_MS);

        this.pending.set(id, {
          resolve: (value) => {
            clearTimeout(timeout);
            resolve(String(value));
          },
          reject: (reason) => {
            clearTimeout(timeout);
            reject(reason instanceof Error ? reason : new Error(String(reason)));
          },
        });
        this.getWorker().postMessage(payload as OutboundMessage);
      });
    };

    const resultJson = await doAnalyze().catch(async () => {
      console.warn('[engineBackend] retry: resetting worker and retrying analyze once');
      this.resetWorkerState();
      return doAnalyze();
    });

    return JSON.parse(resultJson) as StreamAnalysisResult;
  }
}

export const phoneticEngineBackend = new PhoneticEngineBackend();
