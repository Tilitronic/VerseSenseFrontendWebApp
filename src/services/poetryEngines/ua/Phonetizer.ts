export const PhoneticTypes = {
  VOWEL: 'vowel',
  CONSONANT: 'consonant',
} as const;

/**
 * Valid Ukrainian Characters - All characters used in Ukrainian language
 * Keys use Ukrainian letter names in English transliteration
 * Source: Ukrainian alphabet official names
 */
export const UACs = {
  // Vowels
  A: 'а', // а (a)
  E: 'е', // е (e)
  YE: 'є', // є (ye)
  I: 'і', // і (i)
  Y: 'и', // и (y)
  YI: 'ї', // ї (yi)
  O: 'о', // о (o)
  U: 'у', // у (u)
  YU: 'ю', // ю (yu)
  YA: 'я', // я (ya)

  // Consonants - Bilabial
  BE: 'б', // б (be)
  PE: 'п', // п (pe)
  VE: 'в', // в (ve)
  EF: 'ф', // ф (ef)
  EM: 'м', // м (em)

  // Consonants - Alveolar/Dental
  DE: 'д', // д (de)
  TE: 'т', // т (te)
  ZE: 'з', // з (ze)
  ES: 'с', // с (es)
  TSE: 'ц', // ц (tse)

  // Consonants - Postalveolar
  ZHE: 'ж', // ж (zhe)
  SHA: 'ш', // ш (sha)
  CHE: 'ч', // ч (che)
  SHCHA: 'щ', // щ (shcha)

  // Consonants - Velar
  KA: 'к', // к (ka)
  HE: 'г', // г (he)
  KHA: 'х', // х (kha)
  GE: 'ґ', // ґ (ge)

  // Consonants - Alveolar Approximants
  EL: 'л', // л (el)
  ER: 'р', // р (er)
  EN: 'н', // н (en)

  // Consonants - Palatal Approximant
  IY: 'й', // й (iy)

  // Special characters
  MZ: 'ь', // ь (soft sign)
  PS: "'", // ’ (apostrophe)
} as const;

export type ValidUkrainianCharKey = keyof typeof UACs;
export type PhoneticType = (typeof PhoneticTypes)[keyof typeof PhoneticTypes];

export const uacStr = Object.values(UACs).join('');

// ============================================================================
// CONSONANT CLASSIFICATION SYSTEM (Система приголосних)
// ============================================================================

/**
 * Manner of Articulation (Спосіб творення)
 * з. — зімкнені (plosives/stops)
 * щ. — щілинні (fricatives)
 * з.-щ. — зімкнено-щілинні (affricates)
 */
export const CONSONANT_MANNER = {
  PLOSIVE: 'plosive', // зімкнені (б, п, д, т, г, к)
  FRICATIVE: 'fricative', // щілинні (в, ф, з, с, ж, ш, х)
  AFFRICATE: 'affricate', // зімкнено-щілинні (дз, ц, дж, ч)
  NASAL: 'nasal', // носові (м, н)
  LATERAL: 'lateral', // бічні (л)
  TRILL: 'trill', // дрижачі (р)
  APPROXIMANT: 'approximant', // ковзні (й)
} as const;

/**
 * Place of Articulation (Місце творення)
 */
export const CONSONANT_PLACE = {
  // Губні (labial)
  LABIAL: 'labial',

  // Зубні (dental/alveolar)
  DENTAL: 'dental',

  // Зубні м'які (soft/palatalized dental)
  SOFT_DENTAL: 'soft_dental',

  // Піднебінні (postalveolar/palatal)
  PALATAL: 'palatal',

  // Задньоротові (velar)
  VELAR: 'velar',
} as const;

/**
 * Voicing (Дзвінкість)
 * дзвінкі - voiced (б, д, г, з, ж, в, й, р, л, н, м)
 * глухі - voiceless (п, т, к, с, ш, ф, ц, ч, х)
 */
export const CONSONANT_VOICING = {
  VOICED: 'voiced', // дзвінкі
  VOICELESS: 'voiceless', // глухі
} as const;

