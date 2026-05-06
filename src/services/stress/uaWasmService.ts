/**
 * uaWasmService.ts
 *
 * Singleton wrapper around the ua-word-stress-wasm WASM module.
 *
 * The WASM binary embeds the full Ukrainian stress dictionary (~3M word forms)
 * so no separate data file needs to be fetched or served.
 *
 * Call `initUaWasm()` once (done via the boot file). After that,
 * all lookup helpers are synchronous.
 */

import { trieLog } from 'src/services/logging';

// ── Shared reading type ────────────────────────────────────────────────────────

export interface UaReading {
  /** 0-based syllable index of the stressed syllable */
  syllableIndex: number;
  stressFromEnd: number;
  syllableCount: number;
  form: string;
  stressedForm: string;
  wordSyllables: string[];
  ipa: string;
  ipaSyllables: string[];
  confidence: string | null;
}

export interface UaLookupResult {
  form: string;
  readings: UaReading[];
}

// ── Internal WASM module type ──────────────────────────────────────────────────

interface UaWasmModule {
  stressIndex: (word: string) => number;
  stressIndexBatch: (words: string[]) => Int32Array;
  lookup: (word: string) => unknown;
  lookupBatch: (words: string[]) => unknown[];
  wordCount: () => number;
}

// ── Module-level singleton ─────────────────────────────────────────────────────

let _module: UaWasmModule | null = null;
let _modulePromise: Promise<void> | null = null;

// ── Word normalisation ────────────────────────────────────────────────────────

/**
 * Strip non-Cyrillic characters (punctuation, spaces, etc.) and lowercase.
 * This is the canonical form expected by the WASM dictionary.
 */
export function normalizeUaWord(word: string): string {
  return word.replace(/[^\u0400-\u04FF'\u2019\u02BC]/g, '').toLowerCase();
}

// ── Type guards ────────────────────────────────────────────────────────────────

function isUaReading(value: unknown): value is UaReading {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r['syllableIndex'] === 'number' &&
    Array.isArray(r['wordSyllables']) &&
    typeof r['ipa'] === 'string' &&
    Array.isArray(r['ipaSyllables'])
  );
}

function isUaLookupResult(value: unknown): value is UaLookupResult {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return typeof r['form'] === 'string' && Array.isArray(r['readings']);
}

function parseResult(raw: unknown): UaLookupResult | null {
  if (!isUaLookupResult(raw)) return null;
  const readings = raw.readings.filter(isUaReading);
  return readings.length > 0 ? { form: raw.form, readings } : null;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Load the WASM module. Idempotent — safe to call multiple times.
 * The bundler auto-initialises the WASM binary on ESM import;
 * no explicit `init()` call is needed.
 */
export async function initUaWasm(): Promise<void> {
  if (_module) return;
  if (_modulePromise) return _modulePromise;

  _modulePromise = import('ua-word-stress-wasm')
    .then((mod) => {
      const m = mod as unknown as UaWasmModule;
      _module = m;
      trieLog.info(`ua-word-stress-wasm ready — ${m.wordCount().toLocaleString()} word forms`);
    })
    .catch((err: unknown) => {
      trieLog.error('ua-word-stress-wasm init FAILED', err);
      _modulePromise = null; // allow retry on next call
      throw err;
    });

  return _modulePromise;
}

export function uaWasmReady(): boolean {
  return _module !== null;
}

/**
 * 0-based vowel index of the primary stressed vowel.
 * Returns -1 if the word is not in the dictionary or the WASM is not ready.
 */
export function uaWasmStressIndex(word: string): number {
  return _module?.stressIndex(word) ?? -1;
}

/**
 * Batch stress-index lookup. Returns an Int32Array of the same length as `words`.
 * Values are -1 for unknown words. Falls back to all-(-1) if WASM not ready.
 */
export function uaWasmStressIndexBatch(words: string[]): Int32Array {
  if (!_module) return new Int32Array(words.length).fill(-1);
  return _module.stressIndexBatch(words);
}

/**
 * Batch full lookup. Returns an array of same length as `words`; OOV entries
 * are null. Falls back to all-null if WASM not ready.
 */
export function uaWasmLookupBatch(words: string[]): Array<UaLookupResult | null> {
  if (!_module) return words.map(() => null);
  return _module.lookupBatch(words).map(parseResult);
}
