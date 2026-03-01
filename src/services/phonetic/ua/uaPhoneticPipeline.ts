/**
 * uaPhoneticPipeline.ts — Ukrainian Phonetic Transcription Pipeline
 *
 * Orchestrates all passes in order:
 *   1.  tokenize()                — Cyrillic graphemes → PhoneticToken[]
 *   1b. applyGeminates()          — merge doubled consonants → Cː
 *   2.  applyPalatalization()     — regressive dental softening
 *   3.  applyVoicingAssimilation()— regressive obstruent voicing
 *   3b. applyPlaceAssimilation()  — sibilant & affricate place assimilation
 *   4.  applyVowelAllophones()    — stress-aware vowel shifts
 *   5.  applyVAllophones()        — positional allophones of /в/
 *   6.  syllabify()               — token-aware syllabification
 *
 * Returns a UaTranscriptionResult with tokens, syllables, and flat IPA.
 *
 * This is the single entry point for the new Ukrainian engine.
 * It replaces the old uaTranscription.ts transcribeUkrainian() function.
 */

import type { UaTranscriptionResult } from './types';
import { tokenize } from './tokenizer';
import { applyGeminates } from './geminatePass';
import { applyPalatalization } from './palatalizationPass';
import { applyVoicingAssimilation } from './voicingAssimilationPass';
import { applyPlaceAssimilation } from './placeAssimilationPass';
import { applyVowelAllophones } from './vowelAllophonePass';
import { applyVAllophones } from './vAllophonePass';
import { syllabify } from './syllabifier';

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Transcribe a Ukrainian word through the full phonetic pipeline.
 *
 * @param word - Ukrainian word in Cyrillic (any case)
 * @param stressIndex - 0-based index of the stressed VOWEL (among vowels only)
 * @returns Full transcription result with tokens, syllables, and IPA string
 */
export function transcribeUkrainianPipeline(
  word: string,
  stressIndex: number,
): UaTranscriptionResult {
  if (!word) {
    return {
      word: '',
      stressIndex: 0,
      tokens: [],
      syllables: [],
      ipa: '',
    };
  }

  // ── Pass 1: Tokenize ──────────────────────────────────────────────────
  let tokens = tokenize(word);

  // ── Pass 1b: Geminate consonant merging ───────────────────────────────
  tokens = applyGeminates(tokens);

  // Clamp stress index to valid range
  const totalVowels = tokens.filter((t) => t.type === 'vowel').length;
  const safeStress = totalVowels > 0 ? Math.min(Math.max(0, stressIndex), totalVowels - 1) : 0;

  // ── Pass 2: Palatalization propagation ────────────────────────────────
  applyPalatalization(tokens);

  // ── Pass 3: Voicing assimilation ──────────────────────────────────────
  applyVoicingAssimilation(tokens);

  // ── Pass 3b: Place assimilation (sibilant + affricate) ────────────────
  tokens = applyPlaceAssimilation(tokens);

  // ── Pass 4: Vowel allophones (also assigns stress flag) ───────────────
  applyVowelAllophones(tokens, safeStress);

  // ── Pass 5: /в/ positional allophones ─────────────────────────────────
  applyVAllophones(tokens);

  // ── Pass 6: Syllabification ───────────────────────────────────────────
  const syllables = syllabify(tokens);

  // ── Build flat IPA string ─────────────────────────────────────────────
  const ipa = tokens.map((t) => t.ipa).join('');

  return {
    word,
    stressIndex: safeStress,
    tokens,
    syllables,
    ipa,
  };
}

// ── Backward-compatible API ─────────────────────────────────────────────────

/**
 * Drop-in replacement for the old transcribeUkrainian() function.
 * Returns an array of {ipa, stressed, isOpen} syllable objects
 * matching the old UaSyllable interface expected by wordTranscription.ts.
 */
export function transcribeUkrainian(
  word: string,
  stressIndex: number,
): { ipa: string; stressed: boolean; isOpen: boolean }[] {
  const result = transcribeUkrainianPipeline(word, stressIndex);

  if (result.syllables.length === 0 && result.ipa) {
    return [{ ipa: result.ipa, stressed: true, isOpen: false }];
  }

  return result.syllables.map((s) => ({
    ipa: s.ipa,
    stressed: s.stressed,
    isOpen: s.isOpen,
  }));
}
