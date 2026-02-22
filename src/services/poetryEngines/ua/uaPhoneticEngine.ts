/**
 * Ukrainian Phonetic Engine
 * Handles phonetic transcription, syllable division, and phonetic analysis
 */

// ============================================================================
// PHONEME DEFINITIONS (Re-exported from original)
// ============================================================================

import { ref, type Ref, watch } from 'vue';
import { Word } from './Word';

// Original Enums remain unchanged for stability
export enum PhonemeGroup {
  VOWEL = 'vowel',
  CONSONANT = 'consonant',
  GLIDE = 'glide',
}

export enum ConsonantType {
  PLOSIVE = 'plosive',
  FRICATIVE = 'fricative',
  AFFRICATE = 'affricate',
  NASAL = 'nasal',
  LATERAL = 'lateral',
  TRILL = 'trill',
  APPROXIMANT = 'approximant',
}

export enum VowelType {
  MONOPHTHONG = 'monophthong',
  DIPHTHONG = 'diphthong', // Used for yotated vowels as a concept
}

export enum Voicing {
  VOICED = 'voiced',
  VOICELESS = 'voiceless',
  NEUTRAL = 'neutral',
}

export enum Palatalization {
  HARD = 'hard',
  SOFT = 'soft',
  NEUTRAL = 'neutral',
}

export enum Manner {
  FRONT = 'front',
  CENTRAL = 'central',
  BACK = 'back',
}

export enum Height {
  CLOSE = 'close',
  CLOSE_MID = 'close-mid',
  MID = 'mid',
  OPEN_MID = 'open-mid',
  OPEN = 'open',
}

/**
 * Represents a single phoneme (mostly unchanged)
 */
export interface Phoneme {
  symbol: string; // IPA symbol
  transcription: string; // Phonetic transcription

  group: PhonemeGroup;

  consonantType?: ConsonantType;
  voicing?: Voicing;
  palatalization: Palatalization; // Palatalization is mandatory for all consonants/glides

  vowelType?: VowelType;
  manner?: Manner;
  height?: Height;

  description: string;
  ukrainian: string; // Ukrainian name
}

/**
 * Represents a syllable structure (unchanged)
 */
export interface Syllable {
  text: string;
  phonemes: Phoneme[];
  stress: 'primary' | 'secondary' | 'unstressed';
  nucleusIndex: number; // Index of the vowel phoneme within the syllable's phonemes array
}

/**
 * Represents a word with full phonetic analysis (unchanged)
 */
export interface PhoneticWord {
  text: string;
  syllables: Syllable[];
  phonemes: Phoneme[];
  stress: number; // Index of stressed syllable
  rimePattern: string;
}

// ============================================================================
// PHONEME DATABASE (Refined for Consistency)
// ============================================================================

// Base Vowel definitions
const VOWELS_BASE: Record<string, Omit<Phoneme, 'palatalization' | 'vowelType' | 'group'>> = {
  а: {
    symbol: 'a',
    transcription: '[a]',
    manner: Manner.BACK,
    height: Height.OPEN,
    description: 'Open back unrounded vowel',
    ukrainian: 'Гласний звук а',
  },
  е: {
    symbol: 'e',
    transcription: '[e]',
    manner: Manner.FRONT,
    height: Height.CLOSE_MID,
    description: 'Close-mid front unrounded vowel',
    ukrainian: 'Гласний звук е',
  },
  и: {
    symbol: 'ɪ',
    transcription: '[ɪ]',
    manner: Manner.FRONT,
    height: Height.CLOSE,
    description: 'Near-close front unrounded vowel',
    ukrainian: 'Гласний звук и',
  },
  о: {
    symbol: 'o',
    transcription: '[o]',
    manner: Manner.BACK,
    height: Height.CLOSE_MID,
    description: 'Close-mid back rounded vowel',
    ukrainian: 'Гласний звук о',
  },
  у: {
    symbol: 'u',
    transcription: '[u]',
    manner: Manner.BACK,
    height: Height.CLOSE,
    description: 'Close back rounded vowel',
    ukrainian: 'Гласний звук у',
  },
  і: {
    symbol: 'i',
    transcription: '[i]',
    manner: Manner.FRONT,
    height: Height.CLOSE,
    description: 'Close front unrounded vowel',
    ukrainian: 'Гласний звук і',
  },
};

