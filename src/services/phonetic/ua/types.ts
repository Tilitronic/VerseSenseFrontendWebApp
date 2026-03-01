/**
 * types.ts — Core types for the Ukrainian phonetic engine.
 *
 * These types define the pipeline's internal representation.
 * All passes operate on PhoneticToken[], making the system
 * composable and each pass independently testable.
 *
 * Portable: these same type definitions can be replicated
 * as Python TypedDicts / dataclasses for the backend engine.
 */

// ── Phoneme classification enums ────────────────────────────────────────────

export type VoicePower = 'voiceless' | 'voiced' | 'sonorant';
export type Place = 'labial' | 'dental' | 'postalveolar' | 'palatal' | 'velar' | 'glottal';
export type Manner = 'plosive' | 'fricative' | 'affricate' | 'trill' | 'lateral' | 'nasal' | 'approximant';
export type Softness = 'hard' | 'soft';
export type Nasality = 'oral' | 'nasal';

export type VowelHeight = 'high' | 'high-mid' | 'mid' | 'low';
export type VowelBackness = 'front' | 'central' | 'back';
export type VowelRounding = 'rounded' | 'unrounded';

// ── Token types ─────────────────────────────────────────────────────────────

export type TokenType = 'consonant' | 'vowel' | 'glide' | 'glottal' | 'boundary';

/**
 * A single phonetic token in the pipeline.
 * Created by the Tokenizer pass, modified by subsequent passes.
 */
export interface PhoneticToken {
  /** IPA symbol for this phoneme (may be mutated by passes) */
  ipa: string;
  /** Original Cyrillic grapheme(s) that produced this token */
  source: string;
  /** Token classification */
  type: TokenType;
  /** 0-based index of this vowel within the word (-1 for non-vowels) */
  vowelIndex: number;
  /** Whether this token is the stressed vowel */
  stressed: boolean;
  /** Whether this consonant is palatalized */
  palatalized: boolean;
  /** Full 5D feature vector for consonants (null for vowels) */
  consonantFeatures: ConsonantFeatures | null;
  /** Full 3D feature vector for vowels (null for consonants) */
  vowelFeatures: VowelFeatures | null;
}

export interface ConsonantFeatures {
  voicePower: VoicePower;
  place: Place;
  manner: Manner;
  softness: Softness;
  nasality: Nasality;
}

export interface VowelFeatures {
  height: VowelHeight;
  backness: VowelBackness;
  rounding: VowelRounding;
  stable: boolean;
}

// ── Syllable types ──────────────────────────────────────────────────────────

export interface UaSyllable {
  /** IPA string for this syllable */
  ipa: string;
  /** Ordered tokens that compose this syllable */
  tokens: PhoneticToken[];
  /** Whether this syllable is stressed */
  stressed: boolean;
  /** Whether this syllable ends on a vowel (open syllable) */
  isOpen: boolean;
}

// ── Pipeline result ─────────────────────────────────────────────────────────

export interface UaTranscriptionResult {
  /** The input word */
  word: string;
  /** 0-based stressed vowel index that was used */
  stressIndex: number;
  /** Flat array of all phonetic tokens (post all passes) */
  tokens: PhoneticToken[];
  /** Syllabified output */
  syllables: UaSyllable[];
  /** Flat IPA string (convenience) */
  ipa: string;
}
