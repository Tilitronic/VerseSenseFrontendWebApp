/**
 * wordTranscription.ts
 *
 * Dispatcher: given a confirmed IWordToken, produce a language-appropriate
 * array of TranscribedSyllable objects ready for the grid visualizer.
 */

import type { Language } from 'src/model/Language';
import type { IWordToken } from 'src/model/Token';
import { countVowels } from 'src/services/poetryEngines/shared/wordVowels';
import { transcribeUkrainian } from './uaTranscription';
import { transcribeEnglish } from './enTranscription';
import { transcribePolish } from './plTranscription';
import { tokenizeIPA } from './ipaTokenizer';

// ── Shared output type ────────────────────────────────────────────────────────

export interface TranscribedSyllable {
  /** IPA representation of this syllable (full string) */
  ipa: string;
  /**
   * Ordered list of discrete IPA sound tokens within this syllable.
   * Each token = one phoneme (e.g. "tʃ" is ONE token, not two).
   * Used by the grid to render one sub-cell per sound.
   */
  ipaTokens: string[];
  /** Original grapheme text of this syllable (best-effort) */
  text: string;
  /** Whether this syllable bears the word stress */
  stressed: boolean;
  /** Whether this syllable ends on a vowel (open syllable) */
  isOpen: boolean;
}

export interface TranscribedWord {
  /** Original word text */
  surface: string;
  /** Language used for transcription */
  language: Language;
  /** Syllables (empty for zero-vowel words — they get a single passthrough entry) */
  syllables: TranscribedSyllable[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function uaTranscribe(text: string, stressIndex: number): TranscribedSyllable[] {
  const syllables = transcribeUkrainian(text, stressIndex);
  return syllables.map((s) => ({
    ipa: s.ipa,
    ipaTokens: tokenizeIPA(s.ipa),
    text: s.ipa,
    stressed: s.stressed,
    isOpen: s.isOpen,
  }));
}

function enTranscribe(text: string, stressIndex: number): TranscribedSyllable[] {
  return transcribeEnglish(text, stressIndex).map((s) => ({
    ipa: s.ipa,
    ipaTokens: tokenizeIPA(s.ipa),
    text: s.ipa,
    stressed: s.stressed,
    isOpen: s.isOpen,
  }));
}

function plTranscribe(text: string, stressIndex: number): TranscribedSyllable[] {
  return transcribePolish(text, stressIndex).map((s) => ({
    ipa: s.ipa,
    ipaTokens: tokenizeIPA(s.ipa),
    text: s.ipa,
    stressed: s.stressed,
    isOpen: s.isOpen,
  }));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Produce a TranscribedWord from a confirmed IWordToken.
 * Words with no vowels are returned with a single passthrough syllable (no IPA).
 */
export function transcribeWord(token: IWordToken): TranscribedWord {
  const { text, language, stressIndex } = token;

  // Zero-vowel words (prepositions, etc.) — just show the surface form
  if (countVowels(text, language) === 0) {
    return {
      surface: text,
      language,
      syllables: [{ ipa: text, ipaTokens: [text], text, stressed: false, isOpen: false }],
    };
  }

  const idx = stressIndex ?? 0;
  let syllables: TranscribedSyllable[];

  switch (language) {
    case 'ua':
      syllables = uaTranscribe(text, idx);
      break;
    case 'en-us':
    case 'en-gb':
      syllables = enTranscribe(text, idx);
      break;
    case 'pl':
      syllables = plTranscribe(text, idx);
      break;
    default:
      syllables = [
        { ipa: text, ipaTokens: tokenizeIPA(text), text, stressed: true, isOpen: false },
      ];
  }

  // Safety: if engine returned nothing, fall back to surface
  if (syllables.length === 0) {
    syllables = [{ ipa: text, ipaTokens: tokenizeIPA(text), text, stressed: true, isOpen: false }];
  }

  return { surface: text, language, syllables };
}
