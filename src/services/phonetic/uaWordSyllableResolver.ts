import { getPhoneme } from 'src/services/poetryEngines/ua/Phonetizer';
import { Sylabizer, type Syllable as LegacyUaSyllable } from 'src/services/poetryEngines/ua/Sylabizer';

export type WordSyllable = LegacyUaSyllable;

/**
 * Resolve Ukrainian word syllables for UI consumers.
 *
 * NOTE: This currently delegates to the legacy UA phonetic engine
 * (Phonetizer + Sylabizer). The wrapper gives us a stable, clear API while
 * we progressively migrate syllable resolution to WASM-backed providers.
 */
export function resolveUkrainianWordSyllables(
  word: string,
  stressedSyllableIndex: number | null,
): WordSyllable[] {
  const phonemes = getPhoneme(word.toLowerCase());
  return Sylabizer.createSyllables(phonemes, stressedSyllableIndex ?? 0);
}
