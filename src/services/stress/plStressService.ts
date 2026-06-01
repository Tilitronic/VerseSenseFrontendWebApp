export interface PolishStressInfo {
  word: string;
  syllables: string[];
  syllableIndex: number;
  stressFromEnd: number;
  ipa: string | null;
  /** G2P-computed IPA, always present for WASM results (uses dictionary IPA when available). */
  ipaTranscribed?: string;
  ipaSyllables?: string[];
  confidence: 'exact' | 'rule' | 'default';
}

import { stressPolishLog } from 'src/services/logging';
import type { WordLookupResult, StressReading } from '@tilitronic/polish-stress-wasm/contracts';

type PolishConfidence = PolishStressInfo['confidence'];

interface PlStressWasmModule {
  lookup: (word: string) => unknown;
  lookupBatch: (words: string[]) => unknown;
}

const cache = new Map<string, PolishStressInfo>();
const inflight = new Map<string, Promise<PolishStressInfo | null>>();
let modulePromise: Promise<PlStressWasmModule | null> | null = null;
let moduleUnavailable = false;
let moduleFailureLogged = false;

function isPolishConfidence(value: unknown): value is PolishConfidence {
  return value === 'exact' || value === 'rule' || value === 'default';
}

function stripIpaStress(ipa: string): string {
  return ipa.replace(/[ˈˌ]/g, '');
}

function normalizeWord(word: string): string {
  return word
    .trim()
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}'\u02bc\u2019]+/gu, '')
    .replace(/[^\p{L}\p{N}'\u02bc\u2019]+$/gu, '');
}

const POLISH_VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'y', 'ą', 'ę', 'ó']);
const POLISH_CONSONANTS = new Set([
  'b',
  'c',
  'ć',
  'd',
  'f',
  'g',
  'h',
  'j',
  'k',
  'l',
  'ł',
  'm',
  'n',
  'ń',
  'p',
  'q',
  'r',
  's',
  'ś',
  't',
  'v',
  'w',
  'x',
  'z',
  'ź',
  'ż',
]);

function isFallbackNucleus(chars: string[], index: number): boolean {
  const ch = chars[index];
  if (!ch || !POLISH_VOWELS.has(ch)) return false;

  // In Polish, "i" before another vowel after a consonant often softens and is not a nucleus.
  if (ch !== 'i') return true;

  const prev = chars[index - 1] ?? '';
  const next = chars[index + 1] ?? '';

  if (!next || !POLISH_VOWELS.has(next)) return true;
  return !POLISH_CONSONANTS.has(prev);
}