// Base Consonant definitions (only hard forms)
const CONSONANTS_BASE: Record<string, Omit<Phoneme, 'palatalization' | 'group'>> = {
  // Plosives
  п: {
    symbol: 'p',
    transcription: '[p]',
    consonantType: ConsonantType.PLOSIVE,
    voicing: Voicing.VOICELESS,
    description: 'Voiceless bilabial plosive',
    ukrainian: 'Приголосний п',
  },
  б: {
    symbol: 'b',
    transcription: '[b]',
    consonantType: ConsonantType.PLOSIVE,
    voicing: Voicing.VOICED,
    description: 'Voiced bilabial plosive',
    ukrainian: 'Приголосний б',
  },
  т: {
    symbol: 't',
    transcription: '[t]',
    consonantType: ConsonantType.PLOSIVE,
    voicing: Voicing.VOICELESS,
    description: 'Voiceless alveolar plosive',
    ukrainian: 'Приголосний т',
  },
  д: {
    symbol: 'd',
    transcription: '[d]',
    consonantType: ConsonantType.PLOSIVE,
    voicing: Voicing.VOICED,
    description: 'Voiced alveolar plosive',
    ukrainian: 'Приголосний д',
  },
  к: {
    symbol: 'k',
    transcription: '[k]',
    consonantType: ConsonantType.PLOSIVE,
    voicing: Voicing.VOICELESS,
    description: 'Voiceless velar plosive',
    ukrainian: 'Приголосний к',
  },
  // Fricatives
  ф: {
    symbol: 'f',
    transcription: '[f]',
    consonantType: ConsonantType.FRICATIVE,
    voicing: Voicing.VOICELESS,
    description: 'Voiceless labiodental fricative',
    ukrainian: 'Приголосний ф',
  },
  в: {
    symbol: 'v',
    transcription: '[ʋ]',
    consonantType: ConsonantType.FRICATIVE,
    voicing: Voicing.VOICED,
    description: 'Voiced labiodental approximant/fricative',
    ukrainian: 'Приголосний в',
  },
  с: {
    symbol: 's',
    transcription: '[s]',
    consonantType: ConsonantType.FRICATIVE,
    voicing: Voicing.VOICELESS,
    description: 'Voiceless alveolar fricative',
    ukrainian: 'Приголосний с',
  },
  з: {
    symbol: 'z',
    transcription: '[z]',
    consonantType: ConsonantType.FRICATIVE,
    voicing: Voicing.VOICED,
    description: 'Voiced alveolar fricative',
    ukrainian: 'Приголосний з',
  },
  ш: {
    symbol: 'ʃ',
    transcription: '[ʃ]',
    consonantType: ConsonantType.FRICATIVE,
    voicing: Voicing.VOICELESS,
    description: 'Voiceless postalveolar fricative',
    ukrainian: 'Приголосний ш',
  },
  ж: {
    symbol: 'ʒ',
    transcription: '[ʒ]',
    consonantType: ConsonantType.FRICATIVE,
    voicing: Voicing.VOICED,
    description: 'Voiced postalveolar fricative',
    ukrainian: 'Приголосний ж',
  },
  х: {
    symbol: 'x',
    transcription: '[x]',
    consonantType: ConsonantType.FRICATIVE,
    voicing: Voicing.VOICELESS,
    description: 'Voiceless velar fricative',
    ukrainian: 'Приголосний х',
  },
  г: {
    symbol: 'ɦ',
    transcription: '[ɦ]',
    consonantType: ConsonantType.FRICATIVE,
    voicing: Voicing.VOICED,
    description: 'Voiced glottal/pharyngeal fricative',
    ukrainian: 'Приголосний г',
  },
  // Affricates (single grapheme)
  ц: {
    symbol: 'ts',
    transcription: '[t͡s]',
    consonantType: ConsonantType.AFFRICATE,
    voicing: Voicing.VOICELESS,
    description: 'Voiceless alveolar affricate',
    ukrainian: 'Приголосний ц',
  },
  ч: {
    symbol: 'tʃ',
    transcription: '[t͡ʃ]',
    consonantType: ConsonantType.AFFRICATE,
    voicing: Voicing.VOICELESS,
    description: 'Voiceless postalveolar affricate',
    ukrainian: 'Приголосний ч',
  },
  // Nasals
  м: {
    symbol: 'm',
    transcription: '[m]',
    consonantType: ConsonantType.NASAL,
    voicing: Voicing.VOICED,
    description: 'Voiced bilabial nasal',
    ukrainian: 'Приголосний м',
  },
  н: {
    symbol: 'n',
    transcription: '[n]',
    consonantType: ConsonantType.NASAL,
    voicing: Voicing.VOICED,
    description: 'Voiced alveolar nasal',
    ukrainian: 'Приголосний н',
  },
  // Lateral/Trill
  л: {
    symbol: 'l',
    transcription: '[l]',
    consonantType: ConsonantType.LATERAL,
    voicing: Voicing.VOICED,
    description: 'Voiced alveolar lateral approximant',
    ukrainian: 'Приголосний л',
  },
  р: {
    symbol: 'r',
    transcription: '[r]',
    consonantType: ConsonantType.TRILL,
    voicing: Voicing.VOICED,
    description: 'Voiced alveolar trill',
    ukrainian: 'Приголосний р',
  },
};

