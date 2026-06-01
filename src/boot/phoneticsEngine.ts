import { boot } from 'quasar/wrappers';
import { phoneticEngineBackend } from 'src/services/phonetic/phoneticEngineBackend';

/**
 * Initialize the phonetic analysis engine.
 * Must be called before analyzing any IPA streams.
 */
export async function initializeEngine(): Promise<void> {
  await phoneticEngineBackend.initialize();
}

export function isEngineInitialized(): boolean {
  return phoneticEngineBackend.isReady();
}

export default boot(() => {
  // Fire-and-forget: do not block SPA bootstrap on worker backend init.
  void initializeEngine().catch((err) => {
    console.error('Engine initialization failed:', err);
    // Non-fatal — continue app but analysis won't work
  });

  // Expose globally for debugging
  if (process.env.DEV) {
    const globalObj = globalThis as typeof globalThis & {
      __phoneticEngine?: { initialized: boolean; version: () => string };
    };
    globalObj.__phoneticEngine = {
      initialized: isEngineInitialized(),
      version: () => 'worker-backend',
    };
  }
});
