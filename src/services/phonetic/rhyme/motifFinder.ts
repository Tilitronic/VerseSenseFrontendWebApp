/**
 * rhyme/motifFinder.ts
 *
 * Finds all recurring phoneme motifs in a flat IPA token sequence using a
 * three-pass pipeline:
 *
 *  Pass 1 — N-gram hashing (exact layer)
 *    Slide a window of width W ∈ [MIN_LEN … MAX_LEN] over the encoded poem.
 *    Any n-gram code that appears ≥ 2 times is a candidate exact motif.
 *    Time: O(N · W_range).
 *
 *  Pass 2 — N-gram hashing (fuzzy layer)
 *    Same algorithm on the fuzzy-encoded sequence.
 *    Candidates not already found by pass 1 become "near" motifs.
 *    Candidates not found by pass 2 on structural encoding become "structural".
 *
 *  Pass 3 — Maximal repeat deduplication
 *    Remove any motif whose occurrence set is a strict subset of a longer motif.
 *    Keeps only maximal repeats (prevents "аl" from shadowing "аlа").
 *
 *  Pass 4 — DTW refinement (optional, for near/structural candidates)
 *    For every pair of candidate spans in fuzzy/structural motifs, recompute
 *    exact similarity using Dynamic Time Warping with the substitutionCost
 *    matrix.  Pairs scoring above NEAR_THRESHOLD form the final near motif;
 *    pairs above STRUCTURAL_THRESHOLD form structural motifs.
 *
 * ── Flat sequence format ──────────────────────────────────────────────────────
 *
 * The caller builds a flat sequence of FlatToken records — one per IPA token
 * across all confirmed lines.  Boundaries are injected between words and lines
 * using WORD_BOUNDARY / LINE_BOUNDARY sentinel codes so that no motif spans
 * across a word or line boundary.
 */

import {
  WORD_BOUNDARY,
  LINE_BOUNDARY,
  substitutionCost,
  type EncodingLayer,
} from './phonemeEncoder';

// ── Configuration ─────────────────────────────────────────────────────────────

/** Minimum motif length in IPA tokens */
const MIN_LEN = 2;
/** Maximum motif length in IPA tokens */
const MAX_LEN = 7;
/** Minimum occurrences for a motif to be reported */
const MIN_OCCURRENCES = 2;

/**
 * DTW similarity thresholds (0 = identical, 1 = completely different).
 * Normalised by sequence length so longer matches aren't penalised.
 */
const NEAR_DTW_THRESHOLD       = 0.30; // allow up to 30% average substitution cost
const STRUCTURAL_DTW_THRESHOLD = 0.60;

// ── Flat token ────────────────────────────────────────────────────────────────

/**
 * One element in the flat poem sequence.
 * `code*` fields are pre-computed integer encodings for fast hashing.
 */
export interface FlatToken {
  /** Original IPA string */
  token: string;
  /** Render key for grid highlighting: `${wordId}:${sylIdx}:${tokIdx}` */
  renderKey: string;
  /** Word token id */
  wordId: string;
  lineIdx: number;
  codeExact:      number;
  codeFuzzy:      number;
  codeStructural: number;
}

// ── Internal: raw candidate ────────────────────────────────────────────────────

interface RawCandidate {
  /** Encoded tokens of this n-gram (for identity / dedup) */
  encodedPattern: number[];
  /** Original IPA token strings from the first occurrence */
  canonicalTokens: string[];
  /** Start positions (flat indices) of each occurrence */
  occurrenceStarts: number[];
  layer: EncodingLayer;
}

// ── Pass 1/2: N-gram hashing ──────────────────────────────────────────────────

function codeKey(layer: EncodingLayer, tok: FlatToken): number {
  if (layer === 'exact')      return tok.codeExact;
  if (layer === 'fuzzy')      return tok.codeFuzzy;
  return tok.codeStructural;
}

/**
 * Rolling polynomial hash of a fixed-length integer window.
 * Base chosen to minimise collisions for typical IPA code ranges (~200 values).
 */
const HASH_BASE  = 131;
const HASH_MOD   = 0x7fffffff; // 2^31 - 1

function polyHash(codes: number[]): number {
  let h = 0;
  for (const c of codes) {
    h = ((h * HASH_BASE) + c) & HASH_MOD;
  }
  return h;
}

/**
 * Slide a window of length `len` over the flat sequence, collecting all start
 * positions for each unique encoded pattern.  Positions that start with or
 * contain a boundary sentinel are skipped.
 */
