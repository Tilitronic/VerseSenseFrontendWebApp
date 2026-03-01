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
const MAX_LEN = 16;
/** Minimum occurrences for a motif to be reported */
const MIN_OCCURRENCES = 2;

/**
 * DTW similarity thresholds (0 = identical, 1 = completely different).
 * Normalised by sequence length so longer matches aren't penalised.
 */
const NEAR_DTW_THRESHOLD = 0.3; // allow up to 30% average substitution cost
const STRUCTURAL_DTW_THRESHOLD = 0.6;

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
  codeExact: number;
  codeFuzzy: number;
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
  if (layer === 'exact') return tok.codeExact;
  if (layer === 'fuzzy') return tok.codeFuzzy;
  return tok.codeStructural;
}

/**
 * Rolling polynomial hash of a fixed-length integer window.
 * Base chosen to minimise collisions for typical IPA code ranges (~200 values).
 */
const HASH_BASE = 131;
const HASH_MOD = 0x7fffffff; // 2^31 - 1

function polyHash(codes: number[]): number {
  let h = 0;
  for (const c of codes) {
    h = (h * HASH_BASE + c) & HASH_MOD;
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
      if (longerSet.has(s - offset)) {
        covered = true;
        break;
      }
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
  const n = a.length,
    m = b.length;
  if (n === 0 || m === 0) return 1;

  // Flat DP table
  const dp = new Float32Array((n + 1) * (m + 1)).fill(Infinity);
  dp[0] = 0; // dp[0][0]

  const idx = (i: number, j: number) => i * (m + 1) + j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = substitutionCost(a[i - 1]!, b[j - 1]!);
      dp[idx(i, j)] =
        cost +
        Math.min(
          dp[idx(i - 1, j - 1)]!, // match / substitute
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
  /** Encoded pattern (for dedup/merging) */
  encodedPattern: number[];
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

  // ── Pass 1 & 2: collect ALL candidates at all lengths, all tiers ──────────
  // No inter-tier blocking here — we let Pass 3 deduplicate.
  // Within the exact tier only: track positions already claimed by a LONGER
  // exact motif so we don't emit both "ʋiʋɑrɔstɪ̞slɑu̯" (len=12) and "ʋiʋɑ"
  // (len=4) as separate exact motifs when every occurrence of the shorter is
  // fully contained in the longer.
  //
  // Near/structural motifs are NEVER blocked by exact claims — a sub-sequence
  // that is part of a long exact repeat may still form a near-rhyme with a
  // different word on a different line (e.g. ɑu̯ inside the long repeat still
  // near-rhymes with ɑw on the next line).

  // exact span set: start → length, for coverage checks within exact tier only
  const exactSpans: Array<{ start: number; len: number }> = [];

  for (let len = MAX_LEN; len >= MIN_LEN; len--) {
    // --- Exact layer ---
    const exactCandidates = ngramPass(flat, len, 'exact');
    for (const cand of exactCandidates.values()) {
      // Within the exact tier: drop occurrences whose start position is
      // already fully contained inside a previously found LONGER exact span.
      const uncoveredStarts = cand.occurrenceStarts.filter(
        (s) => !exactSpans.some((sp) => sp.start <= s && sp.start + sp.len >= s + len),
      );
      if (uncoveredStarts.length < MIN_OCCURRENCES) continue;

      for (const s of uncoveredStarts) exactSpans.push({ start: s, len });

      allFound.push({
        canonicalTokens: cand.canonicalTokens,
        encodedPattern: cand.encodedPattern,
        occurrenceStarts: uncoveredStarts,
        length: len,
        tier: 'exact',
      });
    }

    // --- Fuzzy layer (→ near motifs) ---
    const fuzzyCandidates = ngramPass(flat, len, 'fuzzy');
    for (const cand of fuzzyCandidates.values()) {
      // Drop occurrences that are already covered by an exact motif at the same length
      const exactStartsAtLen = new Set<number>();
      for (const ec of ngramPass(flat, len, 'exact').values()) {
        for (const s of ec.occurrenceStarts) exactStartsAtLen.add(s);
      }
      const newStarts = cand.occurrenceStarts.filter((s) => !exactStartsAtLen.has(s));
      if (newStarts.length < MIN_OCCURRENCES) continue;

      // DTW-verify pairwise similarity
      const occurrenceTokens = newStarts.map((s) => flat.slice(s, s + len).map((t) => t.token));
      const verifiedStarts: number[] = [];
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
        encodedPattern: cand.encodedPattern,
        occurrenceStarts: verifiedStarts,
        length: len,
        tier: 'near',
      });
    }

    // --- Structural layer ---
    if (len < 3) continue; // avoid noise for very short structural patterns

    const structCandidates = ngramPass(flat, len, 'structural');
    for (const cand of structCandidates.values()) {
      const fuzzyStartsAtLen = new Set<number>();
      for (const fc of ngramPass(flat, len, 'fuzzy').values()) {
        for (const s of fc.occurrenceStarts) fuzzyStartsAtLen.add(s);
      }
      const newStarts = cand.occurrenceStarts.filter((s) => !fuzzyStartsAtLen.has(s));
      if (newStarts.length < MIN_OCCURRENCES) continue;

      const occurrenceTokens = newStarts.map((s) => flat.slice(s, s + len).map((t) => t.token));
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
        encodedPattern: cand.encodedPattern,
        occurrenceStarts: verifiedStarts,
        length: len,
        tier: 'structural',
      });
    }
  }

  // ── Pass 3: Deduplication within each tier ────────────────────────────────
  //
  // Rule: within a tier, remove motif A if EVERY one of A's occurrences is
  // fully contained inside some occurrence of a longer motif B of the SAME tier.
  //
  // We deliberately do NOT absorb across tiers: a near-rhyme motif (ɑu̯ ~ ɑw)
  // must survive even if ɑu̯ also appears inside a long exact repeat, because
  // it has occurrences (ɑw on line 2) that are NOT inside the exact repeat.
  //
  // IMPORTANT: when we absorb a short motif into a long one, we track the
  // absorbed short motifs so that in Pass 4 we can "promote" their positions
  // into any surviving motif with the same canonical tokens (e.g. slɑu̯ on
  // lines 1/16 is absorbed into the long ʋiʋɑrɔstɪ̞slɑu̯ repeat, but slɑu̯ on
  // lines 3/14 survives — so we then inject lines 1/16 into that survivor).
  interface AbsorbedRecord {
    encodedPattern: number[];
    occurrenceStarts: number[];
    length: number;
    tier: 'exact' | 'near' | 'structural';
  }
  const absorbed: AbsorbedRecord[] = [];

  const deduplicated: FoundMotif[] = [];
  for (let i = 0; i < allFound.length; i++) {
    const cand = allFound[i]!;
    let isAbsorbed = false;
    for (let j = 0; j < allFound.length; j++) {
      if (i === j) continue;
      const other = allFound[j]!;
      if (other.tier !== cand.tier) continue; // same tier only
      if (other.length <= cand.length) continue;
      if (isCoveredBy(cand.occurrenceStarts, cand.length, other.occurrenceStarts, other.length)) {
        isAbsorbed = true;
        break;
      }
    }
    if (!isAbsorbed) {
      deduplicated.push(cand);
    } else {
      absorbed.push({
        encodedPattern: cand.encodedPattern,
        occurrenceStarts: cand.occurrenceStarts,
        length: cand.length,
        tier: cand.tier,
      });
    }
  }

  // ── Pass 4: Promote absorbed sub-motifs into surviving kin ───────────────
  //
  // For each absorbed motif, check if a surviving motif has the SAME encoded
  // pattern (same tier, same length). If so, merge the absorbed starts into
  // the survivor. This handles the case where slɑu̯ on lines 1/16 is swallowed
  // by the long whole-phrase exact repeat, but the identical slɑu̯ on lines 3/14
  // survives — after promotion all four lines share the same motif.
  for (const abs of absorbed) {
    const patKey = abs.encodedPattern.join(',');
    const survivor = deduplicated.find(
      (m) =>
        m.tier === abs.tier && m.length === abs.length && m.encodedPattern.join(',') === patKey,
    );
    if (survivor) {
      for (const s of abs.occurrenceStarts) {
        if (!survivor.occurrenceStarts.includes(s)) {
          survivor.occurrenceStarts.push(s);
        }
      }
    }
  }

  return deduplicated;
}
