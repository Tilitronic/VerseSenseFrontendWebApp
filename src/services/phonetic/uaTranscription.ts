/**
 * uaTranscription.ts
 *
 * Ukrainian grapheme-to-IPA transcription service.
 *
 * *** DEPRECATED — This file is now a thin wrapper around the new
 * data-driven pipeline in ./ua/uaPhoneticPipeline.ts ***
 *
 * The new engine implements:
 * - Full Cyrillic→IPA consonant and vowel mapping (data-driven from JSON)
 * - Stressed vs. unstressed vowel allophones (е→ɛ̝, и→ɪ̞, о→ɔ̝ before high vowel)
 * - Palatalized consonants via soft sign + iotated vowels
 * - Regressive palatalization propagation across dental clusters
 * - Regressive voicing assimilation of obstruent clusters
 * - Positional allophones of /в/ (ʋ, w, u̯)
 * - Token-aware syllabification following Ukrainian phonological rules
 *
 * Based on academic sources: Савченко 2014, Мойсієнко 2010, Тоцька 1997.
 */

export { transcribeUkrainian } from './ua/uaPhoneticPipeline';
export { transcribeUkrainianPipeline } from './ua/uaPhoneticPipeline';
export type { UaSyllable, UaTranscriptionResult, PhoneticToken } from './ua/types';
