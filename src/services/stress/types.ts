/**
 * Stress resolution result for a single Ukrainian word.
 */
export type StressSource =
  /** Word has only one syllable — stress is trivially known. */
  | 'monosyllable'
  /** DB trie found a unique, non-heteronym entry — reliable. */
  | 'db'
  /** DB trie found the word but it is a heteronym (замок / замок).
   *  First stress option is used; user must confirm. */
  | 'heteronym'
  /** DB trie found the word but it has freely variative stress (помилка / помилка).
   *  Any stress position is correct; user may still override. */
  | 'variative'
  /** ML model predicted the stress for an OOV word.
   *  User must confirm. */
  | 'ml'
  /** Word not found in DB and ML returned no prediction. */
  | 'unresolved';

export interface StressResolution {
  /**
   * 0-based index of the stressed syllable.
   * Equals the 0-based vowel index returned by the trie because Ukrainian
   * has exactly one vowel (= one nucleus) per syllable.
   * `null` only when source === 'unresolved'.
   */
  syllableIndex: number | null;

  /**
   * All valid stress positions for ambiguous words, ordered most-common first.
   * Only populated when `source` is `'heteronym'` or `'variative'`.
   * Length ≥ 2 means the word has multiple valid stress positions.
   */
  stresses?: number[];

  /**
   * Trie classification of the ambiguity type (mirrors `LookupResult.type`).
   * - `'variative'` — multiple positions equally orthographically correct
   *   (e.g. _по́милка_ / _поми́лка_). Either choice is acceptable.
   * - `'heteronym'` — different meanings or grammatical forms
   *   (e.g. _за́мок_ "lock" / _замо́к_ "castle"). Context-dependent.
   * Only set when `source` is `'heteronym'` or `'variative'`.
   */
  stressType?: 'unique' | 'variative' | 'heteronym';

  /**
   * Whether this resolution counts as confirmed without user interaction:
   * - `true`  for 'monosyllable' and 'db'
   * - `false` for 'heteronym', 'ml', 'unresolved'
   */
  confirmed: boolean;

  /** How the stress was determined. */
  source: StressSource;
}

/**
 * Optional ML predictor plug-in interface.
 * Implement this and pass it to `UaStressResolver` to enable ML fallback.
 */
export interface IMlStressPredictor {
  /**
   * Predict the stressed vowel index (0-based) for a word not found in the DB.
   * Return `null` if the model cannot make a prediction.
   */
  predict(word: string): Promise<number | null>;
}
