// Lazy-load the WASM package inside worker message handlers.
// In Firefox/Vite worker graphs this avoids long top-level module evaluation
// from racing the host-side init timeout.

interface EngineApi {
  analyze: (streamJson: string) => string;
  version: () => string;
  phonemeDbHash: () => string;
}

type InitMessage = {
  type: 'init';
  id: string;
};

type AnalyzeMessage = {
  type: 'analyze';
  id: string;
  streamJson: string;
};

type InboundMessage = InitMessage | AnalyzeMessage;

type InitResultMessage = {
  type: 'init-result';
  id: string;
  ok: true;
  version: string;
};

type AnalyzeResultMessage = {
  type: 'analyze-result';
  id: string;
  ok: true;
  resultJson: string;
};

type ErrorResultMessage = {
  type: 'error';
  id: string;
  ok: false;
  error: string;
};

type OutboundMessage = InitResultMessage | AnalyzeResultMessage | ErrorResultMessage;

let engineApi: EngineApi | null = null;
let engineApiPromise: Promise<EngineApi> | null = null;

async function getEngineApi(): Promise<EngineApi> {
  if (engineApi) return engineApi;
  if (engineApiPromise) return engineApiPromise;

  engineApiPromise = import('ipa-poetry-engine').then(async (engine) => {
    // 0.2.2+ requires explicit WASM init before calling engine functions
    const init = (engine as { default?: () => Promise<unknown> }).default;
    if (init) await init();
    const api: EngineApi = {
      analyze: engine.analyze,
      version: engine.version,
      phonemeDbHash: engine.phonemeDbHash,
    };
    engineApi = api;
    return api;
  });

  return engineApiPromise;
}

function post(msg: OutboundMessage): void {
  self.postMessage(msg);
}

let latestAnalyzeId: string | null = null;
let pendingStreamJson: string | null = null;
let isAnalyzing = false;

self.onmessage = (event: MessageEvent<InboundMessage>) => {
  const message = event.data;

  if (message.type === 'init') {
    void (async () => {
      try {
        const api = await getEngineApi();
        post({
          type: 'init-result',
          id: message.id,
          ok: true,
          version: api.version(),
        });
      } catch (error) {
        post({ type: 'error', id: message.id, ok: false, error: String(error) });
      }
    })();
    return;
  }

  if (message.type === 'analyze') {
    latestAnalyzeId = message.id;
    pendingStreamJson = message.streamJson;
    if (!isAnalyzing) {
      isAnalyzing = true;
      void processAnalysisLoop();
    }
  }
};

async function processAnalysisLoop(): Promise<void> {
  while (pendingStreamJson !== null) {
    const id = latestAnalyzeId!;
    const streamJson = pendingStreamJson;
    pendingStreamJson = null;

    try {
      const api = await getEngineApi();
      if (id !== latestAnalyzeId) continue;
      const streamSize = streamJson.length;
      const streamPreview = streamJson.slice(0, 200).replace(/\n/g, '\\n');
      console.log(`[engineWorker] analyze: id=${id} inputSize=${streamSize} preview="${streamPreview}…"`);
      const t0 = performance.now();
      const resultJson = api.analyze(streamJson);
      const dt = (performance.now() - t0).toFixed(1);
      console.log(`[engineWorker] analyze done: id=${id} took=${dt}ms outputSize=${resultJson.length}`);
      await new Promise<void>((r) => setTimeout(r, 0));
      if (id === latestAnalyzeId && pendingStreamJson === null) {
        post({ type: 'analyze-result', id, ok: true, resultJson });
      }
    } catch (error) {
      if (id === latestAnalyzeId) {
        const errStr = String(error);
        const errDetails = error instanceof Error && error.stack
          ? `stack=${error.stack.slice(0, 500)}`
          : 'no-stack';
        console.error(`[engineWorker] analyze FAILED: id=${id} err="${errStr}" ${errDetails}`);
        post({ type: 'error', id, ok: false, error: errStr });
      }
    }
  }
  isAnalyzing = false;
}
