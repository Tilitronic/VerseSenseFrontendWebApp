/**
 * Tests for uaWasmService.ts — specifically the parseResult / isUaReading
 * logic that converts raw WASM output to typed UaLookupResult objects.
 *
 * The WASM module (ua-word-stress-wasm) returns Rust structs serialised via
 * serde_wasm_bindgen. Those objects have getter-based non-enumerable
 * properties, so the service applies a JSON round-trip before running the
 * type guard. These tests mock the module and verify that:
 *   1. The correct field name is `syllableIndex` (not `stressIndex`).
 *   2. Getter-based / non-enumerable objects are handled correctly.
 *   3. OOV words (empty readings) return null.
 *   4. Partially-malformed readings are filtered out.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── The module uses a dynamic import for the WASM binary which we mock. ────
vi.mock('ua-word-stress-wasm', () => ({})); // prevent real WASM load

// Import internals under test via the module's public API.
// We test the exported batch function by injecting a fake module via initUaWasm.
import { uaWasmLookupBatch, normalizeUaWord } from '../uaWasmService';

// ── Helper: build a plain reading object with all required fields ─────────
function makeReading(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    syllableIndex: 0,
    stressFromEnd: 1,
    syllableCount: 2,
    form: 'замок',
    stressedForm: 'за́мок',
    wordSyllables: ['за', 'мок'],
    ipa: 'zɑmɔk',
    ipaSyllables: ['ˈzɑ', 'mɔk'],
    tokens: [],
    morph: [],
    confidence: null,
    ...overrides,
  };
}

// ── Helper: build a getter-based object (simulates serde_wasm_bindgen output)
// serde_wasm_bindgen creates objects with enumerable own getters, not plain
// data properties. JSON.stringify CAN reach enumerable getters, so they round-
// trip correctly. Non-enumerable getters would be lost — but that's not what
// the real WASM does.
function makeGetterReading(values: Record<string, unknown>): object {
  const obj = Object.create(null) as Record<string, unknown>;
  for (const [k, v] of Object.entries(values)) {
    Object.defineProperty(obj, k, { get: () => v, enumerable: true, configurable: true });
  }
  return obj;
}

// ── Inject a fake WASM module by reaching into the service internals ───────
// uaWasmService stores the module in a module-level `let _module`. We bypass
// initUaWasm by patching the module via the dynamic-import mock.
async function injectFakeModule(fakeLookupBatch: (words: string[]) => unknown[]) {
  // Reset cached module by re-importing with fresh mock
  vi.doMock('ua-word-stress-wasm', () => ({
    lookupBatch: fakeLookupBatch,
    stressIndex: () => -1,
    stressIndexBatch: (words: string[]) => new Int32Array(words.length).fill(-1),
    wordCount: () => 3_008_723,
  }));
  // Re-import to pick up the new mock — vitest resets module registry per test file
  // but we need to manually trigger initUaWasm with our fake
  const { initUaWasm } = await import('../uaWasmService');
  await initUaWasm();
}

describe('normalizeUaWord', () => {
  it('strips non-Cyrillic characters and lowercases', () => {
    expect(normalizeUaWord('Замок!')).toBe('замок');
    expect(normalizeUaWord('  Привіт ')).toBe('привіт');
    expect(normalizeUaWord("пять'")).toBe("пять'");
  });

  it('preserves apostrophe variants', () => {
    expect(normalizeUaWord("м'яч")).toBe("м'яч");
    expect(normalizeUaWord('м\u2019яч')).toBe('м\u2019яч');
    expect(normalizeUaWord('м\u02BCяч')).toBe('м\u02BCяч');
  });

  it('returns empty string for fully non-Cyrillic input', () => {
    expect(normalizeUaWord('hello')).toBe('');
    expect(normalizeUaWord('123')).toBe('');
  });
});

describe('uaWasmLookupBatch', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns all-null when WASM is not ready', () => {
    // After resetModules the module re-imports with _module = null
    const result = uaWasmLookupBatch(['замок', 'мама']);
    expect(result).toEqual([null, null]);
  });

  describe('field name: syllableIndex (not stressIndex)', () => {
    it('accepts readings with syllableIndex field', async () => {
      const reading = makeReading({ syllableIndex: 0 });
      const fakeResult = [{ form: 'замок', readings: [reading] }];
      await injectFakeModule(() => fakeResult);

      const { uaWasmLookupBatch: batch } = await import('../uaWasmService');
      const results = batch(['замок']);
      expect(results[0]).not.toBeNull();
      expect(results[0]!.readings[0]!.syllableIndex).toBe(0);
    });

    it('rejects readings that have stressIndex instead of syllableIndex', async () => {
      // Simulates old package that used 'stressIndex' as field name
      const badReading = makeReading({ syllableIndex: undefined, stressIndex: 0 });
      const fakeResult = [{ form: 'замок', readings: [badReading] }];
      await injectFakeModule(() => fakeResult);

      const { uaWasmLookupBatch: batch } = await import('../uaWasmService');
      const results = batch(['замок']);
      // No valid readings → null
      expect(results[0]).toBeNull();
    });
  });

  describe('getter-based (serde_wasm_bindgen) objects', () => {
    it('handles getter-based reading objects via JSON round-trip', async () => {
      const getterReading = makeGetterReading(
        makeReading({ syllableIndex: 1, form: 'замок', stressedForm: 'замо́к' }),
      );
      const getterResult = { form: 'замок', readings: [getterReading] };
      // The top-level result also needs to be parseable
      await injectFakeModule(() => [getterResult]);

      const { uaWasmLookupBatch: batch } = await import('../uaWasmService');
      const results = batch(['замок']);
      // JSON.parse(JSON.stringify(getterReading)) makes properties enumerable
      expect(results[0]).not.toBeNull();
      expect(results[0]!.readings[0]!.syllableIndex).toBe(1);
      expect(results[0]!.readings[0]!.stressedForm).toBe('замо́к');
    });
  });

  describe('OOV and partial results', () => {
    it('returns null for words with empty readings array', async () => {
      await injectFakeModule(() => [{ form: 'xyz', readings: [] }]);
      const { uaWasmLookupBatch: batch } = await import('../uaWasmService');
      expect(batch(['xyz'])[0]).toBeNull();
    });

    it('filters out malformed readings and keeps valid ones', async () => {
      const goodReading = makeReading({ syllableIndex: 0 });
      const badReading = { notAReading: true };
      await injectFakeModule(() => [{ form: 'замок', readings: [badReading, goodReading] }]);
      const { uaWasmLookupBatch: batch } = await import('../uaWasmService');
      const result = batch(['замок'])[0];
      expect(result).not.toBeNull();
      expect(result!.readings).toHaveLength(1);
      expect(result!.readings[0]!.syllableIndex).toBe(0);
    });

    it('handles heteronyms — multiple readings', async () => {
      const r1 = makeReading({ syllableIndex: 0, stressedForm: 'за́мок', ipa: 'ˈzɑmɔk' });
      const r2 = makeReading({ syllableIndex: 1, stressedForm: 'замо́к', ipa: 'zɑˈmɔk' });
      await injectFakeModule(() => [{ form: 'замок', readings: [r1, r2] }]);
      const { uaWasmLookupBatch: batch } = await import('../uaWasmService');
      const result = batch(['замок'])[0];
      expect(result).not.toBeNull();
      expect(result!.readings).toHaveLength(2);
      expect(result!.readings.map((r) => r.syllableIndex)).toEqual([0, 1]);
    });

    it('processes a batch with mixed known and OOV words', async () => {
      const reading = makeReading({ syllableIndex: 1 });
      await injectFakeModule(() => [
        { form: 'мама', readings: [] },
        { form: 'замок', readings: [reading] },
        { form: 'xyz', readings: [] },
      ]);
      const { uaWasmLookupBatch: batch } = await import('../uaWasmService');
      const results = batch(['мама', 'замок', 'xyz']);
      expect(results[0]).toBeNull();
      expect(results[1]).not.toBeNull();
      expect(results[2]).toBeNull();
    });
  });

  describe('stressedForm and ipa fields', () => {
    it('preserves stressedForm and ipa from readings', async () => {
      const reading = makeReading({ syllableIndex: 0, stressedForm: 'ма́ма', ipa: 'ˈmɑmɑ' });
      await injectFakeModule(() => [{ form: 'мама', readings: [reading] }]);
      const { uaWasmLookupBatch: batch } = await import('../uaWasmService');
      const result = batch(['мама'])[0];
      expect(result!.readings[0]!.stressedForm).toBe('ма́ма');
      expect(result!.readings[0]!.ipa).toBe('ˈmɑmɑ');
    });
  });
});