function ngramPass(
  flat: FlatToken[],
  len: number,
  layer: EncodingLayer,
): Map<number, RawCandidate> {
  // hash → RawCandidate
  const candidates = new Map<number, RawCandidate>();

  for (let i = 0; i <= flat.length - len; i++) {
    // Reject any window that contains a boundary sentinel
    let hasBoundary = false;
    for (let j = i; j < i + len; j++) {
      const code = codeKey(layer, flat[j]!);
      if (code === WORD_BOUNDARY || code === LINE_BOUNDARY) {
        hasBoundary = true;
        break;
      }
    }
    if (hasBoundary) continue;

    // Build encoded pattern + hash
    const encoded: number[] = [];
    for (let j = i; j < i + len; j++) encoded.push(codeKey(layer, flat[j]!));
    const hash = polyHash(encoded);

    let existing = candidates.get(hash);
    if (!existing) {
      const canonicalTokens = flat.slice(i, i + len).map((t) => t.token);
      existing = { encodedPattern: encoded, canonicalTokens, occurrenceStarts: [], layer };
      candidates.set(hash, existing);
    }
    existing.occurrenceStarts.push(i);
  }

  // Keep only those appearing ≥ MIN_OCCURRENCES times
  for (const [hash, cand] of candidates) {
    if (cand.occurrenceStarts.length < MIN_OCCURRENCES) candidates.delete(hash);
  }
  return candidates;
}

// ── Pass 3: Maximal repeat deduplication ─────────────────────────────────────

/**
 * Returns true if every occurrence start in `shorter` is covered by some
 * occurrence in `longer` (i.e. the shorter motif appears inside the longer one
 * at the same position).
 *
 * "Covered" means: shorter.start ∈ [longer.start … longer.start + (longerLen - shorterLen)]
 */
function isCoveredBy(
  shorterStarts: number[],
  shorterLen: number,
  longerStarts: number[],
  longerLen: number,
): boolean {
  const longerSet = new Set(longerStarts);
  for (const s of shorterStarts) {
    // The short motif starting at `s` is covered if some longer motif starts
    // at position p where p <= s and p + longerLen >= s + shorterLen
    let covered = false;
    for (let offset = 0; offset <= longerLen - shorterLen; offset++) {
      if (longerSet.has(s - offset)) { covered = true; break; }
    }
    if (!covered) return false;
  }
  return true;
}

// ── Pass 4: DTW scoring ───────────────────────────────────────────────────────

/**
 * Compute normalised DTW distance between two IPA token sequences using
 * `substitutionCost` as the element-wise cost function.
 *
 * Returns a value in [0, 1]:
 *   0   = identical
 *   1   = completely unrelated
 *
 * Standard DTW O(n·m) DP with deletion/insertion cost = 0.5 (half a substitution).
 */
function dtwDistance(a: string[], b: string[]): number {
  const n = a.length, m = b.length;
  if (n === 0 || m === 0) return 1;

  // Flat DP table
  const dp = new Float32Array((n + 1) * (m + 1)).fill(Infinity);
  dp[0] = 0; // dp[0][0]

  const idx = (i: number, j: number) => i * (m + 1) + j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = substitutionCost(a[i - 1]!, b[j - 1]!);
      dp[idx(i, j)] = cost + Math.min(
        dp[idx(i - 1, j - 1)]!,  // match / substitute
        dp[idx(i - 1, j)]! + 0.5, // deletion
        dp[idx(i, j - 1)]! + 0.5, // insertion
      );
    }
  }

  const rawDist = dp[idx(n, m)] ?? Infinity;
  // Normalise by the longer sequence length so different lengths are comparable
  return Math.min(1, rawDist / Math.max(n, m));
}

// ── Public: exported result ────────────────────────────────────────────────────