function splitPolishWordToSyllables(word: string): string[] {
  if (!word) return [];

  const chars = [...word];
  const vowelIdx: number[] = [];
  for (let i = 0; i < chars.length; i++) {
    if (isFallbackNucleus(chars, i)) vowelIdx.push(i);
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

function isLookupReading(value: unknown): value is StressReading {
  if (!value || typeof value !== 'object') return false;
  const reading = value as Partial<StressReading>;
  return (
    typeof reading.syllableIndex === 'number' &&
    typeof reading.stressFromEnd === 'number' &&
    typeof reading.syllableCount === 'number' &&
    typeof reading.form === 'string' &&
    Array.isArray(reading.wordSyllables) &&
    typeof reading.ipa === 'string' &&
    Array.isArray(reading.ipaSyllables)
  );
}

function isLookupResult(value: unknown): value is WordLookupResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<WordLookupResult>;
  return typeof result.form === 'string' && Array.isArray(result.readings);
}

function mapLookupToInfo(normalized: string, value: unknown): PolishStressInfo | null {
  if (!isLookupResult(value) || value.readings.length === 0) return null;

  const reading = value.readings[0];
  if (!isLookupReading(reading)) return null;

  const syllables =
    reading.wordSyllables.length > 0
      ? reading.wordSyllables
      : splitPolishWordToSyllables(normalized);
  if (syllables.length === 0) return null;

  const syllableIndex = Math.max(0, Math.min(reading.syllableIndex, syllables.length - 1));
  const stressFromEnd = Math.max(1, syllables.length - syllableIndex);

  return {
    word: normalized,
    syllables,
    syllableIndex,
    stressFromEnd,
    ipa: reading.ipa ? stripIpaStress(reading.ipa) : null,
    ...(reading.ipa ? { ipaTranscribed: reading.ipa } : {}),
    ipaSyllables: reading.ipaSyllables.map((part) => stripIpaStress(part)),
    confidence: isPolishConfidence(reading.confidence ?? undefined) ? reading.confidence as PolishConfidence : 'default',
  };
}

export function peekPolishStressInfo(word: string): PolishStressInfo | null {
  return cache.get(normalizeWord(word)) ?? null;
}

async function getModule(): Promise<PlStressWasmModule | null> {
  if (moduleUnavailable) return null;
  if (!modulePromise) {
    stressPolishLog.debug('module init: dynamic import @tilitronic/polish-stress-wasm');
    modulePromise = import('@tilitronic/polish-stress-wasm')
      .then((module) => {
        if (typeof module.lookup !== 'function') {
          throw new Error('Invalid @tilitronic/polish-stress-wasm export shape');
        }

        const lookupBatch =
          typeof module.lookupBatch === 'function'
            ? module.lookupBatch
            : (words: string[]) => words.map((w) => module.lookup(w));

        stressPolishLog.info('module init: success');
        return { lookup: module.lookup, lookupBatch };
      })
      .catch((error) => {
        stressPolishLog.warn('module init failed', error);
        if (!moduleFailureLogged) {
          moduleFailureLogged = true;
          stressPolishLog.warn(
            'package runtime unavailable in current browser build; using local fallback only',
          );
        }
        moduleUnavailable = true;
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
  stressPolishLog.debug('resolve requested', { word, normalized, aborted: !!signal?.aborted });
  if (!normalized) return null;
  if (signal?.aborted) return null;

  const cached = cache.get(normalized);
  if (cached) {
    stressPolishLog.debug('cache hit', {
      word: normalized,
      syllables: cached.syllables,
      syllableIndex: cached.syllableIndex,
      stressFromEnd: cached.stressFromEnd,
      confidence: cached.confidence,
    });
    return cached;
  }

  const pending = inflight.get(normalized);
  if (pending) {
    stressPolishLog.debug('inflight hit', { word: normalized });
    return pending;
  }

  const req = (async () => {
    try {
      const module = await getModule();
      if (signal?.aborted) return null;

      if (!module) {
        const fallback = buildFallbackInfo(normalized);
        if (fallback) cache.set(normalized, fallback);
        stressPolishLog.warn('module unavailable -> fallback', { word: normalized, fallback });
        return fallback;
      }

      const info = mapLookupToInfo(normalized, module.lookup(normalized));
      if (!info) {
        const fallback = buildFallbackInfo(normalized);
        if (fallback) cache.set(normalized, fallback);
        stressPolishLog.warn('invalid package payload -> fallback', {
          word: normalized,
          fallback,
        });
        return fallback;
      }
      cache.set(normalized, info);
      stressPolishLog.info('resolve success', {
        word: normalized,
        syllables: info.syllables,
        syllableIndex: info.syllableIndex,
        stressFromEnd: info.stressFromEnd,
        confidence: info.confidence,
      });
      return info;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return null;
      stressPolishLog.warn('resolve failed -> fallback', { word: normalized, error });
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

export async function getPolishStressInfoBatch(
  words: string[],
  signal?: AbortSignal,
): Promise<Array<PolishStressInfo | null>> {
  const normalizedWords = words.map((word) => normalizeWord(word));
  const out: Array<PolishStressInfo | null> = new Array(words.length).fill(null);
  if (signal?.aborted) return out;

  const missingIndexesByWord = new Map<string, number[]>();

  normalizedWords.forEach((normalized, index) => {
    if (!normalized) return;
    const cached = cache.get(normalized);
    if (cached) {
      out[index] = cached;
      return;
    }
    const list = missingIndexesByWord.get(normalized);
    if (list) list.push(index);
    else missingIndexesByWord.set(normalized, [index]);
  });

  if (missingIndexesByWord.size === 0) return out;

  const module = await getModule();
  if (signal?.aborted) return out;

  const missingWords = [...missingIndexesByWord.keys()];

  if (!module) {
    for (const missing of missingWords) {
      const fallback = buildFallbackInfo(missing);
      if (fallback) cache.set(missing, fallback);
      for (const idx of missingIndexesByWord.get(missing) ?? []) out[idx] = fallback;
    }
    return out;
  }

  let results: unknown;
  try {
    results = module.lookupBatch(missingWords);
  } catch (error) {
    stressPolishLog.warn('lookupBatch failed -> fallback', { error });
    results = null;
  }

  const payload =
    Array.isArray(results) && results.length === missingWords.length
      ? results
      : new Array<unknown>(missingWords.length).fill(null);

  missingWords.forEach((normalized, idx) => {
    const parsed = mapLookupToInfo(normalized, payload[idx]);
    const resolved = parsed ?? buildFallbackInfo(normalized);
    if (resolved) cache.set(normalized, resolved);
    for (const outIdx of missingIndexesByWord.get(normalized) ?? []) out[outIdx] = resolved;
  });

  return out;
}
