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

  engineApiPromise = import('ipa-poetry-engine').then((engine) => {
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

let analysisQueue: Promise<void> = Promise.resolve();

function post(msg: OutboundMessage): void {
  self.postMessage(msg);
}

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
    analysisQueue = analysisQueue.then(async () => {
      try {
        const api = await getEngineApi();
        const resultJson = api.analyze(message.streamJson);
        post({ type: 'analyze-result', id: message.id, ok: true, resultJson });
      } catch (error) {
        post({ type: 'error', id: message.id, ok: false, error: String(error) });
      }
    });
  }
};
