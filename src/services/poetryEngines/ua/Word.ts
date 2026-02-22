import { UA_WORD_VALID_CHARS, type PosItem, UkrainianPartsOfSpeech } from './consts';
import { getPhoneme, type Phoneme } from './Phonetizer';
import { Sylabizer, type Syllable } from './Sylabizer';
/**
 * Vowels in Ukrainian
 */
export const UA_VOWELS = 'аеєиіїоуюяАЕЄИІЇОУЮЯ';

/**
 * Consonants in Ukrainian
 */
export const UA_CONSONANTS = 'бвгґджзйклмнпрстфхцчшщьБВГҐДЖЗЙКЛМНПРСТФХЦЧШЩЬ';

/**
 * Word class representing a Ukrainian word with linguistic properties
 */
export class Word {
  private text: string;
  private lowercase: string;
  private uppercase: string;
  private length: number;
  private vowels: string[];
  private consonants: string[];
  private vowelCount: number;
  private consonantCount: number;
  private syllables: string[];
  private isVowelStart: boolean;
  private isVowelEnd: boolean;
  private partOfSpeech: PosItem;
  private phoneticTranscription: Phoneme[];
  private phoneticSyllables: Syllable[];

  /**
   * Creates a Word instance
   * @param text - Ukrainian word to validate and analyze
   * @param partOfSpeech - Part of speech (optional, defaults to NOUN)
   * @throws Error if word contains non-Ukrainian characters or is empty
   */
  constructor(text: string, partOfSpeech: PosItem = UkrainianPartsOfSpeech.NOUN) {
    if (!text || typeof text !== 'string') {
      throw new Error('Word must be a non-empty string');
    }

    const trimmed = text.trim();
    if (trimmed.length === 0) {
      throw new Error('Word cannot be empty');
    }

    // Validate all characters are Ukrainian
    if (!this.isValidUkrainian(trimmed)) {
      const invalidChars = Array.from(trimmed)
        .filter((char) => !UA_WORD_VALID_CHARS.all.includes(char))
        .join(', ');
      throw new Error(
        `Word "${text}" contains invalid character(s): [${invalidChars}]. Only Ukrainian alphabet letters and apostrophes/hyphens are allowed.`,
      );
    }
    this.text = trimmed;
    this.lowercase = this.text.toLowerCase();
    this.uppercase = this.text.toUpperCase();
    this.length = this.text.length;
    this.partOfSpeech = partOfSpeech;
    this.phoneticTranscription = getPhoneme(this.lowercase);

    // Create phonetic syllables from phonemes
    this.phoneticSyllables = Sylabizer.createSyllables(this.phoneticTranscription);

    // Extract vowels and consonants
    this.vowels = Array.from(this.lowercase).filter((char) => UA_VOWELS.includes(char));
    this.consonants = Array.from(this.lowercase).filter((char) => UA_CONSONANTS.includes(char));

    this.vowelCount = this.vowels.length;
    this.consonantCount = this.consonants.length;

    // Analyze start and end
    this.isVowelStart = this.lowercase.length > 0 && UA_VOWELS.includes(this.lowercase[0]!);
    this.isVowelEnd =
      this.lowercase.length > 0 && UA_VOWELS.includes(this.lowercase[this.length - 1]!);

    // Calculate syllables (approximation: number of vowels)
    this.syllables = this.divideSyllables();
  }

  /**
   * Validates that all characters in the word are Ukrainian (letters + apostrophes)
   */
  private isValidUkrainian(text: string): boolean {
    return Array.from(text).every((char) => UA_WORD_VALID_CHARS.all.includes(char));
  }

  /**
   * Divides word into syllables (simplified: groups around vowels)
   */
  private divideSyllables(): string[] {
    const chars = Array.from(this.lowercase);
    const syllables: string[] = [];
    let currentSyllable = '';

    for (const char of chars) {
      currentSyllable += char;

      // Syllable ends after vowel(s) or at end of word
      if (UA_VOWELS.includes(char)) {
        syllables.push(currentSyllable);
        currentSyllable = '';
      }
    }

    // Add remaining consonants
    if (currentSyllable.length > 0) {
      if (syllables.length > 0) {
        syllables[syllables.length - 1] += currentSyllable;
      } else {
        syllables.push(currentSyllable);
      }
    }

    return syllables.length > 0 ? syllables : [this.lowercase];
  }
  /**
   * Returns the part of speech
   */
  getPartOfSpeech(): PosItem {
    return this.partOfSpeech;
  }

  /**
   * Sets the part of speech
   */
  setPartOfSpeech(partOfSpeech: PosItem): void {
    this.partOfSpeech = partOfSpeech;
  }

  /**
   * Returns the phonetic transcription (Phoneme array)
   */
  getPhoneticTranscription(): string {
    return this.phoneticTranscription.map((p) => p.symbol).join(' ');
  }