export interface FoundMotif {
  /** Original IPA token strings of the canonical occurrence */
  canonicalTokens: string[];
  /** All start positions (flat indices into the `flat` array) */
  occurrenceStarts: number[];
  /** How many tokens each occurrence spans */
  length: number;
  tier: 'exact' | 'near' | 'structural';
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Find all recurring phoneme motifs in the flat token stream.
 *
 * @param flat  Ordered flat array of FlatToken, with boundaries injected
 *              between words (WORD_BOUNDARY) and lines (LINE_BOUNDARY).
 */
export function findMotifs(flat: FlatToken[]): FoundMotif[] {
  const allFound: FoundMotif[] = [];

  // Track which flat positions are already claimed by an exact motif,
  // so we don't emit redundant near/structural motifs for the same positions.
  const claimedByExact = new Set<string>(); // `${start}:${len}` keys

  // ── Pass 1 & 2: scan all window sizes ──────────────────────────────────────
  for (let len = MAX_LEN; len >= MIN_LEN; len--) {
    // --- Exact layer ---
    const exactCandidates = ngramPass(flat, len, 'exact');
    for (const cand of exactCandidates.values()) {
      // Deduplicate: remove occurrences already fully covered by a longer exact motif
      const uncoveredStarts = cand.occurrenceStarts.filter((s) => {
        // Check if this position was claimed at a longer length
        for (let longer = len + 1; longer <= MAX_LEN; longer++) {
          if (claimedByExact.has(`${s}:${longer}`)) return false;
        }
        return true;
      });
      if (uncoveredStarts.length < MIN_OCCURRENCES) continue;

      for (const s of uncoveredStarts) claimedByExact.add(`${s}:${len}`);

      allFound.push({
        canonicalTokens: cand.canonicalTokens,
        occurrenceStarts: uncoveredStarts,
        length: len,
        tier: 'exact',
      });
    }

    // --- Fuzzy layer (→ near motifs) ---
    const fuzzyCandidates = ngramPass(flat, len, 'fuzzy');
    for (const cand of fuzzyCandidates.values()) {
      // Skip any candidate whose positions are all already exact-claimed
      const newStarts = cand.occurrenceStarts.filter(
        (s) => !claimedByExact.has(`${s}:${len}`),
      );
      if (newStarts.length < MIN_OCCURRENCES) continue;

      // DTW-verify pairwise similarity between occurrence token strings
      const verifiedStarts: number[] = [];
      const occurrenceTokens = newStarts.map((s) =>
        flat.slice(s, s + len).map((t) => t.token),
      );
      for (let a = 0; a < occurrenceTokens.length; a++) {
        for (let b = a + 1; b < occurrenceTokens.length; b++) {
          const dist = dtwDistance(occurrenceTokens[a]!, occurrenceTokens[b]!);
          if (dist <= NEAR_DTW_THRESHOLD) {
            if (!verifiedStarts.includes(newStarts[a]!)) verifiedStarts.push(newStarts[a]!);
            if (!verifiedStarts.includes(newStarts[b]!)) verifiedStarts.push(newStarts[b]!);
          }
        }
      }
      if (verifiedStarts.length < MIN_OCCURRENCES) continue;

      allFound.push({
        canonicalTokens: cand.canonicalTokens,
        occurrenceStarts: verifiedStarts,
        length: len,
        tier: 'near',
      });
    }

    // --- Structural layer ---
    const structCandidates = ngramPass(flat, len, 'structural');
    for (const cand of structCandidates.values()) {
      const newStarts = cand.occurrenceStarts.filter(
        (s) => !claimedByExact.has(`${s}:${len}`),
      );
      if (newStarts.length < MIN_OCCURRENCES) continue;

      // Structural motifs need length ≥ 3 to avoid noise (V+C combos appear everywhere)
      if (len < 3) continue;

      const occurrenceTokens = newStarts.map((s) =>
        flat.slice(s, s + len).map((t) => t.token),
      );
      const verifiedStarts: number[] = [];
      for (let a = 0; a < occurrenceTokens.length; a++) {
        for (let b = a + 1; b < occurrenceTokens.length; b++) {
          const dist = dtwDistance(occurrenceTokens[a]!, occurrenceTokens[b]!);
          if (dist <= STRUCTURAL_DTW_THRESHOLD) {
            if (!verifiedStarts.includes(newStarts[a]!)) verifiedStarts.push(newStarts[a]!);
            if (!verifiedStarts.includes(newStarts[b]!)) verifiedStarts.push(newStarts[b]!);
          }
        }
      }
      if (verifiedStarts.length < MIN_OCCURRENCES) continue;

      allFound.push({
        canonicalTokens: cand.canonicalTokens,
        occurrenceStarts: verifiedStarts,
        length: len,
        tier: 'structural',
      });
    }
  }

  // ── Pass 3: Global maximal-repeat deduplication ───────────────────────────
  // Remove any motif whose every occurrence is a sub-span of a longer motif
  // in the same tier.
  const deduplicated: FoundMotif[] = [];
  for (let i = 0; i < allFound.length; i++) {
    const cand = allFound[i]!;
    let absorbed = false;
    for (let j = 0; j < allFound.length; j++) {
      if (i === j) continue;
      const other = allFound[j]!;
      if (other.length <= cand.length) continue;
      if (other.tier !== cand.tier) continue;
      if (
        isCoveredBy(
          cand.occurrenceStarts,
          cand.length,
          other.occurrenceStarts,
          other.length,
        )
      ) {
        absorbed = true;
        break;
      }
    }
    if (!absorbed) deduplicated.push(cand);
  }

  return deduplicated;
}