/**
 * Voice and Noise Participation (За участю тону й шуму)
 * Classification based on vocal cord vibration and noise characteristics
 *
 * сонорні - sonorants (м, н, л, р) - voicing without significant noise
 * дзвінкі - voiced (б, д, г, з, ж, в, й, дз, дж) - with vocal cord vibration + noise
 * глухі - voiceless (п, т, к, с, ш, ф, ц, ч, х) - noise without vocal cord vibration
 */
export const CONSONANT_SOUND_TYPE = {
  SONORANT: 'sonorant', // сонорні
  VOICED: 'voiced', // дзвінкі
  VOICELESS: 'voiceless', // глухі
} as const;

// Note: We move 'url' here as it's present in both IConsonant and IVowel.
export interface IPABaseSymbol {
  symbol: string;
  // IPA transcription
  description: string; // Ukrainian vowel description
}

/**
 * Interface for a Consonant Phoneme
 * - It must explicitly set phoneticType to the literal 'consonant'.
 */
export interface IConsonantConfig extends IPABaseSymbol {
  // The Discriminator: This must be a literal type.
  phoneticType: typeof PhoneticTypes.CONSONANT; // Type: 'consonant'
  palatalized: boolean; // Palatalization (М'якість/Твердість). Whether the consonant is palatalized (soft) or not (hard)
  place: (typeof CONSONANT_PLACE)[keyof typeof CONSONANT_PLACE]; // Place of Articulation
  manner: (typeof CONSONANT_MANNER)[keyof typeof CONSONANT_MANNER]; // Manner of Articulation
  voicing: (typeof CONSONANT_VOICING)[keyof typeof CONSONANT_VOICING]; // Voicing (Дзвінкість)
  soundType: (typeof CONSONANT_SOUND_TYPE)[keyof typeof CONSONANT_SOUND_TYPE]; // Sound Type (За участю тону й шуму)
}

/**
 * Interface for a Vowel Phoneme
 * - It must explicitly set phoneticType to the literal 'vowel'.
 */
export interface IVowelConfig extends IPABaseSymbol {
  // The Discriminator: This must be a literal type.
  phoneticType: typeof PhoneticTypes.VOWEL; // Type: 'vowel'
}

/**
 * Ukrainian Vowel Phonemes
 * Defines the six main vowels in Ukrainian:
 * а, о, у, и, і, е
 */
const VOWELS: Record<string, IVowelConfig> = {
  а: {
    symbol: 'а',
    phoneticType: PhoneticTypes.VOWEL,
    description: 'open back unrounded vowel (a)',
  },
  о: {
    symbol: 'о',
    phoneticType: PhoneticTypes.VOWEL,
    description: 'open-mid back rounded vowel (o)',
  },
  у: {
    symbol: 'у',
    phoneticType: PhoneticTypes.VOWEL,
    description: 'close back rounded vowel (u)',
  },
  и: {
    symbol: 'и',
    phoneticType: PhoneticTypes.VOWEL,
    description: 'near-close front unrounded vowel (y)',
  },
  і: {
    symbol: 'і',
    phoneticType: PhoneticTypes.VOWEL,
    description: 'close front unrounded vowel (i)',
  },
  е: {
    symbol: 'е',
    phoneticType: PhoneticTypes.VOWEL,
    description: 'open-mid front unrounded vowel (e)',
  },
} as const;

/**
 * Ukrainian Consonant Phonemes
 * Includes all main consonants with soft/palatalized variants where applicable
 */
