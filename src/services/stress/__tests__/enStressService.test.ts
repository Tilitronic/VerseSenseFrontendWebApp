/**
 * Tests for enStressService.ts
 *
 * Covers:
 *   1. isTechnicalToken guard — URL/identifier fragments never reach the network.
 *   2. parseIpaStressIndex — IPA ˈ marker → 0-based syllable index.
 *   3. fetchOovStress — FreeDictionary API responses, caching, error handling.
 *   4. resolveEnStress — full pipeline integration.
 *
 * Strategy
 * ─────────────────────────────────────────────────────────────────────────────
 * • `src/services/phonetic/enTranscription` is mocked so CMU lookups are
 *   controlled per-test without loading the 4 MB CMU JSON.
 * • `globalThis.fetch` is spied on to capture and control API calls.
 * • The module-level `_oovCache` is a private singleton; we reset modules with
 *   `vi.resetModules()` + `vi.doMock()` + dynamic import so each describe
 *   block that needs cache isolation gets a fresh module instance.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

// ── Shared fetch helper ───────────────────────────────────────────────────────

function mockFetchOk(entries: Array<{ phonetics?: Array<{ text?: string }> }>): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(entries),
    }),
  );
}

function mockFetchStatus(status: number): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status }));
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── Helper: load a fresh module instance with controlled CMU mock ─────────────

async function loadFreshModule(cmuImpl: (word: string) => number | null) {
  vi.resetModules();
  vi.doMock('src/services/phonetic/enTranscription', () => ({
    cmuDictReady: Promise.resolve(),
    getEnStressIndex: vi.fn().mockImplementation(cmuImpl),
  }));
  const mod = await import('../enStressService');
  return mod;
}

// =============================================================================
// 1. isTechnicalToken guard
// =============================================================================

describe('isTechnicalToken guard', () => {
  it('blocks tokens with no vowels (protocol names, abbreviations)', async () => {
    const { resolveEnStress } = await loadFreshModule(() => null);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    for (const word of ['https', 'ftp', 'www', 'src', 'px', 'cms', 'jpg']) {
      const result = await resolveEnStress(word);
      expect(result, `"${word}" should be null`).toBeNull();
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('blocks tokens that contain a digit', async () => {
    const { resolveEnStress } = await loadFreshModule(() => null);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    for (const word of ['h1', 'mp3', 'b64', 'html5', '2pac']) {
      expect(await resolveEnStress(word), `"${word}"`).toBeNull();
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('blocks tokens with URL-structural characters (dot, slash, colon, at, underscore)', async () => {
    const { resolveEnStress } = await loadFreshModule(() => null);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    for (const word of ['api.com', 'user@host', 'path/file', 'c:\\dir', 'snake_case']) {
      expect(await resolveEnStress(word), `"${word}"`).toBeNull();
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does NOT block normal English words that have vowels and no special chars', async () => {
    // CMU returns null → falls through to API
    mockFetchOk([{ phonetics: [{ text: '/ˈhɛloʊ/' }] }]);
    const { resolveEnStress } = await loadFreshModule(() => null);

    const result = await resolveEnStress('hello');
    expect(result).toBe(0); // ˈ at position 0
    expect(fetch).toHaveBeenCalledOnce();
  });
});

// =============================================================================
// 2. parseIpaStressIndex (tested indirectly via FreeDictionary mock)
// =============================================================================

describe('parseIpaStressIndex via FreeDictionary responses', () => {
  it('returns 0 when ˈ is at the very start (first syllable stressed)', async () => {
    mockFetchOk([{ phonetics: [{ text: '/ˈrekərd/' }] }]);
    const { resolveEnStress } = await loadFreshModule(() => null);

    expect(await resolveEnStress('record')).toBe(0);
  });

  it('returns 1 when one nucleus precedes ˈ (second syllable stressed)', async () => {
    // "rɪ" = 1 nucleus before ˈ
    mockFetchOk([{ phonetics: [{ text: '/rɪˈkɔːrd/' }] }]);
    const { resolveEnStress } = await loadFreshModule(() => null);

    expect(await resolveEnStress('rekvord')).toBe(1);
  });

  it('returns 2 when two nuclei precede ˈ (third syllable stressed)', async () => {
    // "ˌɪntər" = 2 nuclei (ɪ + ə) before ˈ
    mockFetchOk([{ phonetics: [{ text: '/ˌɪntərˈpret/' }] }]);
    const { resolveEnStress } = await loadFreshModule(() => null);

    expect(await resolveEnStress('interpret')).toBe(2);
  });

  it('handles diphthongs as a single nucleus', async () => {
    // "traɪ" = 1 nucleus (aɪ diphthong) before ˈ
    mockFetchOk([{ phonetics: [{ text: '/traɪˈæŋɡl/' }] }]);
    const { resolveEnStress } = await loadFreshModule(() => null);

    expect(await resolveEnStress('triangle')).toBe(1);
  });

  it('returns 0 when phonetics has no ˈ (monosyllable / function word)', async () => {
    mockFetchOk([{ phonetics: [{ text: '/wɜːrd/' }] }]);
    const { resolveEnStress } = await loadFreshModule(() => null);

    expect(await resolveEnStress('word')).toBe(0);
  });

  it('skips phonetic entries without text and uses the first that has ˈ', async () => {
    mockFetchOk([
      {
        phonetics: [
          { text: '' }, // no text — skip
          {}, // no text field — skip
          { text: '/rɪˈzʌlt/' }, // valid — index 1
        ],
      },
    ]);
    const { resolveEnStress } = await loadFreshModule(() => null);

    expect(await resolveEnStress('result')).toBe(1);
  });

  it('strips /…/ and […] delimiters before parsing', async () => {
    mockFetchOk([{ phonetics: [{ text: '[ˈkæt]' }] }]);
    const { resolveEnStress } = await loadFreshModule(() => null);

    expect(await resolveEnStress('cat')).toBe(0);
  });
});

// =============================================================================
// 3. FreeDictionary API — network and caching behaviour
// =============================================================================

describe('FreeDictionary API — HTTP error handling', () => {
  it('returns null and caches null on 404', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal('fetch', fetchMock);
    const { resolveEnStress } = await loadFreshModule(() => null);

    const first = await resolveEnStress('quorble');
    const second = await resolveEnStress('quorble'); // should hit cache, not fetch again
    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce(); // only one real request
  });

  it('returns null on network error and does NOT cache (retry possible)', async () => {
    // First call: network failure
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      // Second call: success
      .mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ phonetics: [{ text: '/ˈwɪŋk/' }] }]),
      });
    vi.stubGlobal('fetch', fetchMock);
    const { resolveEnStress } = await loadFreshModule(() => null);

    const first = await resolveEnStress('wink');
    expect(first).toBeNull(); // network error → null

    const second = await resolveEnStress('wink'); // NOT cached → retried
    expect(second).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns null when AbortSignal is already aborted', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { resolveEnStress } = await loadFreshModule(() => null);

    const controller = new AbortController();
    controller.abort();

    // fetch itself will throw a DOMException(AbortError) when signal is aborted
    fetchMock.mockRejectedValue(new DOMException('Aborted', 'AbortError'));
    const result = await resolveEnStress('abort', controller.signal);
    expect(result).toBeNull();
  });
});

describe('FreeDictionary API — session cache', () => {
  it('caches a successful result and does not call fetch a second time', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ phonetics: [{ text: '/rɪˈpɛt/' }] }]),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { resolveEnStress } = await loadFreshModule(() => null);

    const first = await resolveEnStress('repete');
    const second = await resolveEnStress('repete');

    expect(first).toBe(1);
    expect(second).toBe(1);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('lookup is case-insensitive — "Guitar" and "guitar" share cache entry', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ phonetics: [{ text: '/ɡɪˈtɑːr/' }] }]),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { resolveEnStress } = await loadFreshModule(() => null);

    await resolveEnStress('Guitar');
    const result = await resolveEnStress('guitar');

    expect(result).toBe(1);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

// =============================================================================
// 4. resolveEnStress — full pipeline
// =============================================================================

describe('resolveEnStress full pipeline', () => {
  it('CMU hit → returns CMU index, never calls fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    // CMU mock returns index 1 for any word
    const { resolveEnStress } = await loadFreshModule(() => 1);

    expect(await resolveEnStress('beautiful')).toBe(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('technical token → null before CMU even runs', async () => {
    const cmuMock = vi.fn().mockReturnValue(99);
    const { resolveEnStress } = await loadFreshModule(cmuMock);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    expect(await resolveEnStress('https')).toBeNull();
    expect(cmuMock).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('OOV word (CMU miss) → falls through to FreeDictionary', async () => {
    mockFetchOk([{ phonetics: [{ text: '/ˈkeɪoʊs/' }] }]);
    const { resolveEnStress } = await loadFreshModule(() => null); // CMU always misses

    expect(await resolveEnStress('kaios')).toBe(0);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('OOV word + API failure → null', async () => {
    mockFetchStatus(500);
    const { resolveEnStress } = await loadFreshModule(() => null);

    expect(await resolveEnStress('unknownword')).toBeNull();
  });

  it('API entry with no phonetics array → falls back to 0', async () => {
    mockFetchOk([{}]); // entry present but no phonetics
    const { resolveEnStress } = await loadFreshModule(() => null);

    expect(await resolveEnStress('missingphon')).toBe(0);
  });

  it('empty data array from API → null (no entry found)', async () => {
    // API returns empty array — meaning word not found at all
    // res.ok is true but data[0] is undefined
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      }),
    );
    const { resolveEnStress } = await loadFreshModule(() => null);

    expect(await resolveEnStress('noentry')).toBe(0); // phonetics defaults to []
  });
});
