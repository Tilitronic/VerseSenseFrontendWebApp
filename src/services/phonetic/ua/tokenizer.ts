/**
 * tokenizer.ts — Pass 1: Cyrillic graphemes → PhoneticToken[]
 *
 * This is the first pass of the Ukrainian phonetic pipeline.
 * It scans the input word left-to-right, consuming graphemes and
 * producing an ordered array of PhoneticToken objects.
 *
 * Handles:
 * - Digraph affricates: дж, дз
 * - Composite щ → [ʃ] + [tʃ]
 * - Soft sign (ь) → palatalization marker (merged into previous consonant)
 * - Apostrophe variants → boundary token
 * - Iotated vowels (я, ю, є, ї) → [j]+vowel or palatal marker
 * - Simple vowels and consonants
 *
 * Does NOT handle: palatalization propagation, voicing assimilation,
 * vowel allophones, в allophones — those are separate passes.
 *
 * Data-driven: all mapping tables imported from JSON data files.
 */

import type { PhoneticToken, ConsonantFeatures, VowelFeatures } from './types';

import graphemeData from './data/graphemes';
import consonantData from './data/consonants';
import vowelData from './data/vowels';

// ── Pre-built lookup maps (constructed once at module load) ─────────────────

/** IPA → ConsonantFeatures */
const consonantFeatureMap = new Map<string, ConsonantFeatures>();
for (const p of consonantData.phonemes) {
  consonantFeatureMap.set(p.ipa, {
    voicePower: p.voicePower as ConsonantFeatures['voicePower'],
    place: p.place as ConsonantFeatures['place'],
    manner: p.manner as ConsonantFeatures['manner'],
    softness: p.softness as ConsonantFeatures['softness'],
    nasality: p.nasality as ConsonantFeatures['nasality'],
  });
}

/** IPA → VowelFeatures */
const vowelFeatureMap = new Map<string, VowelFeatures>();
for (const p of vowelData.phonemes) {
  vowelFeatureMap.set(p.ipa, {
    height: p.height as VowelFeatures['height'],
    backness: p.backness as VowelFeatures['backness'],
    rounding: p.rounding as VowelFeatures['rounding'],
    stable: p.stable,
  });
}

/** Apostrophe character set */
const apostropheSet = new Set(graphemeData.apostropheChars);

/** Iotated vowels config */
const iotated = graphemeData.iotatedVowels as Record<
  string,
  { vowelIpa: string; glide: string; alwaysIotated?: boolean }
>;

/** Simple vowel Cyrillic → IPA */
const simpleVowels = graphemeData.simpleVowels;

/** Consonant Cyrillic → IPA */
const consonantGraphemes = graphemeData.consonantGraphemes;

/** Digraphs: дж, дз */
const digraphs = graphemeData.digraphs;

/** Composites: щ → two IPA segments */
const composites = graphemeData.composites;

/** Set of Cyrillic vowel graphemes */
const vowelGraphemeSet = new Set(graphemeData.vowelGraphemes);

/** Soft sign character */
const softSign = graphemeData.softSign;

/** Set of consonant IPAs that can be softened */
const softenableSet = new Set(graphemeData.softenableConsonants);

// ── Helper: create tokens ───────────────────────────────────────────────────

function makeConsonantToken(ipa: string, source: string, palatalized = false): PhoneticToken {
  // Look up features — if palatalized, try the ʲ variant first
  const lookupIpa = palatalized && !ipa.endsWith('ʲ') ? ipa + 'ʲ' : ipa;
  const features = consonantFeatureMap.get(lookupIpa) ?? consonantFeatureMap.get(ipa) ?? null;

  return {
    ipa: palatalized && !ipa.endsWith('ʲ') ? ipa + 'ʲ' : ipa,
    source,
    type: ipa === 'j' ? 'glide' : 'consonant',
    vowelIndex: -1,
    stressed: false,
    palatalized,
    consonantFeatures: features
      ? { ...features, softness: palatalized ? 'soft' : features.softness }
      : null,
    vowelFeatures: null,
  };
}

