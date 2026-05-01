export interface PolishStressInfo {
  word: string;
  syllables: string[];
  syllableIndex: number;
  stressFromEnd: number;
  ipa: string | null;
  confidence: 'exact' | 'rule' | 'default';
}

import type { stressInfo as StressInfoFn } from '@tilitronic/polish-stress-wasm';

interface PlStressWasmModule {
  stressInfo: typeof StressInfoFn;
}

const cache = new Map<string, PolishStressInfo>();
const inflight = new Map<string, Promise<PolishStressInfo | null>>();
let modulePromise: Promise<PlStressWasmModule | null> | null = null;

function normalizeWord(word: string): string {
  return word.trim().toLowerCase();
}

const POLISH_VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'y', 'ą', 'ę', 'ó']);

function splitPolishWordToSyllables(word: string): string[] {
  if (!word) return [];

  const chars = [...word];
  const vowelIdx: number[] = [];
  for (let i = 0; i < chars.length; i++) {
    if (POLISH_VOWELS.has(chars[i]!)) vowelIdx.push(i);
  }

  if (vowelIdx.length === 0) return [word];
  if (vowelIdx.length === 1) return [word];

  const out: string[] = [];
  let start = 0;

  for (let vi = 0; vi < vowelIdx.length; vi++) {
    const v = vowelIdx[vi]!;
    const nextV = vowelIdx[vi + 1];

    if (nextV === undefined) {
      out.push(chars.slice(start).join(''));
      break;
    }

    const between = nextV - (v + 1);
    const cut = between > 1 ? v + 2 : v + 1;
    out.push(chars.slice(start, cut).join(''));
    start = cut;
  }

  return out.filter((s) => s.length > 0);
}

function buildFallbackInfo(word: string): PolishStressInfo | null {
  const normalized = normalizeWord(word);
  if (!normalized) return null;
  const syllables = splitPolishWordToSyllables(normalized);
  if (syllables.length === 0) return null;

  const syllableIndex = Math.max(0, syllables.length - 2);
  const stressFromEnd = Math.max(1, syllables.length - syllableIndex);

  return {
    word: normalized,
    syllables,
    syllableIndex,
    stressFromEnd,
    ipa: null,
    confidence: 'default',
  };
}

function isPolishStressInfo(value: unknown): value is PolishStressInfo {
  if (!value || typeof value !== 'object') return false;
  const info = value as Partial<PolishStressInfo>;
  return (
    typeof info.word === 'string' &&
    Array.isArray(info.syllables) &&
    typeof info.syllableIndex === 'number' &&
    typeof info.stressFromEnd === 'number' &&
    (typeof info.ipa === 'string' || info.ipa === null) &&
    (info.confidence === 'exact' || info.confidence === 'rule' || info.confidence === 'default')
  );
}

export function peekPolishStressInfo(word: string): PolishStressInfo | null {
  return cache.get(normalizeWord(word)) ?? null;
}

async function getModule(): Promise<PlStressWasmModule | null> {
  if (!modulePromise) {
    modulePromise = import('@tilitronic/polish-stress-wasm')
      .then((module) => {
        if (typeof module.stressInfo !== 'function') {
          throw new Error('Invalid @tilitronic/polish-stress-wasm export shape');
        }
        return { stressInfo: module.stressInfo };
      })
      .catch((error) => {
        console.warn('[pl-stress] module init failed:', error);
        modulePromise = null;
        return null;
      });
  }
  return modulePromise;
}

export async function getPolishStressInfo(
  word: string,
  signal?: AbortSignal,
): Promise<PolishStressInfo | null> {
  const normalized = normalizeWord(word);
  if (!normalized) return null;
  if (signal?.aborted) return null;

  const cached = cache.get(normalized);
  if (cached) return cached;

  const pending = inflight.get(normalized);
  if (pending) return pending;

  const req = (async () => {
    try {
      const module = await getModule();
      if (signal?.aborted) return null;

      if (!module) {
        const fallback = buildFallbackInfo(normalized);
        if (fallback) cache.set(normalized, fallback);
        return fallback;
      }

      const data = module.stressInfo(normalized) as unknown;
      if (!isPolishStressInfo(data)) {
        const fallback = buildFallbackInfo(normalized);
        if (fallback) cache.set(normalized, fallback);
        return fallback;
      }
      cache.set(normalized, data);
      return data;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return null;
      console.warn('[pl-stress] request failed:', error);
      const fallback = buildFallbackInfo(normalized);
      if (fallback) cache.set(normalized, fallback);
      return fallback;
    } finally {
      inflight.delete(normalized);
    }
  })();

  inflight.set(normalized, req);
  return req;
}
