/**
 * Ukrainian Phonetic Engine — public API barrel export
 */

// Pipeline entry points
export { transcribeUkrainianPipeline, transcribeUkrainian } from './uaPhoneticPipeline';

// Individual passes (for testing / advanced usage)
export { tokenize } from './tokenizer';
export { applyGeminates } from './geminatePass';
export { applyPalatalization } from './palatalizationPass';
export { applyVoicingAssimilation } from './voicingAssimilationPass';
export { applyPlaceAssimilation } from './placeAssimilationPass';
export { applyVowelAllophones } from './vowelAllophonePass';
export { applyVAllophones } from './vAllophonePass';
export { syllabify } from './syllabifier';

// Types
export type {
  PhoneticToken,
  ConsonantFeatures,
  VowelFeatures,
  UaSyllable,
  UaTranscriptionResult,
  TokenType,
  VoicePower,
  Place,
  Manner,
  Softness,
  Nasality,
  VowelHeight,
  VowelBackness,
  VowelRounding,
} from './types';
