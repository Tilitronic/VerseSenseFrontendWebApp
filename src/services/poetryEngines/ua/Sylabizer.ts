import { type Phoneme, PhoneticTypes } from './Phonetizer';

/**
 * Ukrainian Syllable (Склад)
 * Represents a phonetic unit with one vowel nucleus and optional consonantal margins
 */
export interface Syllable {
  /** Phonemes that make up this syllable */
  phonemes: Phoneme[];

  /** Syllable index in the word (0-based) */
  index: number;

  /** Whether this syllable is open (ends with vowel) or closed (ends with consonant) */
  isOpen: boolean;

  /** Whether this syllable is stressed */
  stress: boolean;

  /** Phonetic representation of the syllable */
  phonetic: string;
}

/**
 * Syllabizer Service
 * Converts phoneme array into syllables following Ukrainian phonetic rules
 *
 * Rules:
 * 1. Each syllable has exactly one vowel nucleus (тільки один голосний на склад)
 * 2. Syllables tend to be open (ending in vowel) in Ukrainian
 * 3. Single consonant between vowels → goes to next syllable
 * 4. Multiple consonants between vowels → first goes to previous, rest to next
 * 5. Consonant clusters that can't be broken (e.g., Cv clusters, affricates) stay together
 * 6. Double/geminate consonants split in half
 */
export class Sylabizer {
  /**
   * Convert phoneme array into syllables following Ukrainian rules:
   *  1. Each syllable has exactly one vowel nucleus.
   *  2. A single consonant between vowels goes to the NEXT syllable (onset).
   *  3. Consonant clusters split so the last consonant(s) go to the next onset.
   *
   * @param phonemes            - Array of phonemes from Phonetizer
   * @param stressedSyllableIndex - 0-based index of the stressed syllable
   * @returns Array of Syllable objects
   */
  static createSyllables(phonemes: Phoneme[], stressedSyllableIndex = 0): Syllable[] {
    if (phonemes.length === 0) return [];

    // ── Pass 1: group phonemes around each vowel nucleus ──────────────────
    // Build an array of raw phoneme groups, one per vowel.
    const groups: Phoneme[][] = [];
    let current: Phoneme[] = [];

    for (const phoneme of phonemes) {
      current.push(phoneme);
      if (phoneme.phoneticType === PhoneticTypes.VOWEL) {
        groups.push(current);
        current = [];
      }
    }

    // Trailing consonants after last vowel → append to last syllable
    if (current.length > 0) {
      if (groups.length === 0) {
        // Word with no vowels (e.g. "р" in "ритм" edge case) — single syllable
        groups.push(current);
      } else {
        groups[groups.length - 1]!.push(...current);
      }
    }

    // ── Pass 2: redistribute inter-syllable consonants to next onset ──────
    // The last consonant block before each vowel is its onset (goes forward).
    // We move leading consonants from each group (except the first) backward.
    // Rule: keep 1 consonant as coda of previous syllable only if 2+ consonants
    // are present between vowels; otherwise move all to next onset.
    for (let i = 1; i < groups.length; i++) {
      const group = groups[i]!;
      // Find consonants at the START of this group (the inter-vowel cluster)
      let onsetStart = 0;
      while (onsetStart < group.length && group[onsetStart]!.phoneticType !== PhoneticTypes.VOWEL) {
        onsetStart++;
      }
      // onsetStart is now the index of the vowel in this group
      // Consonants at indices [0, onsetStart) are the cluster
      if (onsetStart > 1) {
        // Multiple inter-vowel consonants: first one becomes coda of previous
        const coda = group.splice(0, 1);
        groups[i - 1]!.push(...coda);
      }
      // Single consonant: stays at head of current group (becomes onset) — no change
    }

    // ── Pass 3: build Syllable objects ────────────────────────────────────
    return groups.map((phonemeGroup, index) => {
      const lastPhoneme = phonemeGroup[phonemeGroup.length - 1];
      const isOpen = lastPhoneme?.phoneticType === PhoneticTypes.VOWEL;
      const phonetic = phonemeGroup.map((p) => p.symbol).join('');

      return {
        phonemes: phonemeGroup,
        index,
        isOpen,
        stress: index === stressedSyllableIndex,
        phonetic,
      };
    });
  }

  /**
   * Format syllables with stress mark over the stressed syllable nucleus.
   * e.g. ["пи", "са", "ти"] with stress=1 → "пи-ˈса-ти"
   */
  static formatWithStress(syllables: Syllable[]): string {
    return syllables.map((s) => (s.stress ? `ˈ${s.phonetic}` : s.phonetic)).join('-');
  }

  /**
   * Analyse syllable structure: returns an array of 'O' (open) / 'C' (closed)
   * characters, e.g. ['O', 'C', 'O'] for a 3-syllable word.
   */
  static analyzeSyllableStructure(syllables: Syllable[]): string[] {
    return syllables.map((s) => (s.isOpen ? 'O' : 'C'));
  }
}
