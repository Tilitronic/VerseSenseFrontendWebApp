/**
 * Application-wide named loggers.
 *
 * Import the logger you need directly:
 *   import { mlLog, trieLog, stressLog } from 'src/services/logging';
 *
 * Control from browser devtools (prod):
 *   import { setGlobalEnabled, enableNamespace, disableNamespace }
 *     from 'src/services/logging';
 *   setGlobalEnabled(true);          // enable all (persists via localStorage)
 *   enableNamespace('ml');           // enable only ml logger
 *   disableNamespace('stress.sync'); // silence noisy sync logger
 */
import { createLogger } from './logger';

// ── Trie loader ───────────────────────────────────────────────────────────────
export const trieLog = createLogger('stress.trie', {});

// ── ML model / worker (main-thread side) ──────────────────────────────────────
export const mlLog = createLogger('ml', {});

// ── Async stress resolution loop ─────────────────────────────────────────────
export const stressAsyncLog = createLogger('stress.async', {});

// ── Sync stress resolution (per-word, very chatty) ───────────────────────────
export const stressSyncLog = createLogger('stress.sync', {});

// ── Phonetic pipeline ────────────────────────────────────────────────────────
export const phoneticLog = createLogger('phonetic', {});
