/**
 * part-of-speech.const.ts
 * * Defines the standard Parts of Speech (Частини мови) for the Ukrainian language.
 * Uses 'as const' for robust type checking.
 */

// ============================================================================
// PART OF SPEECH GROUPS (as const)
// ============================================================================

export const PosGroups = {
  INDEPENDENT: 'independent', // Самостійні (Lexical words)
  SERVICE: 'service',         // Службові (Functional words)
  INTERJECTION: 'interjection', // Вигуки (Separate class)
} as const;

// ============================================================================
// UKRAINIAN PARTS OF SPEECH (full list)
// ============================================================================

export const UkrainianPartsOfSpeech = {
  // Independent / Lexical Words (Самостійні частини мови)
  NOUN: {
    key: 'N',
    ukrainian: 'Іменник',
    english: 'Noun',
    group: PosGroups.INDEPENDENT,
  },
  ADJECTIVE: {
    key: 'ADJ',
    ukrainian: 'Прикметник',
    english: 'Adjective',
    group: PosGroups.INDEPENDENT,
  },
  VERB: {
    key: 'V',
    ukrainian: 'Дієслово',
    english: 'Verb',
    group: PosGroups.INDEPENDENT,
  },
  NUMERAL: {
    key: 'NUM',
    ukrainian: 'Числівник',
    english: 'Numeral',
    group: PosGroups.INDEPENDENT,
  },
  PRONOUN: {
    key: 'PRON',
    ukrainian: 'Займенник',
    english: 'Pronoun',
    group: PosGroups.INDEPENDENT,
  },
  ADVERB: {
    key: 'ADV',
    ukrainian: 'Прислівник',
    english: 'Adverb',
    group: PosGroups.INDEPENDENT,
  },

  // Verbals (often classified separately)
  PARTICIPLE: {
    key: 'PARTC',
    ukrainian: 'Дієприкметник',
    english: 'Participle (Adjectival Verb)',
    group: PosGroups.INDEPENDENT,
  },
  ADVERBIAL_PARTICIPLE: {
    key: 'ADVP',
    ukrainian: 'Дієприслівник',
    english: 'Adverbial Participle (Gerund)',
    group: PosGroups.INDEPENDENT,
  },

  // Service / Functional Words (Службові частини мови)
  PREPOSITION: {
    key: 'PREP',
    ukrainian: 'Прийменник',
    english: 'Preposition',
    group: PosGroups.SERVICE,
  },
  CONJUNCTION: {
    key: 'CONJ',
    ukrainian: 'Сполучник',
    english: 'Conjunction',
    group: PosGroups.SERVICE,
  },
  PARTICLE: {
    key: 'PART',
    ukrainian: 'Частка',
    english: 'Particle',
    group: PosGroups.SERVICE,
  },

  // Separate Word Class (Окрема частина мови)
  INTERJECTION: {
    key: 'INTERJ',
    ukrainian: 'Вигук',
    english: 'Interjection',
    group: PosGroups.INTERJECTION,
  },
  
  // Auxiliary/Unknown
  PUNCTUATION: {
    key: 'PUNC',
    ukrainian: 'Розділовий знак',
    english: 'Punctuation',
    group: PosGroups.SERVICE,
  },
  UNKNOWN: {
    key: 'UNK',
    ukrainian: 'Невідомо',
    english: 'Unknown',
    group: PosGroups.SERVICE,
  },
} as const;


// ============================================================================
// TYPE GENERATION FOR TYPE SAFETY
// ============================================================================

/** The union type of all possible POS group literal strings: 'independent' | 'service' | 'interjection' */
export type PosGroup = typeof PosGroups[keyof typeof PosGroups];

/** The union type of all possible POS literal keys: 'NOUN' | 'ADJECTIVE' | ... */
export type PosKey = keyof typeof UkrainianPartsOfSpeech;

/** The type representing a single POS object, capturing all its properties and literal values. */
export type PosItem = typeof UkrainianPartsOfSpeech[PosKey];

/** The union type of all possible short codes: 'N' | 'ADJ' | 'V' | ... */
export type PosCode = PosItem['key'];