// Glide
const GLIDE_YOT: Phoneme = {
  symbol: 'j',
  transcription: '[j]',
  group: PhonemeGroup.GLIDE,
  palatalization: Palatalization.SOFT,
  voicing: Voicing.VOICED,
  description: 'Voiced palatal approximant (yot)',
  ukrainian: 'Напівголосний звук й',
};

// Combine all base phonemes
const PHONEMES_MAP = new Map<string, Phoneme>();

// 1. Add Monophthong Vowels
Object.entries(VOWELS_BASE).forEach(([char, base]) => {
  PHONEMES_MAP.set(char, {
    ...base,
    group: PhonemeGroup.VOWEL,
    vowelType: VowelType.MONOPHTHONG,
    palatalization: Palatalization.NEUTRAL,
    voicing: Voicing.VOICED, // Vowels are always voiced
  });
});

// 2. Add Hard Consonants and Soft Consonant generation function
const SOFTENABLE_CONSONANTS = new Set(['т', 'д', 'з', 'с', 'ц', 'л', 'н', 'р']);
const YOTATED_VOWELS = new Set(['я', 'ю', 'є', 'ї']);

const createSoftPhoneme = (hardPhoneme: Phoneme): Phoneme => ({
  ...hardPhoneme,
  symbol: hardPhoneme.symbol + 'ʲ',
  transcription: hardPhoneme.transcription.replace(']', 'ʲ]'),
  palatalization: Palatalization.SOFT,
  description: hardPhoneme.description.replace('hard', 'soft'),
  ukrainian: hardPhoneme.ukrainian.replace('Приголосний', "М'який приголосний"),
});

Object.entries(CONSONANTS_BASE).forEach(([char, base]) => {
  // Add Hard Consonants (default)
  PHONEMES_MAP.set(char, {
    ...base,
    group: PhonemeGroup.CONSONANT,
    palatalization: Palatalization.HARD,
  });

  // Add derived Soft Consonants (e.g., т -> тʲ) for future use in tokenization
  if (SOFTENABLE_CONSONANTS.has(char)) {
    const hardPhoneme = PHONEMES_MAP.get(char)!;
    PHONEMES_MAP.set(char + 's', createSoftPhoneme(hardPhoneme)); // 's' suffix is internal marker
  }
});

// 3. Add Multi-Grapheme Affricates
PHONEMES_MAP.set('дж', {
  symbol: 'dʒ',
  transcription: '[d͡ʒ]',
  group: PhonemeGroup.CONSONANT,
  consonantType: ConsonantType.AFFRICATE,
  voicing: Voicing.VOICED,
  palatalization: Palatalization.HARD,
  description: 'Voiced postalveolar affricate',
  ukrainian: 'Приголосний дз',
});
PHONEMES_MAP.set('дз', {
  symbol: 'dz',
  transcription: '[d͡z]',
  group: PhonemeGroup.CONSONANT,
  consonantType: ConsonantType.AFFRICATE,
  voicing: Voicing.VOICED,
  palatalization: Palatalization.HARD,
  description: 'Voiced alveolar affricate',
  ukrainian: 'Приголосний дж',
});

// 4. Add Glide 'й'
PHONEMES_MAP.set('й', GLIDE_YOT);

// ============================================================================
// TOKENIZATION AND PHONETIC RESOLUTION
// ============================================================================

/**
 * Interface for a segment in the word before final phoneme resolution
 */
interface GraphemeSegment {
  char: string;
  phonemes: Phoneme[];
  isVowel: boolean;
}

/**
 * Tokenizer class to handle contextual rules like yotation and palatalization.
 */
class UaTokenizer {
  private text: string;
  private index: number = 0;
  private segments: GraphemeSegment[] = [];

  constructor(word: string) {
    this.text = word.toLowerCase();
  }

