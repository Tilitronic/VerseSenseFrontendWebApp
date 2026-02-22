/**
 * similarity.ts
 *
 * Computes a phonetic similarity score (0.0 – 1.0) between two IpaSymbol
 * objects. Used by the rhyme grouper and the canvas web-drawing layer.
 *
 * Rules:
 *   - Same object / same symbol           → 1.0
 *   - Cross-type (consonant vs vowel)     → 0.0
 *   - Two consonants                      → weighted feature overlap
 *   - Two vowels                          → weighted feature overlap
 *
 * Feature weights are tunable; defaults reflect standard phonological
 * distance priorities (manner ≈ place > voicing for consonants;
 * height > backness > roundedness for vowels).
 */

import { type IpaSymbol, type Consonant, type Vowel, PhonemeType } from './IpaSymbol';

// ─────────────────────────────────────────────────────────────────────────────
// Weight configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface ConsonantWeights {
  place: number;
  manner: number;
  voicing: number;
  palatalized: number;
}

export interface VowelWeights {
  height: number;
  backness: number;
  roundedness: number;
}

export const DEFAULT_CONSONANT_WEIGHTS: ConsonantWeights = {
  place:       0.35,
  manner:      0.35,
  voicing:     0.20,
  palatalized: 0.10,
};

export const DEFAULT_VOWEL_WEIGHTS: VowelWeights = {
  height:      0.50,
  backness:    0.35,
  roundedness: 0.15,
};

// ─────────────────────────────────────────────────────────────────────────────
// Ordinal maps — used to compute partial credit for "close but not equal"
// features (e.g. ALVEOLAR and POSTALVEOLAR are adjacent places).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Place of articulation ordered front → back.
 * Adjacent places receive 0.5 partial credit instead of 0.
 */
const PLACE_ORDER = [
  'BILABIAL',
  'LABIODENTAL',
  'LINGUOLABIAL',
  'DENTAL',
  'ALVEOLAR',
  'POSTALVEOLAR',
  'RETROFLEX',
  'PALATAL',
  'VELAR',
  'LABIALVELAR',
  'UVULAR',
  'PHARYNGEAL/EPIGLOTTAL',
  'GLOTTAL',
] as const;

/**
 * Manner of articulation grouped by acoustic similarity.
 * Phonemes within the same group receive 0.5 partial credit.
 */
const MANNER_GROUPS: string[][] = [
  ['PLOSIVE', 'IMPLOSIVE'],
  ['NASAL'],
  ['TRILL', 'TAP/FLAP'],
  ['SIBILANT FRICATIVE', 'SIBILANT AFFRICATE'],
  ['NON-SIBILANT FRICATIVE', 'NON-SIBILANT AFFRICATE'],
  ['APPROXIMANT', 'LATERAL APPROXIMANT'],
  ['LATERAL FRICATIVE', 'LATERAL AFFRICATE', 'LATERAL TAP/FLAP'],
];

/** VowelHeight ordered close → open */
const HEIGHT_ORDER = [
  'close',
  'near-close',
  'close-mid',
  'mid',
  'open-mid',
  'near-open',
  'open',
] as const;

