/**
 * soundPatternAnalyzer.ts
 *
 * For every IPA token that appears ≥ MIN_COUNT times in the poem, computes a
 * per-occurrence opacity based on how densely that sound clusters locally.
 *
 * Formula
 * -------
 * For each occurrence at flat-token index i, the "local gap" is the minimum
 * distance to the nearest OTHER occurrence of the same token (left or right).
 *
 *   opacity(gap) = max(ALPHA_MIN, exp(-gap / LAMBDA))
 *
 * Constants:
 *   LAMBDA    = 8   → half-power at gap ≈ 5 tokens
 *   ALPHA_MIN = 0.05 → floor so isolated occurrences still get a faint tint
 *
 * Examples (gap → opacity):
 *   0  → 1.00   (adjacent repetition: "vv")
 *   1  → 0.88   ("vtv" — one token between)
 *   3  → 0.69
 *   8  → 0.37
 *   20 → 0.08
 *   ∞  → 0.05
 */

const MIN_COUNT = 3; // sound must appear at least this many times overall
const LAMBDA = 8; // exponential decay constant (tokens)
const ALPHA_MIN = 0.05; // minimum opacity even for isolated occurrences

export interface SoundOpacityMap {
  /**
   * Maps flat-token-index → opacity [0.05 … 1.0].
   * Only contains entries for tokens that qualify (≥ MIN_COUNT occurrences).
   */
  opacityByIndex: Map<number, number>;
  /** Set of token strings that are patterning (for quick "does this sound pattern?" checks). */
  patterningSounds: Set<string>;
}

/**
 * Analyse a flat ordered list of IPA tokens and return per-occurrence opacities.
 *
 * @param tokens  Ordered flat array of all IPA tokens across confirmed lines.
 */
export function analyzeSoundPatterns(tokens: string[]): SoundOpacityMap {
  const opacityByIndex = new Map<number, number>();
  const patterningSounds = new Set<string>();

  if (tokens.length === 0) return { opacityByIndex, patterningSounds };

  // Build per-token position lists
  const occurrences = new Map<string, number[]>();
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    let list = occurrences.get(t);
    if (!list) {
      list = [];
      occurrences.set(t, list);
    }
    list.push(i);
  }

  for (const [token, positions] of occurrences) {
    if (positions.length < MIN_COUNT) continue;
    patterningSounds.add(token);

    // For each occurrence, find the nearest neighbour gap
    for (let k = 0; k < positions.length; k++) {
      const pos = positions[k]!;
      // Gap to previous same-token (exclusive count of tokens between)
      const gapLeft = k > 0 ? pos - positions[k - 1]! - 1 : Infinity;
      // Gap to next same-token
      const gapRight = k < positions.length - 1 ? positions[k + 1]! - pos - 1 : Infinity;

      const gap = Math.min(gapLeft, gapRight);
      const opacity = gap === Infinity ? ALPHA_MIN : Math.max(ALPHA_MIN, Math.exp(-gap / LAMBDA));

      opacityByIndex.set(pos, opacity);
    }
  }

  return { opacityByIndex, patterningSounds };
}