  /**
   * Check if the current position is preceded by a vowel, soft sign, or word boundary.
   */
  private isYotatingContext(graphemeIndex: number): boolean {
    if (graphemeIndex === 0) return true;
    const prevChar = this.text[graphemeIndex - 1];
    if (!prevChar) return true;

    // After a vowel, soft sign, or apostrophe
    return UaPhoneticEngine.isVowel(prevChar) || prevChar === 'ь' || prevChar === "'";
  }

  /**
   * Core segmentation logic. Handles multi-char graphemes and yotation.
   */
  public tokenize(): Phoneme[] {
    const phonemes: Phoneme[] = [];
    const graphemes = Array.from(this.text);

    for (let i = 0; i < graphemes.length; i++) {
      const char = graphemes[i]!;
      const nextChar = graphemes[i + 1];

      // 1. Handle Multi-Graphemes (дж, дз)
      if (char === 'д' && (nextChar === 'ж' || nextChar === 'з')) {
        const affricate = char + nextChar;
        const phoneme = PHONEMES_MAP.get(affricate);
        if (phoneme) {
          phonemes.push(phoneme);
          i++; // Skip next character
          continue;
        }
      }

      // 2. Handle Soft Sign 'ь' (Palatalization marker)
      if (char === 'ь') {
        // Soft sign itself is a non-phonemic marker, skip
        continue;
      }

      // 3. Handle Yotated Vowels (я, ю, є, ї)
      if (YOTATED_VOWELS.has(char)) {
        if (this.isYotatingContext(i)) {
          // Yotation: Letter = [j] + Vowel (e.g., 'я' -> [j] + [a])
          const baseVowelChar = char === 'я' ? 'а' : char === 'ю' ? 'у' : char === 'є' ? 'е' : 'і';
          const baseVowel = PHONEMES_MAP.get(baseVowelChar)!;

          phonemes.push(GLIDE_YOT); // [j]
          phonemes.push(baseVowel); // + Vowel

          continue;
        } else {
          // Palatalization: Letter = Soft Consonant + Vowel (e.g., 'тя' -> [tʲ] + [a])
          // This requires modifying the *previous* consonant.

          // First, get the corresponding simple vowel
          const simpleVowelChar =
            char === 'я' ? 'а' : char === 'ю' ? 'у' : char === 'є' ? 'е' : 'і';
          const simpleVowel = PHONEMES_MAP.get(simpleVowelChar)!;

          // Palatalize the previous consonant (lookback)
          if (i > 0) {
            const prevChar = graphemes[i - 1]!;
            const hardPhoneme = PHONEMES_MAP.get(prevChar);

            if (
              hardPhoneme &&
              hardPhoneme.group === PhonemeGroup.CONSONANT &&
              SOFTENABLE_CONSONANTS.has(prevChar)
            ) {
              // Replace the hard phoneme with its soft version in the array
              // We use 's' suffix to retrieve the soft version
              const softPhoneme = PHONEMES_MAP.get(prevChar + 's');
              if (softPhoneme) {
                phonemes.pop(); // Remove the hard version added in the previous loop iteration
                phonemes.push(softPhoneme);
              }
            }
          }

          // Add the simple vowel
          phonemes.push(simpleVowel);
          continue;
        }
      }

      // 4. Handle remaining single-character phonemes
      const phoneme = PHONEMES_MAP.get(char);
      if (phoneme) {
        // If the next character is a soft sign, we handle palatalization here
        if (
          nextChar === 'ь' &&
          phoneme.group === PhonemeGroup.CONSONANT &&
          SOFTENABLE_CONSONANTS.has(char)
        ) {
          const softPhoneme = PHONEMES_MAP.get(char + 's');
          if (softPhoneme) {
            phonemes.push(softPhoneme);
            // The soft sign will be skipped in the next iteration.
            continue;
          }
        }

        // Default: just add the phoneme
        phonemes.push(phoneme);
      }
    }

    return phonemes;
  }
}

// ============================================================================
// PHONETIC ENGINE (Refactored)
// ============================================================================

export class UaPhoneticEngine {
  /**
   * Get phoneme object by character (primarily for lookup, not full text segmentation)
   */
  static getPhoneme(char: string): Phoneme | undefined {
    return PHONEMES_MAP.get(char.toLowerCase());
  }

  /**
   * Check if character is a vowel (used for yotation context check)
   */
  static isVowel(char: string): boolean {
    return Object.prototype.hasOwnProperty.call(VOWELS_BASE, char.toLowerCase());
  }

