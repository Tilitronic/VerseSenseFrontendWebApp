/**
 * enStressService.ts
 *
 * English stress resolution with two-tier fallback:
 *   1. CMU Pronouncing Dictionary (134k words, offline, loads at startup).
 *   2. FreeDictionary API (https://api.dictionaryapi.dev) — network call,
 *      result cached per session — covers proper nouns, brand names, and
 *      recent loanwords that CMU does not contain.
 */

import { cmuDictReady, getEnStressIndex } from 'src/services/phonetic/enTranscription';

export { cmuDictReady };

// ── IPA nucleus counting ──────────────────────────────────────────────────────
// Match multi-character diphthongs before single vowels to avoid double-counting
// (e.g. "aɪ" is one nucleus, not two).  Each match = one syllable nucleus.
const NUCLEUS_RE = /aɪ|aʊ|ɔɪ|eɪ|oʊ|ɪə|eə|ʊə|[aeiouæɛɪɒʌɑɔəɜʊɨʉ][ː]?/gu;

function countNuclei(ipaFragment: string): number {
  return (ipaFragment.match(NUCLEUS_RE) ?? []).length;
}

/**
 * Parse a FreeDictionary IPA phonetic string and return the 0-based index
 * of the primarily-stressed syllable.
 *
 * The IPA convention places ˈ (U+02C8) immediately BEFORE the onset of the
 * stressed syllable, so everything to the left of ˈ belongs to pre-stress
 * syllables.  Counting the vowel nuclei in that prefix gives the index.
 *
 * Example: "/rɪˈkɔːrd/" → prefix = "rɪ" → 1 nucleus → index 1.
 *
 * Returns null when no ˈ is found (monosyllable or unstressed entry).
 */
function parseIpaStressIndex(ipa: string): number | null {
  // Strip enclosing /…/ or […]
  const clean = ipa.replace(/^[/[]+|[/\]]+$/g, '');
  const markerPos = clean.indexOf('ˈ');
  if (markerPos === -1) return null;
  return countNuclei(clean.slice(0, markerPos));
}

// ── FreeDictionary API ────────────────────────────────────────────────────────

const FREE_DICT_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en';

interface FreeDictEntry {
  phonetics?: Array<{ text?: string }>;
}

/**
 * Session cache: lowercase word → stressed syllable index, or null if the
 * API returned no usable data.  Entries survive for the page lifetime and
 * avoid duplicate network requests for the same word.
 *
 * Failures (network errors, aborts) are NOT cached so a later retry works.
 */
const _oovCache = new Map<string, number | null>();

async function fetchOovStress(word: string, signal?: AbortSignal): Promise<number | null> {
  const key = word.toLowerCase();
  if (_oovCache.has(key)) return _oovCache.get(key)!;

  try {
    const res = await fetch(`${FREE_DICT_BASE}/${encodeURIComponent(key)}`, {
      signal: signal ?? null,
    });
    if (!res.ok) {
      _oovCache.set(key, null);
      return null;
    }
    const data = (await res.json()) as FreeDictEntry[];
    const phonetics = data[0]?.phonetics ?? [];

    // Try each phonetic variant until we find a parseable ˈ marker.
    for (const ph of phonetics) {
      if (!ph.text) continue;
      const idx = parseIpaStressIndex(ph.text);
      if (idx !== null) {
        _oovCache.set(key, idx);
        return idx;
      }
    }

    // API returned data but no ˈ marker in any variant → monosyllable / function word.
    _oovCache.set(key, 0);
    return 0;
  } catch {
    // Network error or intentional abort — do not cache so a retry is possible.
    return null;
  }
}

// ── Technical token guard ─────────────────────────────────────────────────────

const EN_VOWELS_RE = /[aeiouAEIOU]/;

/**
 * Returns true for tokens that look like technical identifiers, URLs, or
 * abbreviations — things that are not natural English words and should not
 * be sent to CMU or the FreeDictionary API.
 *
 * Heuristics (any one is sufficient to skip):
 *   • No vowel at all (e.g. "https", "www", "src", "px")
 *   • Contains a digit (e.g. "h1", "api2", "mp3", "b64")
 *   • Contains a dot, slash, colon, or underscore (URL/path fragments)
 */
function isTechnicalToken(word: string): boolean {
  if (!EN_VOWELS_RE.test(word)) return true;
  if (/[\d./:\\@_]/.test(word)) return true;
  return false;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolve the primary-stress syllable index (0-based) for an English word.
 *
 * Call **after** `await cmuDictReady` so that the CMU lookup is synchronous.
 *
 * Resolution order:
 *   1. Technical token guard — returns null immediately for URL fragments,
 *      abbreviations, and identifiers that contain no vowels or digits.
 *   2. CMU Pronouncing Dictionary — offline, instant.
 *   3. FreeDictionary API — network, cached for the session lifetime.
 *
 * Returns null when neither source has data (word stays unresolved; the user
 * can click to set stress manually).
 */
export async function resolveEnStress(word: string, signal?: AbortSignal): Promise<number | null> {
  if (isTechnicalToken(word)) return null;
  const cmuIdx = getEnStressIndex(word);
  if (cmuIdx !== null) return cmuIdx;
  return fetchOovStress(word, signal);
}
