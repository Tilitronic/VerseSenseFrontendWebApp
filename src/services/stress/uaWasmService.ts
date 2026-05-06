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

export interface UaMorphEntry {
  pos: string[];
  feats: Record<string, string[]>;
  lemma: string | null;
  definition: string | null;
}

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
  /** Morphological annotations from the dictionary. */
  morph: UaMorphEntry[];
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
  // WASM returns getter-based objects (serde_wasm_bindgen) whose properties
  // are non-enumerable. JSON round-trip converts them to plain objects so
  // the type guard's typeof checks work correctly.
  let plainReadings: unknown[];
  try {
    plainReadings = JSON.parse(JSON.stringify(raw.readings)) as unknown[];
  } catch {
    plainReadings = raw.readings;
  }
  const readings = plainReadings.filter(isUaReading);
  return readings.length > 0 ? { form: raw.form, readings } : null;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Load the WASM module. Idempotent — safe to call multiple times.
 * The 0.5.1+ package self-initialises on ESM import (no explicit init call needed).
 * We use dynamic import so the 15 MB WASM binary is compiled off the critical path,
 * preventing a main-thread freeze before the first render.
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
  // WASM may return getter-based objects (serde_wasm_bindgen) whose properties
  // are non-enumerable. JSON round-trip converts them to plain objects.
  const raw = _module.lookupBatch(words);
  let plain: unknown[];
  try {
    plain = JSON.parse(JSON.stringify(raw)) as unknown[];
  } catch {
    plain = raw;
  }
  return plain.map(parseResult);
}