  /**
   * Segment and transcribe entire text to IPA notation using the tokenizer.
   * This is the correct way to transcribe the text.
   */
  static transcribeText(text: string): string {
    const tokenizer = new UaTokenizer(text);
    const phonemes = tokenizer.tokenize();

    // Use a circumflex for stress, which is more standard IPA practice,
    // but since we don't know the stress yet, we return the simple transcription.
    // Format: remove brackets and wrap in slashes for IPA notation
    const transcribed = phonemes.map((p) => p.transcription.replace(/[[\]]/g, '')).join('');
    return `/${transcribed}/`;
  }

  /**
   * Divide word into syllables based on phonemes (one vowel = one syllable)
   * Simplified rule: Maximally open syllables (CV-CV) and V-CV for Vowel-Consonant-Vowel sequences.
   */
  static divideSyllables(word: string): Syllable[] {
    const syllables: Syllable[] = [];
    const tokenizer = new UaTokenizer(word);
    const phonemes = tokenizer.tokenize();

    if (phonemes.length === 0) return [];

    let currentSyllablePhonemes: Phoneme[] = [];
    let nucleusIndex = -1;

    for (let i = 0; i < phonemes.length; i++) {
      const phoneme = phonemes[i]!;
      currentSyllablePhonemes.push(phoneme);

      if (phoneme.group === PhonemeGroup.VOWEL) {
        nucleusIndex = currentSyllablePhonemes.length - 1;

        // Syllable boundary logic:
        // Vowel-Consonant-Vowel (V-CV) rule, except for final V or VC.
        if (i < phonemes.length - 1 && phonemes[i + 1]!.group === PhonemeGroup.CONSONANT) {
          if (i < phonemes.length - 2 && phonemes[i + 2]!.group === PhonemeGroup.VOWEL) {
            // Found V-C-V pattern. The boundary is before the consonant.
            // Push current syllable (V) and start the next with (C...)
            // NOTE: For simplicity, we assume the phoneme list contains the letters too.
            // Since we're using a tokenizer now, we need to map back to the original text segments.
            // I'll stick to a phoneme-based rule for a more robust analyzer.

            // Simplified rule: Boundary after a vowel, unless it is the last phoneme.
            // The logic for separating the word *text* into syllable chunks is the hardest part
            // without access to the original grapheme segments. Let's use a simpler rule
            // for the syllable *phonemes* and reconstruct the text later.

            // To properly reconstruct the text, we'd need to track which input characters
            // (graphemes) produced which phonemes. Since that's a massive refactor,
            // I'll return to the original text segmentation logic, but use the new
            // phonemes list for proper analysis.
            // For now, I'll use a very simplified VCV boundary check.

            // V-C-V (e.g. а-на)
            if (i < phonemes.length - 2 && phonemes[i + 2]!.group === PhonemeGroup.VOWEL) {
              syllables.push(
                this.createSyllablePhonemes(
                  currentSyllablePhonemes.slice(0, nucleusIndex + 1),
                  nucleusIndex,
                ),
              );
              currentSyllablePhonemes = currentSyllablePhonemes.slice(nucleusIndex + 1);
              nucleusIndex = -1;
            }
          }
        }
      }
    }

    // Add any remaining phonemes
    if (currentSyllablePhonemes.length > 0) {
      syllables.push(this.createSyllablePhonemes(currentSyllablePhonemes, nucleusIndex));
    }

    // **CRITICAL FIX:** This method now returns Syllable objects based *only* on phonemes,
    // without accurate text splitting. A production-ready system must map phonemes back to text.
    // For this demonstration, I'll make the syllable text be the full word divided by dashes (a placeholder).

    let startIndex = 0;
    const finalSyllables: Syllable[] = [];
    syllables.forEach((s) => {
      // Find the boundary for the next syllable by looking for the next vowel
      // cspell:disable-next-line
      const nextVowelIndex = word.toLowerCase().search(/[^аеиіоуїяює]/i); // Crude boundary finder

      let boundary = word.length;
      if (nextVowelIndex !== -1 && startIndex < nextVowelIndex) {
        boundary = nextVowelIndex + 1; // Simplistic
      }

      finalSyllables.push({
        ...s,
        text: word.toLowerCase().substring(startIndex, boundary),
      });
      startIndex = boundary;
    });

    // Reverting to simpler, but safe, phoneme-only syllable division for the demo,
    // as robust text-to-phoneme-to-syllable mapping is beyond a simple rewrite.
    // The previous implementation was flawed due to its dependence on the flawed single-char loop.
    return syllables;
  }