  /**
   * Returns the phonetic transcription as full Phoneme objects with all properties
   */
  getPhonemes(): Phoneme[] {
    return [...this.phoneticTranscription];
  }

  /**
   * Returns the original word text
   */
  getText(): string {
    return this.text;
  }

  /**
   * Returns the word in lowercase
   */
  getLowercase(): string {
    return this.lowercase;
  }

  /**
   * Returns the word in uppercase
   */
  getUppercase(): string {
    return this.uppercase;
  }

  /**
   * Returns the length of the word
   */
  getLength(): number {
    return this.length;
  }

  /**
   * Returns array of vowels in the word
   */
  getVowels(): string[] {
    return [...this.vowels];
  }

  /**
   * Returns array of consonants in the word
   */
  getConsonants(): string[] {
    return [...this.consonants];
  }

  /**
   * Returns the count of vowels
   */
  getVowelCount(): number {
    return this.vowelCount;
  }

  /**
   * Returns the count of consonants
   */
  getConsonantCount(): number {
    return this.consonantCount;
  }

  /**
   * Returns divided syllables
   */
  getSyllables(): string[] {
    return [...this.syllables];
  }

  /**
   * Returns phonetic syllables formatted with hyphenation
   */
  getPhoneticSyllablesFormatted(): string {
    return Sylabizer.formatWithStress(this.phoneticSyllables);
  }

  /**
   * Returns syllable structure analysis
   */
  getSyllableStructure() {
    return Sylabizer.analyzeSyllableStructure(this.phoneticSyllables);
  }

  /**
   * Returns the number of syllables
   */
  getSyllableCount(): number {
    return this.syllables.length;
  }

  /**
   * Returns the phonetic syllables with full structure and stress information
   */
  getPhoneticSyllables(): Syllable[] {
    return [...this.phoneticSyllables];
  }

  /**
   * Checks if word starts with a vowel
   */
  startsWithVowel(): boolean {
    return this.isVowelStart;
  }

  /**
   * Checks if word ends with a vowel
   */
  endsWithVowel(): boolean {
    return this.isVowelEnd;
  }

  /**
   * Checks if word starts with a consonant
   */
  startsWithConsonant(): boolean {
    return !this.isVowelStart;
  }

  /**
   * Checks if word ends with a consonant
   */
  endsWithConsonant(): boolean {
    return !this.isVowelEnd;
  }

  /**
   * Returns the first character
   */
  getFirstChar(): string {
    return this.lowercase.length > 0 ? this.lowercase[0]! : '';
  }

  /**
   * Returns the last character
   */
  getLastChar(): string {
    return this.lowercase.length > 0 ? this.lowercase[this.length - 1]! : '';
  }

  /**
   * Returns the first syllable
   */
  getFirstSyllable(): string {
    return this.syllables[0] || '';
  }

  /**
   * Returns the last syllable
   */
  getLastSyllable(): string {
    return this.syllables[this.syllables.length - 1] || '';
  }

  /**
   * Checks if word is monosyllabic
   */
  isMonosyllabic(): boolean {
    return this.syllables.length === 1;
  }

  /**
   * Checks if word is polysyllabic
   */
  isPolysyllabic(): boolean {
    return this.syllables.length > 1;
  }

  /**
   * Returns consonant-vowel pattern
   * C = consonant, V = vowel
  /**
   * Returns all available linguistic properties as an object
   */
  getProperties() {
    return {
      text: this.text,
      lowercase: this.lowercase,
      uppercase: this.uppercase,
      length: this.length,
      vowels: [...this.vowels],
      consonants: [...this.consonants],
      vowelCount: this.vowelCount,
      consonantCount: this.consonantCount,
      syllables: [...this.syllables],
      syllableCount: this.syllables.length,
      phoneticSyllables: this.getPhoneticSyllables(),
      phoneticSyllablesFormatted: this.getPhoneticSyllablesFormatted(),
      syllableStructure: this.getSyllableStructure(),
      startsWithVowel: this.isVowelStart,
      endsWithVowel: this.isVowelEnd,
      startsWithConsonant: this.startsWithConsonant(),
      endsWithConsonant: this.endsWithConsonant(),
      firstChar: this.getFirstChar(),
      lastChar: this.getLastChar(),
      firstSyllable: this.getFirstSyllable(),
      lastSyllable: this.getLastSyllable(),
      isMonosyllabic: this.isMonosyllabic(),
      isPolysyllabic: this.isPolysyllabic(),
      // cvPattern: this.getCVPattern(),
      partOfSpeech: this.partOfSpeech,
      phoneticTranscription: this.getPhoneticTranscription(),
      phonemes: this.getPhonemes(),
    };
  }

  /**
   * Returns a string representation of the word
   */
  toString(): string {
    return this.text;
  }
}