function makeVowelToken(ipa: string, source: string, vowelIndex: number): PhoneticToken {
  const features = vowelFeatureMap.get(ipa) ?? null;
  return {
    ipa,
    source,
    type: 'vowel',
    vowelIndex,
    stressed: false, // filled in later by stress pass
    palatalized: false,
    consonantFeatures: null,
    vowelFeatures: features,
  };
}

function makeGlideToken(ipa: string, source: string): PhoneticToken {
  const features = consonantFeatureMap.get(ipa) ?? null;
  return {
    ipa,
    source,
    type: 'glide',
    vowelIndex: -1,
    stressed: false,
    palatalized: false,
    consonantFeatures: features,
    vowelFeatures: null,
  };
}

function makeBoundaryToken(source: string): PhoneticToken {
  return {
    ipa: 'ʔ',
    source,
    type: 'glottal',
    vowelIndex: -1,
    stressed: false,
    palatalized: false,
    consonantFeatures: null,
    vowelFeatures: null,
  };
}

// ── Context helpers ─────────────────────────────────────────────────────────

/**
 * Determine whether an iotated vowel should produce [j]+vowel
 * (iotation) or palatalize the preceding consonant.
 *
 * Iotation occurs:
 * - word-initial position
 * - after another vowel
 * - after apostrophe
 * - after soft sign (ь) — but ь also palatalizes the preceding consonant
 * - ї is ALWAYS iotated regardless of context
 *
 * Palatalization occurs:
 * - after a consonant (the consonant gets palatalized, vowel produced without [j])
 */
function shouldIotate(
  chars: string[],
  index: number,
  tokens: PhoneticToken[],
  alwaysIotated: boolean,
): boolean {
  if (alwaysIotated) return true;
  if (index === 0) return true;

  const prevChar = chars[index - 1]!;

  // After apostrophe
  if (apostropheSet.has(prevChar)) return true;

  // After soft sign
  if (prevChar === softSign) return true;

  // After a vowel grapheme
  if (vowelGraphemeSet.has(prevChar)) return true;

  // Otherwise (after a consonant) → palatalize, don't iotate
  return false;
}

// ── Main tokenizer ──────────────────────────────────────────────────────────

/**
 * Tokenize a Ukrainian word into PhoneticToken[].
 *
 * @param word - Ukrainian word in Cyrillic (any case)
 * @returns Array of PhoneticToken (raw — before palatalization/assimilation passes)
 */