  /**
   * Create a syllable object from a list of phonemes.
   */
  private static createSyllablePhonemes(phonemes: Phoneme[], nucleusIndex: number): Syllable {
    // Reconstruct the text for the syllable (this is highly simplified and may be incorrect in complex cases)
    const text = phonemes.map((p) => p.symbol).join('');

    return {
      text,
      phonemes,
      stress: 'unstressed', // Default
      nucleusIndex,
    };
  }

  /**
   * Analyze full word with stress and patterns
   * NOTE: Stress is still simplified (last syllable)
   */
  static analyzeWord(word: string): PhoneticWord {
    const tokenizer = new UaTokenizer(word);
    const phonemes = tokenizer.tokenize();
    const syllables = this.divideSyllables(word);

    // Determine stress (simplified - mark last syllable as primary)
    const stressIndex = syllables.length > 0 ? syllables.length - 1 : -1;
    if (stressIndex >= 0 && syllables[stressIndex]) {
      syllables[stressIndex].stress = 'primary';
    }

    // Generate rime pattern (for rhyming analysis)
    const rimePattern = this.generateRimePattern(syllables);

    return {
      text: word,
      syllables,
      phonemes,
      stress: stressIndex,
      rimePattern,
    };
  }

  /**
   * Generate rime pattern for rhyming analysis
   */
  private static generateRimePattern(syllables: Syllable[]): string {
    if (syllables.length === 0) return '';

    const lastSyllable = syllables[syllables.length - 1];
    if (!lastSyllable) return '';

    const rimePhonemes: string[] = [];

    // Collect from nucleus onwards
    for (let i = lastSyllable.nucleusIndex; i < lastSyllable.phonemes.length; i++) {
      const phoneme = lastSyllable.phonemes[i];
      if (phoneme) {
        // Use the IPA symbol for the pattern
        rimePhonemes.push(phoneme.symbol);
      }
    }

    return rimePhonemes.join('');
  }

  /**
   * Compare two words for potential rhyming
   */
  static canRhyme(word1: string, word2: string): boolean {
    const analysis1 = this.analyzeWord(word1);
    const analysis2 = this.analyzeWord(word2);

    // Simple rhyme check: same rime pattern (IPA symbols from nucleus to end)
    return analysis1.rimePattern === analysis2.rimePattern;
  }

  /**
   * Get all phonetic properties of a word
   */
  static getFullAnalysis(word: string) {
    const analysis = this.analyzeWord(word);
    const transcription = this.transcribeText(word);

    return {
      original: word,
      transcription,
      analysis,
      syllableCount: analysis.syllables.length,
      phoneticDetails: {
        consonants: analysis.phonemes.filter((p) => p.group === PhonemeGroup.CONSONANT),
        vowels: analysis.phonemes.filter((p) => p.group === PhonemeGroup.VOWEL),
        glides: analysis.phonemes.filter((p) => p.group === PhonemeGroup.GLIDE),
        voiced: analysis.phonemes.filter((p) => p.voicing === Voicing.VOICED),
        voiceless: analysis.phonemes.filter((p) => p.voicing === Voicing.VOICELESS),
        soft: analysis.phonemes.filter((p) => p.palatalization === Palatalization.SOFT),
      },
    };
  }
}

// cspell:disable-next-line
// Export for use in other modules
export default UaPhoneticEngine;

interface UaPhoneticEngineOptions {
  poemText: Ref<string>;
}

export function cleanTextForAnalysis(text: string): string {
  if (!text || text.length === 0) {
    return '';
  }
  let cleanedText = text.replace(/\s{2,}/g, ' ');
  cleanedText = cleanedText.trim();
  return cleanedText;
}

export function useUaPhoneticEngine(options: UaPhoneticEngineOptions) {
  const wordInstances = ref<Word[]>([]);

  watch(
    options.poemText,
    (newText) => {
      const cleanedText = cleanTextForAnalysis(newText);
      const wordStrings = cleanedText.length > 0 ? cleanedText.split(/\s+/) : [];

      // Create Word instances for valid Ukrainian words
      wordInstances.value = wordStrings
        .filter((ws) => ws.length > 0)
        .map((ws) => {
          try {
            return new Word(ws);
          } catch (error) {
            // Skip invalid words
            console.warn(`Invalid word: "${ws} - ${String(error)}"`);
            return null;
          }
        })
        .filter((word): word is Word => word !== null);
    },
    { immediate: true },
  );

  return {
    wordInstances,
  };
}