const CONSONANTS: Record<string, IConsonantConfig> = {
  // Bilabial stops
  б: {
    symbol: 'б',
    phoneticType: PhoneticTypes.CONSONANT,
    description: 'voiced bilabial plosive (b)',
    palatalized: false,
    place: CONSONANT_PLACE.LABIAL,
    manner: CONSONANT_MANNER.PLOSIVE,
    voicing: CONSONANT_VOICING.VOICED,
    soundType: CONSONANT_SOUND_TYPE.VOICED,
  },
  п: {
    symbol: 'п',
    phoneticType: PhoneticTypes.CONSONANT,
    description: 'voiceless bilabial plosive (p)',
    place: CONSONANT_PLACE.LABIAL,
    palatalized: false,
    manner: CONSONANT_MANNER.PLOSIVE,
    voicing: CONSONANT_VOICING.VOICELESS,
    soundType: CONSONANT_SOUND_TYPE.VOICELESS,
  },

  // Labiodental fricatives
  в: {
    symbol: 'в',
    phoneticType: PhoneticTypes.CONSONANT,
    description: 'voiced labiodental fricative (v)',
    place: CONSONANT_PLACE.LABIAL,
    palatalized: false,
    manner: CONSONANT_MANNER.FRICATIVE,
    voicing: CONSONANT_VOICING.VOICED,
    soundType: CONSONANT_SOUND_TYPE.VOICED,
  },
  ф: {
    symbol: 'ф',
    phoneticType: PhoneticTypes.CONSONANT,
    description: 'voiceless labiodental fricative (f)',
    place: CONSONANT_PLACE.LABIAL,
    palatalized: false,
    manner: CONSONANT_MANNER.FRICATIVE,
    voicing: CONSONANT_VOICING.VOICELESS,
    soundType: CONSONANT_SOUND_TYPE.VOICELESS,
  },

  // Bilabial nasal
  м: {
    symbol: 'м',
    phoneticType: PhoneticTypes.CONSONANT,
    description: 'voiced bilabial nasal (m)',
    place: CONSONANT_PLACE.LABIAL,
    palatalized: false,
    manner: CONSONANT_MANNER.NASAL,
    voicing: CONSONANT_VOICING.VOICED,
    soundType: CONSONANT_SOUND_TYPE.SONORANT,
  },

  // Postalveolar sibilant affricates
  ж: {
    symbol: 'ж',
    phoneticType: PhoneticTypes.CONSONANT,
    description: 'voiced postalveolar sibilant fricative (zh)',
    place: CONSONANT_PLACE.PALATAL,
    palatalized: false,
    manner: CONSONANT_MANNER.FRICATIVE,
    voicing: CONSONANT_VOICING.VOICED,
    soundType: CONSONANT_SOUND_TYPE.VOICED,
  },
  ш: {
    symbol: 'ш',
    phoneticType: PhoneticTypes.CONSONANT,
    description: 'voiceless postalveolar sibilant fricative (sh)',
    place: CONSONANT_PLACE.PALATAL,
    palatalized: false,
    manner: CONSONANT_MANNER.FRICATIVE,
    voicing: CONSONANT_VOICING.VOICELESS,
    soundType: CONSONANT_SOUND_TYPE.VOICELESS,
  },
  ч: {
    symbol: 'ч',
    phoneticType: PhoneticTypes.CONSONANT,
    description: 'voiceless postalveolar affricate (ch)',
    place: CONSONANT_PLACE.PALATAL,
    palatalized: false,
    manner: CONSONANT_MANNER.AFFRICATE,
    voicing: CONSONANT_VOICING.VOICELESS,
    soundType: CONSONANT_SOUND_TYPE.VOICELESS,
  },
  дж: {
    symbol: 'дж',
    phoneticType: PhoneticTypes.CONSONANT,
    description: 'voiced postalveolar affricate (dzh)',
    place: CONSONANT_PLACE.PALATAL,
    palatalized: false,
    manner: CONSONANT_MANNER.AFFRICATE,
    voicing: CONSONANT_VOICING.VOICED,
    soundType: CONSONANT_SOUND_TYPE.VOICED,
  },

  // Velar stops
  к: {
    symbol: 'к',
    phoneticType: PhoneticTypes.CONSONANT,
    description: 'voiceless velar plosive (k)',
    place: CONSONANT_PLACE.VELAR,
    palatalized: false,
    manner: CONSONANT_MANNER.PLOSIVE,
    voicing: CONSONANT_VOICING.VOICELESS,
    soundType: CONSONANT_SOUND_TYPE.VOICELESS,
  },
  г: {
    symbol: 'г',
    phoneticType: PhoneticTypes.CONSONANT,
    description: 'voiced velar plosive (g)',
    place: CONSONANT_PLACE.VELAR,
    palatalized: false,
    manner: CONSONANT_MANNER.PLOSIVE,
    voicing: CONSONANT_VOICING.VOICED,
    soundType: CONSONANT_SOUND_TYPE.VOICED,
  },
  х: {
    symbol: 'х',
    phoneticType: PhoneticTypes.CONSONANT,
    description: 'voiceless velar fricative (kh)',
    place: CONSONANT_PLACE.VELAR,
    palatalized: false,
    manner: CONSONANT_MANNER.FRICATIVE,
    voicing: CONSONANT_VOICING.VOICELESS,
    soundType: CONSONANT_SOUND_TYPE.VOICELESS,
  },
  ґ: {
    symbol: 'ґ',
    phoneticType: PhoneticTypes.CONSONANT,
    description: 'voiced velar plosive (g) - rare',
    place: CONSONANT_PLACE.VELAR,
    palatalized: false,
    manner: CONSONANT_MANNER.PLOSIVE,
    voicing: CONSONANT_VOICING.VOICED,
    soundType: CONSONANT_SOUND_TYPE.VOICED,
  },

  // Alveolar stops
  т: {
    symbol: 'т',
    phoneticType: PhoneticTypes.CONSONANT,
    description: 'voiceless alveolar plosive (t)',
    place: CONSONANT_PLACE.DENTAL,
    palatalized: false,
    manner: CONSONANT_MANNER.PLOSIVE,
    voicing: CONSONANT_VOICING.VOICELESS,
    soundType: CONSONANT_SOUND_TYPE.VOICELESS,
  },
  д: {
    symbol: 'д',
    phoneticType: PhoneticTypes.CONSONANT,
    description: 'voiced alveolar plosive (d)',
    place: CONSONANT_PLACE.DENTAL,
    palatalized: false,
    manner: CONSONANT_MANNER.PLOSIVE,
    voicing: CONSONANT_VOICING.VOICED,
    soundType: CONSONANT_SOUND_TYPE.VOICED,
  },

  // Alveolar sibilants
  з: {
    symbol: 'з',
    phoneticType: PhoneticTypes.CONSONANT,
    description: 'voiced alveolar sibilant (z)',
    place: CONSONANT_PLACE.DENTAL,
    palatalized: false,
    manner: CONSONANT_MANNER.FRICATIVE,
    voicing: CONSONANT_VOICING.VOICED,
    soundType: CONSONANT_SOUND_TYPE.VOICED,
  },
  с: {
    symbol: 'с',
    phoneticType: PhoneticTypes.CONSONANT,
    description: 'voiceless alveolar sibilant (s)',
    place: CONSONANT_PLACE.DENTAL,
    palatalized: false,
    manner: CONSONANT_MANNER.FRICATIVE,
    voicing: CONSONANT_VOICING.VOICELESS,
    soundType: CONSONANT_SOUND_TYPE.VOICELESS,
  },

  // Alveolar affricates
  ц: {
    symbol: 'ц',
    phoneticType: PhoneticTypes.CONSONANT,
    description: 'voiceless alveolar affricate (ts)',
    place: CONSONANT_PLACE.DENTAL,
    palatalized: false,
    manner: CONSONANT_MANNER.AFFRICATE,
    voicing: CONSONANT_VOICING.VOICELESS,
    soundType: CONSONANT_SOUND_TYPE.VOICELESS,
  },
  дз: {
    symbol: 'дз',
    phoneticType: PhoneticTypes.CONSONANT,
    description: 'voiced alveolar affricate (dz)',
    place: CONSONANT_PLACE.DENTAL,
    palatalized: false,
    manner: CONSONANT_MANNER.AFFRICATE,
    voicing: CONSONANT_VOICING.VOICED,
    soundType: CONSONANT_SOUND_TYPE.VOICED,
  },

  // Alveolar approximants
  р: {
    symbol: 'р',
    phoneticType: PhoneticTypes.CONSONANT,
    description: 'voiced alveolar trill (r)',
    place: CONSONANT_PLACE.DENTAL,
    palatalized: false,
    manner: CONSONANT_MANNER.TRILL,
    voicing: CONSONANT_VOICING.VOICED,
    soundType: CONSONANT_SOUND_TYPE.SONORANT,
  },
  л: {
    symbol: 'л',
    phoneticType: PhoneticTypes.CONSONANT,
    description: 'voiced alveolar lateral approximant (l)',
    place: CONSONANT_PLACE.DENTAL,
    palatalized: false,
    manner: CONSONANT_MANNER.LATERAL,
    voicing: CONSONANT_VOICING.VOICED,
    soundType: CONSONANT_SOUND_TYPE.SONORANT,
  },

  // Alveolar nasals
  н: {
    symbol: 'н',
    phoneticType: PhoneticTypes.CONSONANT,
    description: 'voiced alveolar nasal (n)',
    place: CONSONANT_PLACE.DENTAL,
    palatalized: false,
    manner: CONSONANT_MANNER.NASAL,
    voicing: CONSONANT_VOICING.VOICED,
    soundType: CONSONANT_SOUND_TYPE.SONORANT,
  },

  // Palatal approximant
  j: {
    symbol: 'j',
    phoneticType: PhoneticTypes.CONSONANT,
    description: 'voiced palatal approximant (y)',
    place: CONSONANT_PLACE.PALATAL,
    palatalized: true,
    manner: CONSONANT_MANNER.APPROXIMANT,
    voicing: CONSONANT_VOICING.VOICED,
    soundType: CONSONANT_SOUND_TYPE.SONORANT,
  },
} as const;