export function tokenize(word: string): PhoneticToken[] {
  const chars = Array.from(word.toLowerCase());
  const tokens: PhoneticToken[] = [];
  let vowelIndex = 0;
  let i = 0;

  while (i < chars.length) {
    const ch = chars[i]!;
    const next = chars[i + 1] ?? '';

    // ── 1. Apostrophe → boundary (glottal) token ──────────────────────────
    if (apostropheSet.has(ch)) {
      tokens.push(makeBoundaryToken(ch));
      i++;
      continue;
    }

    // ── 2. Soft sign → merge palatalization into previous consonant ───────
    if (ch === softSign) {
      // Find the last consonant token and palatalize it
      for (let k = tokens.length - 1; k >= 0; k--) {
        const prev = tokens[k]!;
        if (prev.type === 'consonant' || prev.type === 'glide') {
          if (softenableSet.has(prev.ipa) || softenableSet.has(prev.ipa.replace('ʲ', ''))) {
            // Apply palatalization
            if (!prev.ipa.endsWith('ʲ')) {
              prev.ipa += 'ʲ';
            }
            prev.palatalized = true;
            if (prev.consonantFeatures) {
              prev.consonantFeatures.softness = 'soft';
              // Update features to match the palatalized variant
              const softFeatures = consonantFeatureMap.get(prev.ipa);
              if (softFeatures) {
                prev.consonantFeatures = { ...softFeatures };
              }
            }
          }
          break;
        }
      }
      i++;
      continue;
    }

    // ── 3. Digraphs: дж, дз ──────────────────────────────────────────────
    if (ch === 'д' && (next === 'ж' || next === 'з')) {
      const digraph = ch + next;
      const ipa = digraphs[digraph];
      if (ipa) {
        tokens.push(makeConsonantToken(ipa, digraph));
        i += 2;
        continue;
      }
    }

    // ── 4. Composite: щ → [ʃ] + [tʃ] ─────────────────────────────────────
    if (composites[ch]) {
      const parts = composites[ch];
      for (const part of parts) {
        tokens.push(makeConsonantToken(part, ch));
      }
      i++;
      continue;
    }

    // ── 5. Iotated vowels: я, ю, є, ї ───────────────────────────────────
    if (iotated[ch]) {
      const { vowelIpa, glide, alwaysIotated } = iotated[ch];
      const iotate = shouldIotate(chars, i, tokens, alwaysIotated ?? false);

      if (iotate) {
        // Produce [j] glide + vowel
        tokens.push(makeGlideToken(glide, ch));
        tokens.push(makeVowelToken(vowelIpa, ch, vowelIndex++));
      } else {
        // After consonant: palatalize the preceding consonant, emit only the vowel
        for (let k = tokens.length - 1; k >= 0; k--) {
          const prev = tokens[k]!;
          if (prev.type === 'consonant' || prev.type === 'glide') {
            if (softenableSet.has(prev.ipa) || softenableSet.has(prev.ipa.replace('ʲ', ''))) {
              if (!prev.ipa.endsWith('ʲ')) {
                prev.ipa += 'ʲ';
              }
              prev.palatalized = true;
              if (prev.consonantFeatures) {
                prev.consonantFeatures.softness = 'soft';
                const softFeatures = consonantFeatureMap.get(prev.ipa);
                if (softFeatures) {
                  prev.consonantFeatures = { ...softFeatures };
                }
              }
            }
            break;
          }
        }
        tokens.push(makeVowelToken(vowelIpa, ch, vowelIndex++));
      }
      i++;
      continue;
    }

    // ── 6. Simple vowels ─────────────────────────────────────────────────
    if (simpleVowels[ch]) {
      // Front vowel і palatalizes the preceding softenable consonant
      // (just like iotated vowels do, but without producing a [j] glide)
      if (ch === 'і') {
        for (let k = tokens.length - 1; k >= 0; k--) {
          const prev = tokens[k]!;
          if (prev.type === 'consonant' || prev.type === 'glide') {
            if (softenableSet.has(prev.ipa) || softenableSet.has(prev.ipa.replace('ʲ', ''))) {
              if (!prev.ipa.endsWith('ʲ')) {
                prev.ipa += 'ʲ';
              }
              prev.palatalized = true;
              if (prev.consonantFeatures) {
                prev.consonantFeatures.softness = 'soft';
                const softFeatures = consonantFeatureMap.get(prev.ipa);
                if (softFeatures) {
                  prev.consonantFeatures = { ...softFeatures };
                }
              }
            }
            break;
          }
        }
      }
      tokens.push(makeVowelToken(simpleVowels[ch], ch, vowelIndex++));
      i++;
      continue;
    }

    // ── 7. Regular consonants ────────────────────────────────────────────
    if (consonantGraphemes[ch]) {
      tokens.push(makeConsonantToken(consonantGraphemes[ch], ch));
      i++;
      continue;
    }

    // ── 8. Unknown character → skip non-letter characters (punctuation,
    //        digits, spaces) silently so they don't become phantom tokens
    //        that confuse positional allophone rules (e.g. в before '!' would
    //        incorrectly trigger the pre-consonant allophone instead of the
    //        word-final one).
    const codePoint = ch.codePointAt(0) ?? 0;
    const isCyrillicLetter = (codePoint >= 0x0400 && codePoint <= 0x04FF) ||
                             (codePoint >= 0x0500 && codePoint <= 0x052F);
    if (!isCyrillicLetter) {
      i++;
      continue;
    }

    // Truly unknown Cyrillic → pass through as consonant (safety)
    tokens.push({
      ipa: ch,
      source: ch,
      type: 'consonant',
      vowelIndex: -1,
      stressed: false,
      palatalized: false,
      consonantFeatures: null,
      vowelFeatures: null,
    });
    i++;
  }

  return tokens;
}