/** VowelBackness ordered front → back */
const BACKNESS_ORDER = [
  'front',
  'near-front',
  'central',
  'near-back',
  'back',
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Ordinal scoring helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scores two values on an ordered scale.
 * - Same value       → 1.0
 * - 1 step apart     → 0.5
 * - 2+ steps apart   → 0.0
 */
function ordinalScore(a: string, b: string, order: readonly string[]): number {
  if (a === b) return 1.0;
  const ia = order.indexOf(a);
  const ib = order.indexOf(b);
  if (ia === -1 || ib === -1) return 0.0;
  return Math.abs(ia - ib) === 1 ? 0.5 : 0.0;
}

/**
 * Scores two manner strings.
 * - Same manner      → 1.0
 * - Same group       → 0.5
 * - Different group  → 0.0
 */
function mannerScore(a: string, b: string): number {
  if (a === b) return 1.0;
  for (const group of MANNER_GROUPS) {
    if (group.includes(a) && group.includes(b)) return 0.5;
  }
  return 0.0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core similarity functions
// ─────────────────────────────────────────────────────────────────────────────

function consonantSimilarity(
  a: Consonant,
  b: Consonant,
  weights: ConsonantWeights,
): number {
  const placeScore      = ordinalScore(a.place, b.place, PLACE_ORDER);
  const mannerScoreVal  = mannerScore(a.manner, b.manner);
  const voicingScore    = a.voicing === b.voicing ? 1.0 : 0.0;
  const palScore        = a.palatalized === b.palatalized ? 1.0 : 0.0;

  return (
    placeScore     * weights.place +
    mannerScoreVal * weights.manner +
    voicingScore   * weights.voicing +
    palScore       * weights.palatalized
  );
}

function vowelSimilarity(
  a: Vowel,
  b: Vowel,
  weights: VowelWeights,
): number {
  const heightScore     = ordinalScore(a.height, b.height, HEIGHT_ORDER);
  const backnessScore   = ordinalScore(a.backness, b.backness, BACKNESS_ORDER);
  const roundedScore    = a.roundedness === b.roundedness ? 1.0 : 0.0;

  return (
    heightScore   * weights.height +
    backnessScore * weights.backness +
    roundedScore  * weights.roundedness
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface SimilarityOptions {
  consonantWeights?: ConsonantWeights;
  vowelWeights?: VowelWeights;
}

/**
 * Computes phonetic similarity between two IPA phoneme objects.
 *
 * @returns A value in [0.0, 1.0] where 1.0 = identical, 0.0 = maximally different.
 *
 * @example
 * const p = PhonemeRegistry.getOrThrow('p');
 * const b = PhonemeRegistry.getOrThrow('b');
 * getSimilarity(p, b); // ≈ 0.80 — same place+manner, differ only in voicing
 *
 * const a = PhonemeRegistry.getOrThrow('a');
 * const e = PhonemeRegistry.getOrThrow('e');
 * getSimilarity(a, e); // ≈ 0.50 — adjacent height, same backness, same roundedness
 */
export function getSimilarity(
  a: IpaSymbol,
  b: IpaSymbol,
  options: SimilarityOptions = {},
): number {
  // Identical
  if (a === b || a.symbol === b.symbol) return 1.0;

  // Cross-type → no phonetic similarity
  if (a.type !== b.type) return 0.0;

  if (a.type === PhonemeType.CONSONANT) {
    return consonantSimilarity(
      a as Consonant,
      b as Consonant,
      options.consonantWeights ?? DEFAULT_CONSONANT_WEIGHTS,
    );
  }

  return vowelSimilarity(
    a as Vowel,
    b as Vowel,
    options.vowelWeights ?? DEFAULT_VOWEL_WEIGHTS,
  );
}

/**
 * Computes similarity between two IPA symbol strings.
 * Requires a registry lookup function to be passed in, avoiding circular
 * dependency between similarity.ts and PhonemeRegistry.ts.
 *
 * In practice, call it via the PhonemeRegistry's own `getSimilarity` helper,
 * or pass `PhonemeRegistry.get.bind(PhonemeRegistry)` as the resolver.
 *
 * Returns 0.0 if either symbol is not found.
 *
 * @example
 * import { PhonemeRegistry } from './PhonemeRegistry';
 * getSimilarityBySymbol('p', 'b', PhonemeRegistry.get.bind(PhonemeRegistry));
 */
export function getSimilarityBySymbol(
  symbolA: string,
  symbolB: string,
  resolve: (symbol: string) => IpaSymbol | undefined,
  options: SimilarityOptions = {},
): number {
  const a = resolve(symbolA);
  const b = resolve(symbolB);
  if (!a || !b) return 0.0;
  return getSimilarity(a, b, options);
}