export type VowelKey = keyof typeof VOWELS;
export type ConsonantKey = keyof typeof CONSONANTS;
export type PhonemeConfig = IConsonantConfig | IVowelConfig;

/**
 * Consonant Phoneme - Discriminated union with phoneticType = 'consonant'
 */
export interface ConsonantPhoneme extends IConsonantConfig {
  phoneticType: typeof PhoneticTypes.CONSONANT;
  palatalized: boolean; // Always defined for consonants
}

/**
 * Vowel Phoneme - Discriminated union with phoneticType = 'vowel'
 */
export interface VowelPhoneme extends IVowelConfig {
  phoneticType: typeof PhoneticTypes.VOWEL;
}

/**
 * Union type for any phoneme - discriminated by phoneticType
 */
export type Phoneme = ConsonantPhoneme | VowelPhoneme;

const PHONEMES = {
  ...CONSONANTS,
  ...VOWELS,
} as const;

export type PhonemeKeys = keyof typeof PHONEMES;

/**
 * Type-safe phoneme key constants to prevent string literal bugs
 * Usage: PhonemeKey.CONSONANTS.B instead of 'б'
 */
export const PhonemeKey = {
  VOWELS: {
    A: 'а' as const,
    O: 'о' as const,
    U: 'у' as const,
    Y: 'и' as const,
    I: 'і' as const,
    E: 'е' as const,
  },
  CONSONANTS: {
    // Bilabial
    B: 'б' as const,
    P: 'п' as const,
    V: 'в' as const,
    F: 'ф' as const,
    M: 'м' as const,
    // Postalveolar
    ZH: 'ж' as const,
    SH: 'ш' as const,
    CH: 'ч' as const,
    DZH: 'дж' as const,
    // Velar
    K: 'к' as const,
    G: 'г' as const,
    KH: 'х' as const,
    GG: 'ґ' as const,
    // Dental
    T: 'т' as const,
    D: 'д' as const,
    Z: 'з' as const,
    S: 'с' as const,
    TS: 'ц' as const,
    DZ: 'дз' as const,
    // Approximants
    R: 'р' as const,
    L: 'л' as const,
    N: 'н' as const,
    J: 'j' as const,
  },
} as const;

