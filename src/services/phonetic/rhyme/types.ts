/**
 * rhyme/types.ts
 *
 * Shared type definitions for the phoneme-motif / rhyme detection system.
 *
 * ── Design philosophy ─────────────────────────────────────────────────────────
 *
 * A "rhyme" is defined broadly: any recurring sequence of phonetically similar
 * sounds, at ANY position in the text (beginning, middle, end of line).
 * This subsumes classical end-rhymes, internal rhymes, alliteration, and
 * assonance chains as special cases of the same primitive: a PhonemeMotif.
 *
 * ── Tier definition ───────────────────────────────────────────────────────────
 *
 *  EXACT      — token-for-token identical IPA sequence (e.g. "ала" = "ала")
 *  NEAR       — same sequence with 1–2 substitutions within the same
 *               psychoacoustic family (e.g. voiced/voiceless alternation:
 *               "пата" ≈ "бада", or soft/hard: "оля" ≈ "ола")
 *  STRUCTURAL — same consonant/vowel skeleton (CV pattern) but tokens differ
 *               across families (e.g. "стра" ~ "шпра" — both C+C+C+V)
 */

// ── Occurrence ────────────────────────────────────────────────────────────────

/**
 * One occurrence of a phoneme motif in the poem.
 *
 * Coordinates are expressed in three levels:
 *   lineIdx   → which line (matches store.document.lines index)
 *   wordId    → which word token (matches IWordToken.id)
 *   sylIdx    → which syllable within the word (0-based)
 *   tokStart  → first IPA token index within the syllable (inclusive)
 *   tokEnd    → last  IPA token index within the syllable (inclusive)
 *
 * A single occurrence may span across multiple syllables of one word.
 * Cross-word occurrences are split into per-word spans.
 */
export interface MotifSpan {
  lineIdx: number;
  wordId: string;
  /** Flat render-key prefix: `${wordId}:${sylIdx}:${tokIdx}` used by grid */
  renderKeys: string[];
}

// ── Motif ─────────────────────────────────────────────────────────────────────

export type MotifTier = 'exact' | 'near' | 'structural';

/**
 * A discovered repeating phoneme pattern.
 *
 * `canonicalTokens` is the IPA token sequence of the first (or most frequent)
 * occurrence, used for display and as the "canonical form" of the pattern.
 */
export interface PhonemeMotif {
  /** Stable identifier (hash of canonical token sequence + tier) */
  id: string;

  tier: MotifTier;

  /** Canonical IPA tokens for this motif (from the first occurrence) */
  canonicalTokens: string[];

  /** All spans across the poem that match this motif */
  spans: MotifSpan[];

  /**
   * Display color for this motif group (HSL string).
   * Assigned by rhymeAnalyzer to give each group a unique hue.
   */
  color: string;

  /**
   * Visual weight in [0, 1].
   * Higher = more opaque / vivid stripe.
   * Driven by motif length and average proximity between occurrences:
   *   longer motif  → higher weight
   *   occurrences closer together → higher weight
   */
  opacity: number;
}

// ── Analysis result ───────────────────────────────────────────────────────────

export interface RhymeAnalysis {
  motifs: PhonemeMotif[];

  /**
   * Fast lookup: renderKey → motif id(s) covering that cell.
   * A single cell can belong to multiple overlapping motifs.
   */
  cellMotifs: Map<string, string[]>;
}