function isPalatalized(restOfWord: string): boolean {
  if (!restOfWord) return false;
  const platalizators = ['ь', 'я', 'ю', 'є', 'і'];
  return platalizators.some((p) => restOfWord.startsWith(p));
}

/**
 * Standardize apostrophe characters to a single canonical form
 * Converts various apostrophe-like characters (', ', ′, *, etc.) to the standard apostrophe (')
 * Handles all positions including middle of words
 */
function standardizeApostrophes(text: string): string {
  // Replace various apostrophe characters with the standard apostrophe from UACs.PS
  // Includes: ' (right single quote), ' (left single quote), ′ (prime), * (asterisk), ` (backtick), etc.
  return text.replace(/['′'*`ʹ˚ʼ]/g, UACs.PS);
}

function isWithJ(options: CreatePhonemeOptions): boolean {
  console.log('isWithJ options:', options);
  if (!options.prevChar) {
    return true;
  }
  if (
    options.transcription.length > 0 &&
    options.transcription[options.transcription.length - 1]!.phoneticType === PhoneticTypes.VOWEL
  ) {
    return true;
  }
  if (options.prevChar === UACs.PS) {
    return true;
  }
  return false;
}

/**
 * Phoneme Factory - Creates the appropriate phoneme type based on the phoneme's phoneticType
 * Returns either ConsonantPhoneme or VowelPhoneme with proper type discrimination
 *
 * @param key - PhonemeKey to lookup in PHONEMES object
 * @param options - Options including restOfWord for palatalization detection (consonants only)
 * @returns Properly typed Phoneme (ConsonantPhoneme or VowelPhoneme)
 * @throws Error if key not found in PHONEMES
 */
interface CreatePhonemeOptions {
  restOfWord: string;
  prevChar: string;
  transcription: Phoneme[];
}

function createPhoneme(key: PhonemeKeys, options: CreatePhonemeOptions): Phoneme {
  const basePhoneme = PHONEMES[key];
  if (!basePhoneme) {
    throw new Error(`createPhoneme: Phoneme key "${String(key)}" not found in PHONEMES`);
  }

  // Type guard for consonants: Apply palatalization
  if (basePhoneme.phoneticType === PhoneticTypes.CONSONANT) {
    const palatalized = isPalatalized(options.restOfWord);
    return {
      ...basePhoneme,
      palatalized,
    } as ConsonantPhoneme;
  }

  // Type guard for vowels: Return as-is
  if (basePhoneme.phoneticType === PhoneticTypes.VOWEL) {
    return basePhoneme as VowelPhoneme;
  }

  // Exhaustive check - should never reach here
  throw new Error(`createPhoneme: Unknown phoneme type: ${String(basePhoneme)}`);
}

export function getPhoneme(word: string): Phoneme[] {
  console.log('word', word);
  const cleanedWord = standardizeApostrophes(word.trim().toLowerCase());
  console.log('cleanedWord', cleanedWord);
  const transcription: Phoneme[] = [];

  // Create array of character objects for proper Unicode handling
  const charObjects = Array.from(cleanedWord).map((char, index) => ({
    char,
    code: char.charCodeAt(0),
    index,
  }));

  console.log(
    'charObjects:',
    charObjects.map((c) => `${c.index}: ${c.char} (${c.code})`).join(', '),
  );

  for (let i = 0; i < charObjects.length; i++) {
    const { char, code } = charObjects[i]!;
    console.log(`[Loop] i=${i}, char="${char}" (${code})`);

    // Check for digraphs FIRST: current char + next char
    const nextChar = i + 1 < charObjects.length ? charObjects[i + 1]!.char : '';
    const possibleDigraph = char + nextChar;

    // Only check if both chars are valid Ukrainian characters
    if (nextChar && (PHONEMES as Record<string, Phoneme | undefined>)[possibleDigraph]) {
      console.log(`[Digraph found] "${possibleDigraph}" at index ${i}`);
      const restOfWord = charObjects
        .slice(i + 2) // Skip both characters of digraph
        .map((c) => c.char)
        .join('');
      const prevChar = i > 0 ? charObjects[i - 1]!.char : '';
      const options: CreatePhonemeOptions = {
        restOfWord,
        prevChar,
        transcription,
      };
      const digraphPhoneme = createPhoneme(possibleDigraph as PhonemeKeys, options);
      transcription.push(digraphPhoneme);
      i++; // Skip next character
      console.log(`[Digraph processed] i incremented to ${i}`);
      continue;
    }

    // Regular single character processing
    const restOfWord = charObjects
      .slice(i + 1)
      .map((c) => c.char)
      .join(''); // Get only AFTER current character for palatalization check
    const prevChar = i > 0 ? charObjects[i - 1]!.char : '';
    const options: CreatePhonemeOptions = {
      restOfWord,
      prevChar,
      transcription,
    };

    if (!uacStr.includes(char.toLowerCase())) {
      console.warn(`Character "${char}" (code: ${code}) is not a valid Ukrainian character.`);
      continue;
    }

    console.log(char, `(code: ${code})`);
    switch (char) {
      // Vowels
      case UACs.A: {
        const phoneme = createPhoneme(PhonemeKey.VOWELS.A, options);
        transcription.push(phoneme);
        break;
      }
      case UACs.O: {
        const phoneme = createPhoneme(PhonemeKey.VOWELS.O, options);
        transcription.push(phoneme);
        break;
      }
      case UACs.U: {
        const phoneme = createPhoneme(PhonemeKey.VOWELS.U, options);
        transcription.push(phoneme);
        break;
      }
      case UACs.Y: {
        const phoneme = createPhoneme(PhonemeKey.VOWELS.Y, options);
        transcription.push(phoneme);
        break;
      }
      case UACs.I: {
        const phoneme = createPhoneme(PhonemeKey.VOWELS.I, options);
        transcription.push(phoneme);
        break;
      }
      case UACs.E: {
        const phoneme = createPhoneme(PhonemeKey.VOWELS.E, options);
        transcription.push(phoneme);
        break;
      }

      // Consonants - Bilabial
      case UACs.BE: {
        const phoneme = createPhoneme(PhonemeKey.CONSONANTS.B, options);
        transcription.push(phoneme);
        break;
      }
      case UACs.PE: {
        const phoneme = createPhoneme(PhonemeKey.CONSONANTS.P, options);
        transcription.push(phoneme);
        break;
      }
      case UACs.VE: {
        const phoneme = createPhoneme(PhonemeKey.CONSONANTS.V, options);
        transcription.push(phoneme);
        break;
      }
      case UACs.EF: {
        const phoneme = createPhoneme(PhonemeKey.CONSONANTS.F, options);
        transcription.push(phoneme);
        break;
      }
      case UACs.EM: {
        const phoneme = createPhoneme(PhonemeKey.CONSONANTS.M, options);
        transcription.push(phoneme);
        break;
      }

      // Consonants - Postalveolar
      case UACs.ZHE: {
        const phoneme = createPhoneme(PhonemeKey.CONSONANTS.ZH, options);
        transcription.push(phoneme);
        break;
      }
      case UACs.SHA: {
        const phoneme = createPhoneme(PhonemeKey.CONSONANTS.SH, options);
        transcription.push(phoneme);
        break;
      }
      case UACs.CHE: {
        const phoneme = createPhoneme(PhonemeKey.CONSONANTS.CH, options);
        transcription.push(phoneme);
        break;
      }

      // Consonants - Velar
      case UACs.KA: {
        const phoneme = createPhoneme(PhonemeKey.CONSONANTS.K, options);
        transcription.push(phoneme);
        break;
      }
      case UACs.HE: {
        const phoneme = createPhoneme(PhonemeKey.CONSONANTS.G, options);
        transcription.push(phoneme);
        break;
      }
      case UACs.KHA: {
        const phoneme = createPhoneme(PhonemeKey.CONSONANTS.KH, options);
        transcription.push(phoneme);
        break;
      }
      case UACs.GE: {
        const phoneme = createPhoneme(PhonemeKey.CONSONANTS.GG, options);
        transcription.push(phoneme);
        break;
      }

      // Consonants - Dental
      case UACs.TE: {
        const phoneme = createPhoneme(PhonemeKey.CONSONANTS.T, options);
        transcription.push(phoneme);
        break;
      }
      case UACs.DE: {
        const phoneme = createPhoneme(PhonemeKey.CONSONANTS.D, options);
        transcription.push(phoneme);
        break;
      }
      case UACs.ZE: {
        const phoneme = createPhoneme(PhonemeKey.CONSONANTS.Z, options);
        transcription.push(phoneme);
        break;
      }
      case UACs.ES: {
        const phoneme = createPhoneme(PhonemeKey.CONSONANTS.S, options);
        transcription.push(phoneme);
        break;
      }
      case UACs.TSE: {
        const phoneme = createPhoneme(PhonemeKey.CONSONANTS.TS, options);
        transcription.push(phoneme);
        break;
      }

      // Consonants - Approximants
      case UACs.ER: {
        const phoneme = createPhoneme(PhonemeKey.CONSONANTS.R, options);
        transcription.push(phoneme);
        break;
      }
      case UACs.EL: {
        const phoneme = createPhoneme(PhonemeKey.CONSONANTS.L, options);
        transcription.push(phoneme);
        break;
      }
      case UACs.EN: {
        const phoneme = createPhoneme(PhonemeKey.CONSONANTS.N, options);
        transcription.push(phoneme);
        break;
      }
      case UACs.IY: {
        const phoneme = createPhoneme(PhonemeKey.CONSONANTS.J, options);
        transcription.push(phoneme);
        break;
      }

      // Digraphs - Special combinations
      case UACs.YA: {
        if (isWithJ(options)) {
          const j = createPhoneme(PhonemeKey.CONSONANTS.J, options);
          transcription.push(j);
        }
        const a = createPhoneme(PhonemeKey.VOWELS.A, options);
        transcription.push(a);
        break;
      }
      case UACs.YE: {
        if (isWithJ(options)) {
          const j = createPhoneme(PhonemeKey.CONSONANTS.J, options);
          transcription.push(j);
        }
        const e = createPhoneme(PhonemeKey.VOWELS.E, options);
        transcription.push(e);
        break;
      }
      case UACs.YI: {
        if (isWithJ(options)) {
          const j = createPhoneme(PhonemeKey.CONSONANTS.J, options);
          transcription.push(j);
        }
        const i = createPhoneme(PhonemeKey.VOWELS.I, options);
        transcription.push(i);
        break;
      }
      case UACs.YU: {
        if (isWithJ(options)) {
          const j = createPhoneme(PhonemeKey.CONSONANTS.J, options);
          transcription.push(j);
        }
        const u = createPhoneme(PhonemeKey.VOWELS.U, options);
        transcription.push(u);
        break;
      }
      case UACs.SHCHA: {
        const sh = createPhoneme(PhonemeKey.CONSONANTS.SH, options);
        const ch = createPhoneme(PhonemeKey.CONSONANTS.CH, options);
        transcription.push(sh);
        transcription.push(ch);
        break;
      }

      // Special
      case UACs.MZ:
        // Soft sign - already handled by palatalization in consonant creation
        break;
      case UACs.PS:
        // Apostrophe - indicates no palatalization, already handled
        break;
      default:
        break;
    }
  }
  console.log(
    transcription
      .map((p) => {
        if (p.phoneticType === PhoneticTypes.CONSONANT && p.palatalized) {
          return p.symbol + "'";
        }
        return p.symbol;
      })
      .join(''),
    transcription,
  );
  return transcription;
}
