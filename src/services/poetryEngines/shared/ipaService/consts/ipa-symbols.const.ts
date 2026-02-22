// ====================================================================
// 1. CONSTANT DEFINITIONS (using `as const` to infer string literals)
// ====================================================================

// --- Place of Articulation Constants ---
export const BI = 'BILABIAL' as const; // Губні
export const LD = 'LABIODENTAL' as const;
export const LL = 'LINGUOLABIAL' as const;
export const DE = 'DENTAL' as const; // Зубні
export const AL = 'ALVEOLAR' as const;
export const PO = 'POSTALVEOLAR' as const;
export const RF = 'RETROFLEX' as const;
export const PA = 'PALATAL' as const;
export const VE = 'VELAR' as const;
export const LV = 'LABIALVELAR' as const;
export const UV = 'UVULAR' as const;
export const PH = 'PHARYNGEAL/EPIGLOTTAL' as const;
export const GL = 'GLOTTAL' as const;

// --- Manner of Articulation Constants ---
export const NA = 'NASAL' as const;
export const PL = 'PLOSIVE' as const;
export const IM = 'IMPLOSIVE' as const;
export const SA = 'SIBILANT AFFRICATE' as const;
export const NS = 'NON-SIBILANT AFFRICATE' as const;
export const SF = 'SIBILANT FRICATIVE' as const;
export const NF = 'NON-SIBILANT FRICATIVE' as const;
export const AP = 'APPROXIMANT' as const;
export const TF = 'TAP/FLAP' as const;
export const TR = 'TRILL' as const;
export const LA = 'LATERAL AFFRICATE' as const;
export const LF = 'LATERAL FRICATIVE' as const;
export const LP = 'LATERAL APPROXIMANT' as const;
export const LT = 'LATERAL TAP/FLAP' as const;

// --- Vowel Roundedness Constants ---
export const UR = 'unrounded' as const;
export const R = 'rounded' as const;

// --- Vowel Height Constants ---
export const C = 'close' as const;
export const NC = 'near-close' as const;
export const CM = 'close-mid' as const;
export const M = 'mid' as const;
export const OM = 'open-mid' as const;
export const NO = 'near-open' as const;
export const O = 'open' as const;

// --- Vowel Backness Constants ---
export const F = 'front' as const;
export const CE = 'central' as const;
export const B = 'back' as const;
export const NB = 'near-back' as const;
export const NFR = 'near-front' as const;

// ====================================================================
// 2. ARRAY EXPORTS (using `as const` to create immutable tuple types)
// ====================================================================

export const PLACES = {
  BI,
  LD,
  LL,
  DE,
  AL,
  PO,
  RF,
  PA,
  VE,
  LV,
  UV,
  PH,
  GL,
} as const;
export const MANNERS = {
  PL,
  NA,
  IM,
  SA,
  NS,
  SF,
  NF,
  AP,
  TF,
  TR,
  LA,
  LF,
  LP,
  LT,
} as const;
export const HEIGHTS = {
  C,
  NC,
  CM,
  M,
  OM,
  NO,
  O,
} as const;
export const BACKNESSES = {
  F,
  NFR,
  CE,
  NB,
  B,
} as const;

// ====================================================================
// 3. UNION TYPE GENERATION (The correct way for arrays)
// ====================================================================

/**
 * Creates a union of all literal string values from the `PLACES` object.
 * Example: 'BILABIAL' | 'LABIODENTAL' | ... | 'GLOTTAL'
 */
export type PlaceOfArticulation = (typeof PLACES)[keyof typeof PLACES];

/**
 * Creates a union of all literal string values from the `MANNERS` object.
 * Example: 'PLOSIVE' | 'NASAL' | ... | 'LATERAL TAP/FLAP'
 */
export type MannerOfArticulation = (typeof MANNERS)[keyof typeof MANNERS];

/**
 * Creates a union of all literal string values from the `HEIGHTS` object.
 * Example: 'close' | 'near-close' | ... | 'open'
 */
export type VowelHeight = (typeof HEIGHTS)[keyof typeof HEIGHTS];

/**
 * Creates a union of all literal string values from the `BACKNESSES` object.
 * Example: 'front' | 'near-front' | ... | 'back'
 */
export type VowelBackness = (typeof BACKNESSES)[keyof typeof BACKNESSES];

/**
 * Creates a union of the two roundedness literal string values.
 * Example: 'unrounded' | 'rounded'
 */
export type VowelRoundedness = typeof UR | typeof R;

// ====================================================================
// 4. INTERFACE DEFINITIONS
// ====================================================================

export const PhoneticTypes = {
  VOWEL: 'vowel',
  CONSONANT: 'consonant',
} as const;

export type PhoneticType = (typeof PhoneticTypes)[keyof typeof PhoneticTypes];

// --- Base Interface (for common fields only, excluding the discriminator) ---
// Note: We move 'url' here as it's present in both IConsonant and IVowel.
export interface IPABaseSymbol {
  symbol: string;
  url: string;
}

/**
 * Interface for a Consonant Phoneme
 * - It must explicitly set phoneticType to the literal 'consonant'.
 */
export interface IConsonant extends IPABaseSymbol {
  // The Discriminator: This must be a literal type.
  phoneticType: typeof PhoneticTypes.CONSONANT; // Type: 'consonant'

  manner: MannerOfArticulation;
  place: PlaceOfArticulation;
  voiced: boolean;
}

/**
 * Interface for a Vowel Phoneme
 * - It must explicitly set phoneticType to the literal 'vowel'.
 */
export interface IVowel extends IPABaseSymbol {
  // The Discriminator: This must be a literal type.
  phoneticType: typeof PhoneticTypes.VOWEL; // Type: 'vowel'

  height: VowelHeight;
  backness: VowelBackness;
  roundedness: VowelRoundedness;
}

// --- THE COMMON TYPE ---

/**
 * The common type for all classified phonetic symbols.
 * This is a Discriminated Union.
 */
export type PhoneticSymbol = IVowel | IConsonant;

// ====================================================================
// 5. DATA EXPORTS (Applying the new types)
// ====================================================================

// Apply the readonly IConsonant[] type to prevent accidental mutation
// and ensure the feature strings are validated against the union type.
export const CONSONANTS = [
  {
    manner: NA,
    place: BI,
    symbol: 'm̥',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_bilabial_nasal',
  },
  {
    manner: NA,
    place: BI,
    symbol: 'm',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_bilabial_nasal',
  },
  {
    manner: PL,
    place: BI,
    symbol: 'p',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_bilabial_plosive',
  },
  {
    manner: PL,
    place: BI,
    symbol: 'b',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_bilabial_plosive',
  },
  {
    manner: NF,
    place: BI,
    symbol: 'ɸ',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_bilabial_fricative',
  },
  {
    manner: NF,
    place: BI,
    symbol: 'β',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_bilabial_fricative',
  },
  {
    manner: NS,
    place: BI,
    symbol: 'pɸ',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_bilabial_affricate',
  },
  {
    manner: NS,
    place: BI,
    symbol: 'bβ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_bilabial_affricate',
  },
  {
    manner: TF,
    place: BI,
    symbol: 'ⱱ̟',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_bilabial_flap',
  },
  {
    manner: TR,
    place: BI,
    symbol: 'ʙ̥',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_bilabial_trill',
  },
  {
    manner: TR,
    place: BI,
    symbol: 'ʙ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_bilabial_trill',
  },
  {
    manner: NA,
    place: LD,
    symbol: 'ɱ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_labiodental_nasal',
  },
  {
    manner: PL,
    place: LD,
    symbol: 'p̪',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_labiodental_plosive',
  },
  {
    manner: PL,
    place: LD,
    symbol: 'b̪',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_labiodental_plosive',
  },
  {
    manner: NS,
    place: LD,
    symbol: 'p̪f',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_labiodental_affricate',
  },
  {
    manner: NS,
    place: LD,
    symbol: 'b̪v',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_labiodental_affricate',
  },
  {
    manner: NF,
    place: LD,
    symbol: 'f',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_labiodental_fricative',
  },
  {
    manner: NF,
    place: LD,
    symbol: 'v',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_labiodental_fricative',
  },
  {
    manner: AP,
    place: LD,
    symbol: 'ʋ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_labiodental_approximant',
  },
  {
    manner: TF,
    place: LD,
    symbol: 'ⱱ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_labiodental_flap',
  },
  {
    manner: NA,
    place: LL,
    symbol: 'n̼',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_linguolabial_nasal',
  },
  {
    manner: PL,
    place: LL,
    symbol: 't̼',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_linguolabial_plosive',
  },
  {
    manner: PL,
    place: LL,
    symbol: 'd̼',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_linguolabial_plosive',
  },
  {
    manner: NF,
    place: LL,
    symbol: 'θ̼',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_linguolabial_fricative',
  },
  {
    manner: NF,
    place: LL,
    symbol: 'ð̼',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_linguolabial_fricative',
  },
  {
    manner: TF,
    place: LL,
    symbol: 'ɾ̼',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_linguolabial_tap',
  },
  {
    manner: NA,
    place: AL,
    symbol: 'n̥',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_alveolar_nasal',
  },
  {
    manner: NA,
    place: AL,
    symbol: 'n',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_alveolar_nasal',
  },
  {
    manner: PL,
    place: AL,
    symbol: 't',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_alveolar_plosive',
  },
  {
    manner: PL,
    place: AL,
    symbol: 'd',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_alveolar_plosive',
  },
  {
    manner: SA,
    place: AL,
    symbol: 'ts',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_alveolar_affricate',
  },
  {
    manner: SA,
    place: AL,
    symbol: 'dz',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_alveolar_affricate',
  },
  {
    manner: SA,
    place: PO,
    symbol: 't̠ʃ',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_postalveolar_affricate',
  },
  {
    manner: SA,
    place: PO,
    symbol: 'd̠ʒ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_postalveolar_affricate',
  },
  {
    manner: NS,
    place: DE,
    symbol: 't̪θ',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_dental_non-sibilant_affricate',
  },
  {
    manner: NS,
    place: DE,
    symbol: 'd̪ð',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_dental_non-sibilant_affricate',
  },
  {
    manner: NS,
    place: AL,
    symbol: 'tɹ̝̊',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_alveolar_non-sibilant_affricate',
  },
  {
    manner: NS,
    place: AL,
    symbol: 'dɹ̝',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_alveolar_non-sibilant_affricate',
  },
  {
    manner: NS,
    place: PO,
    symbol: 't̠ɹ̠̊˔',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_postalveolar_non-sibilant_affricate',
  },
  {
    manner: NS,
    place: PO,
    symbol: 'd̠ɹ̠˔',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_postalveolar_non-sibilant_affricate',
  },
  {
    manner: SF,
    place: AL,
    symbol: 's',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_alveolar_fricative',
  },
  {
    manner: SF,
    place: AL,
    symbol: 'z',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_alveolar_fricative',
  },
  {
    manner: SF,
    place: PO,
    symbol: 'ʃ',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_postalveolar_fricative',
  },
  {
    manner: SF,
    place: PO,
    symbol: 'ʒ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_postalveolar_fricative',
  },
  {
    manner: NF,
    place: DE,
    symbol: 'θ',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_dental_fricative',
  },
  {
    manner: NF,
    place: DE,
    symbol: 'ð',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_dental_fricative',
  },
  {
    manner: NF,
    place: AL,
    symbol: 'θ̠',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_alveolar_non-sibilant_fricative',
  },
  {
    manner: NF,
    place: AL,
    symbol: 'ð̠',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_alveolar_non-sibilant_fricative',
  },
  {
    manner: NF,
    place: PO,
    symbol: 'ɹ̠̊˔',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_postalveolar_non-sibilant_fricative',
  },
  {
    manner: NF,
    place: PO,
    symbol: 'ɹ̠˔',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_postalveolar_non-sibilant_fricative',
  },
  {
    manner: AP,
    place: AL,
    symbol: 'ɹ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_alveolar_approximant',
  },
  {
    manner: TF,
    place: AL,
    symbol: 'ɾ̥',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_alveolar_tap',
  },
  {
    manner: TF,
    place: AL,
    symbol: 'ɾ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Alveolar_tap',
  },
  {
    manner: TR,
    place: AL,
    symbol: 'r̥',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_alveolar_trill',
  },
  {
    manner: TR,
    place: AL,
    symbol: 'r',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_alveolar_trill',
  },
  {
    manner: LA,
    place: AL,
    symbol: 'tɬ',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_alveolar_lateral_affricate',
  },
  {
    manner: LA,
    place: AL,
    symbol: 'dɮ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_alveolar_lateral_affricate',
  },
  {
    manner: LF,
    place: AL,
    symbol: 'ɬ',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_alveolar_lateral_fricative',
  },
  {
    manner: LF,
    place: AL,
    symbol: 'ɮ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_alveolar_lateral_fricative',
  },
  {
    manner: LP,
    place: AL,
    symbol: 'l',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_alveolar_lateral_approximant',
  },
  {
    manner: LT,
    place: AL,
    symbol: 'ɺ̥',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_alveolar_lateral_flap',
  },
  {
    manner: LT,
    place: AL,
    symbol: 'ɺ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_alveolar_lateral_flap',
  },
  {
    manner: NA,
    place: RF,
    symbol: 'ɳ̊',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_retroflex_nasal',
  },
  {
    manner: NA,
    place: RF,
    symbol: 'ɳ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_retroflex_nasal',
  },
  {
    manner: PL,
    place: RF,
    symbol: 'ʈ',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_retroflex_plosive',
  },
  {
    manner: PL,
    place: RF,
    symbol: 'ɖ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_retroflex_plosive',
  },
  {
    manner: SA,
    place: RF,
    symbol: 'ʈʂ',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_retroflex_affricate',
  },
  {
    manner: SA,
    place: RF,
    symbol: 'ɖʐ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_retroflex_affricate',
  },
  {
    manner: SF,
    place: RF,
    symbol: 'ʂ',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_retroflex_fricative',
  },
  {
    manner: SF,
    place: RF,
    symbol: 'ʐ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_retroflex_fricative',
  },
  {
    manner: NF,
    place: RF,
    symbol: 'ɻ˔',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_retroflex_non-sibilant_fricative',
  },
  {
    manner: AP,
    place: RF,
    symbol: 'ɻ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_retroflex_approximant',
  },
  {
    manner: TF,
    place: RF,
    symbol: 'ɽ̊',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_retroflex_flap',
  },
  {
    manner: TF,
    place: RF,
    symbol: 'ɽ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_retroflex_flap',
  },
  {
    manner: TR,
    place: RF,
    symbol: 'ɽ̊r̥',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_retroflex_trill',
  },
  {
    manner: TR,
    place: RF,
    symbol: 'ɽr',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_retroflex_trill',
  },
  {
    manner: LA,
    place: RF,
    symbol: 'ʈɭ̊˔',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_retroflex_lateral_affricate',
  },
  {
    manner: LA,
    place: RF,
    symbol: 'ɖɭ˔',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_retroflex_lateral_affricate',
  },
  {
    manner: LF,
    place: RF,
    symbol: 'ɭ̊˔',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_retroflex_lateral_fricative',
  },
  {
    manner: LF,
    place: RF,
    symbol: 'ɭ˔',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiceless_retroflex_lateral_fricative',
  },
  {
    manner: LP,
    place: RF,
    symbol: 'ɭ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_retroflex_lateral_approximant',
  },
  {
    manner: LT,
    place: RF,
    symbol: 'ɭ̥̆',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_retroflex_lateral_flap',
  },
  {
    manner: LT,
    place: RF,
    symbol: 'ɭ̆',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_retroflex_lateral_flap',
  },
  {
    manner: PL,
    place: GL,
    symbol: 'ʔ',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Glottal_stop',
  },
  {
    manner: NS,
    place: GL,
    symbol: 'ʔh',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_glottal_affricate',
  },
  {
    manner: NF,
    place: GL,
    symbol: 'h',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_glottal_fricative',
  },
  {
    manner: NF,
    place: GL,
    symbol: 'ɦ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_glottal_fricative',
  },
  {
    manner: AP,
    place: GL,
    symbol: 'ʔ̞',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Creaky-voiced_glottal_approximant',
  },
  {
    manner: PL,
    place: PH,
    symbol: 'ʡ',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Epiglottal_plosive',
  },
  {
    manner: NS,
    place: PH,
    symbol: 'ʡʢ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_epiglottal_affricate',
  },
  {
    manner: NF,
    place: PH,
    symbol: 'ħ',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiced_pharyngeal_fricative',
  },
  {
    manner: NF,
    place: PH,
    symbol: 'ʕ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_pharyngeal_fricative',
  },
  {
    manner: TF,
    place: PH,
    symbol: 'ʡ̆',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_epiglottal_tap',
  },
  {
    manner: TR,
    place: PH,
    symbol: 'ʜ',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_epiglottal_trill',
  },
  {
    manner: TR,
    place: PH,
    symbol: 'ʢ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_epiglottal_trill',
  },
  {
    manner: LP,
    place: UV,
    symbol: 'ʟ̠',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_uvular_lateral_approximant',
  },
  {
    manner: TR,
    place: UV,
    symbol: 'ʀ̥',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_uvular_trill',
  },
  {
    manner: TR,
    place: UV,
    symbol: 'ʀ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_uvular_trill',
  },
  {
    manner: TF,
    place: UV,
    symbol: 'ɢ̆',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Uvular_tap_and_flap',
  },
  {
    manner: NF,
    place: UV,
    symbol: 'χ',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_uvular_fricative',
  },
  {
    manner: NF,
    place: UV,
    symbol: 'ʁ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_uvular_fricative',
  },
  {
    manner: NS,
    place: UV,
    symbol: 'qχ',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_uvular_affricate',
  },
  {
    manner: NS,
    place: UV,
    symbol: 'ɢʁ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_uvular_affricate',
  },
  {
    manner: NA,
    place: UV,
    symbol: 'ɴ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_uvular_nasal',
  },
  {
    manner: PL,
    place: UV,
    symbol: 'q',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_uvular_plosive',
  },
  {
    manner: PL,
    place: UV,
    symbol: 'ɢ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_uvular_plosive',
  },
  {
    manner: NA,
    place: VE,
    symbol: 'ŋ̊',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_velar_nasal',
  },
  {
    manner: NA,
    place: VE,
    symbol: 'ŋ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_velar_nasal',
  },
  {
    manner: PL,
    place: VE,
    symbol: 'k',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_velar_plosive',
  },
  {
    manner: PL,
    place: VE,
    symbol: 'ɡ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_velar_plosive',
  },
  {
    manner: NS,
    place: VE,
    symbol: 'kx',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_velar_affricate',
  },
  {
    manner: NS,
    place: VE,
    symbol: 'ɡɣ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_velar_affricate',
  },
  {
    manner: NF,
    place: VE,
    symbol: 'x',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_velar_fricative',
  },
  {
    manner: NF,
    place: VE,
    symbol: 'ɣ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_velar_fricative',
  },
  {
    manner: AP,
    place: VE,
    symbol: 'ɰ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_velar_approximant',
  },
  {
    manner: LA,
    place: VE,
    symbol: 'kʟ̝̊',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_velar_lateral_affricate',
  },
  {
    manner: LA,
    place: VE,
    symbol: 'ɡʟ̝',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_velar_lateral_affricate',
  },
  {
    manner: LF,
    place: VE,
    symbol: 'ʟ̝̊',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_velar_lateral_fricative',
  },
  {
    manner: LF,
    place: VE,
    symbol: 'ʟ̝',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_velar_lateral_fricative',
  },
  {
    manner: LP,
    place: VE,
    symbol: 'ʟ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_velar_lateral_approximant',
  },
  {
    manner: LT,
    place: VE,
    symbol: 'ʟ̆',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_velar_lateral_tap',
  },
  {
    manner: LP,
    place: PA,
    symbol: 'ʎ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_palatal_lateral_approximant',
  },
  {
    manner: LT,
    place: PA,
    symbol: 'ʎ̆',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_palatal_lateral_flap',
  },
  {
    manner: LF,
    place: PA,
    symbol: 'ʎ̝̊',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_palatal_lateral_fricative',
  },
  {
    manner: LF,
    place: PA,
    symbol: 'ʎ̝',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_palatal_lateral_fricative',
  },
  {
    manner: LA,
    place: PA,
    symbol: 'cʎ̥˔',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_palatal_lateral_affricate',
  },
  {
    manner: LA,
    place: PA,
    symbol: 'ɟʎ̝',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_palatal_lateral_affricate',
  },
  {
    manner: AP,
    place: PA,
    symbol: 'j',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_palatal_approximant',
  },
  {
    manner: NF,
    place: PA,
    symbol: 'ç',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_palatal_fricative',
  },
  {
    manner: NF,
    place: PA,
    symbol: 'ʝ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_palatal_fricative',
  },
  {
    manner: SF,
    place: PA,
    symbol: 'ɕ',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_alveolo-palatal_fricative',
  },
  {
    manner: SF,
    place: PA,
    symbol: 'ʑ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_alveolo-palatal_fricative',
  },
  {
    manner: NF,
    place: PA,
    symbol: 'cç',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_palatal_affricate',
  },
  {
    manner: NF,
    place: PA,
    symbol: 'ɟʝ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_palatal_affricate',
  },
  {
    manner: SA,
    place: PA,
    symbol: 'tɕ',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_alveolo-palatal_affricate',
  },
  {
    manner: SA,
    place: PA,
    symbol: 'dʑ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_alveolo-palatal_affricate',
  },
  {
    manner: PL,
    place: PA,
    symbol: 'c',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_palatal_plosive',
  },
  {
    manner: PL,
    place: PA,
    symbol: 'ɟ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_palatal_plosive',
  },
  {
    manner: NA,
    place: PA,
    symbol: 'ɲ̊',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_palatal_nasal',
  },
  {
    manner: NA,
    place: PA,
    symbol: 'ɲ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_palatal_nasal',
  },
  {
    manner: IM,
    place: BI,
    symbol: 'ƥ',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_bilabial_implosive',
  },
  {
    manner: IM,
    place: BI,
    symbol: 'ɓ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_bilabial_implosive',
  },
  {
    manner: IM,
    place: DE,
    symbol: 'ƭ̪',
    voiced: false,
    url: '',
  },
  {
    manner: IM,
    place: DE,
    symbol: 'ɗ̪',
    voiced: true,
    url: '',
  },
  {
    manner: IM,
    place: AL,
    symbol: 'ƭ',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiced_alveolar_implosive',
  },
  {
    manner: IM,
    place: AL,
    symbol: 'ɗ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiceless_alveolar_implosive',
  },
  {
    manner: IM,
    place: RF,
    symbol: 'ᶑ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_retroflex_implosive',
  },
  {
    manner: IM,
    place: PA,
    symbol: 'ƈ',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_palatal_implosive',
  },
  {
    manner: IM,
    place: PA,
    symbol: 'ʄ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_palatal_implosive',
  },
  {
    manner: IM,
    place: VE,
    symbol: 'ƙ',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_velar_implosive',
  },
  {
    manner: IM,
    place: VE,
    symbol: 'ɠ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_velar_implosive',
  },
  {
    manner: IM,
    place: UV,
    symbol: 'ʠ',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_uvular_implosive',
  },
  {
    manner: IM,
    place: UV,
    symbol: 'ʛ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_uvular_implosive',
  },
  {
    manner: IM,
    place: LV,
    symbol: 'ɠ͡ɓ',
    voiced: true,
    url: '',
  },
  {
    manner: IM,
    place: LV,
    symbol: 'ƙ͡ƥ',
    voiced: false,
    url: '',
  },
  {
    manner: NA,
    place: LV,
    symbol: 'ŋ͡m',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_labial%E2%80%93velar_nasal',
  },
  {
    manner: PL,
    place: LV,
    symbol: 'k͡p',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_labial-velar_plosive',
  },
  {
    manner: PL,
    place: LV,
    symbol: 'ɡ͡b',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_labial-velar_plosive',
  },
  {
    manner: AP,
    place: LV,
    symbol: 'w',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_labial-velar_approximant',
  },
  {
    manner: SF,
    place: LV,
    symbol: 'ʍ',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_labial-velar_fricative',
  },
  {
    manner: NS,
    place: PA,
    symbol: 'ɟʝ',
    voiced: true,
    url: 'https://en.wikipedia.org/wiki/Voiced_palatal_affricate',
  },
  {
    manner: NS,
    place: PA,
    symbol: 'cç',
    voiced: false,
    url: 'https://en.wikipedia.org/wiki/Voiceless_palatal_affricate',
  },
  {
    manner: LP,
    place: DE,
    symbol: 'l̪',
    voiced: true,
    url: '',
  },
  {
    manner: NA,
    place: DE,
    symbol: 'n̪',
    voiced: true,
    url: '',
  },
];

export const VOWELS = [
  {
    symbol: 'i',
    height: C,
    backness: F,
    roundedness: UR,
    url: 'https://en.wikipedia.org/wiki/Close_front_unrounded_vowel',
  },
  {
    symbol: 'y',
    height: C,
    backness: F,
    roundedness: R,
    url: 'https://en.wikipedia.org/wiki/Close_front_rounded_vowel',
  },
  {
    symbol: 'ɪ',
    height: NC,
    backness: NFR,
    roundedness: UR,
    url: 'https://en.wikipedia.org/wiki/Near-close_near-front_unrounded_vowel',
  },
  {
    symbol: 'ʏ',
    height: NC,
    backness: NFR,
    roundedness: R,
    url: 'https://en.wikipedia.org/wiki/Near-close_near-front_rounded_vowel',
  },
  {
    symbol: 'e',
    height: CM,
    backness: F,
    roundedness: UR,
    url: 'https://en.wikipedia.org/wiki/Close-mid_front_unrounded_vowel',
  },
  {
    symbol: 'ø',
    height: CM,
    backness: F,
    roundedness: R,
    url: 'https://en.wikipedia.org/wiki/Close-mid_front_rounded_vowel',
  },
  {
    symbol: 'e̞',
    height: M,
    backness: F,
    roundedness: UR,
    url: 'https://en.wikipedia.org/wiki/Mid_front_unrounded_vowel',
  },
  {
    symbol: 'ø̞',
    height: M,
    backness: F,
    roundedness: R,
    url: 'https://en.wikipedia.org/wiki/Mid_front_rounded_vowel',
  },
  {
    symbol: 'ɛ',
    height: OM,
    backness: F,
    roundedness: UR,
    url: 'https://en.wikipedia.org/wiki/Open-mid_front_unrounded_vowel',
  },
  {
    symbol: 'œ',
    height: OM,
    backness: F,
    roundedness: R,
    url: 'https://en.wikipedia.org/wiki/Open-mid_front_rounded_vowel',
  },
  {
    symbol: 'æ',
    height: NO,
    backness: F,
    roundedness: UR,
    url: 'https://en.wikipedia.org/wiki/Near-open_front_unrounded_vowel',
  },
  {
    symbol: 'a',
    height: O,
    backness: F,
    roundedness: UR,
    url: 'https://en.wikipedia.org/wiki/Open_front_unrounded_vowel',
  },
  {
    symbol: 'ɶ',
    height: O,
    backness: F,
    roundedness: R,
    url: 'https://en.wikipedia.org/wiki/Open_front_rounded_vowel',
  },
  {
    symbol: 'ɨ',
    height: C,
    backness: CE,
    roundedness: UR,
    url: 'https://en.wikipedia.org/wiki/Close_central_unrounded_vowel',
  },
  {
    symbol: 'ʉ',
    height: C,
    backness: CE,
    roundedness: R,
    url: 'https://en.wikipedia.org/wiki/Close_central_rounded_vowel',
  },
  {
    symbol: 'ɘ',
    height: CM,
    backness: CE,
    roundedness: UR,
    url: 'https://en.wikipedia.org/wiki/Close-mid_central_unrounded_vowel',
  },
  {
    symbol: 'ɵ',
    height: CM,
    backness: CE,
    roundedness: R,
    url: 'https://en.wikipedia.org/wiki/Close-mid_central_rounded_vowel',
  },
  {
    symbol: 'ə',
    height: M,
    backness: CE,
    roundedness: undefined,
    url: 'https://en.wikipedia.org/wiki/Mid_central_vowel',
  },
  {
    symbol: 'ɜ',
    height: OM,
    backness: CE,
    roundedness: UR,
    url: 'https://en.wikipedia.org/wiki/Open-mid_central_unrounded_vowel',
  },
  {
    symbol: 'ɞ',
    height: OM,
    backness: CE,
    roundedness: R,
    url: 'https://en.wikipedia.org/wiki/Open-mid_central_rounded_vowel',
  },
  {
    symbol: 'ɐ',
    height: NO,
    backness: CE,
    roundedness: undefined,
    url: 'https://en.wikipedia.org/wiki/Near-open_central_vowel',
  },
  {
    symbol: 'ä',
    height: O,
    backness: CE,
    roundedness: UR,
    url: 'https://en.wikipedia.org/wiki/Open_central_unrounded_vowel',
  },
  {
    symbol: 'ɯ',
    height: C,
    backness: B,
    roundedness: UR,
    url: 'https://en.wikipedia.org/wiki/Close_back_unrounded_vowel',
  },
  {
    symbol: 'u',
    height: C,
    backness: B,
    roundedness: R,
    url: 'https://en.wikipedia.org/wiki/Close_back_rounded_vowel',
  },
  {
    symbol: 'ʊ',
    height: NC,
    backness: NB,
    roundedness: R,
    url: 'https://en.wikipedia.org/wiki/Near-close_near-back_rounded_vowel',
  },
  {
    symbol: 'ɤ',
    height: CM,
    backness: B,
    roundedness: UR,
    url: 'https://en.wikipedia.org/wiki/Close-mid_back_unrounded_vowel',
  },
  {
    symbol: 'o',
    height: CM,
    backness: B,
    roundedness: R,
    url: 'https://en.wikipedia.org/wiki/Close-mid_back_rounded_vowel',
  },
  {
    symbol: 'ɤ̞',
    height: M,
    backness: B,
    roundedness: UR,
    url: 'https://en.wikipedia.org/wiki/Mid_back_unrounded_vowel',
  },
  {
    symbol: 'o̞',
    height: M,
    backness: B,
    roundedness: R,
    url: 'https://en.wikipedia.org/wiki/Mid_back_rounded_vowel',
  },
  {
    symbol: 'ʌ',
    height: OM,
    backness: B,
    roundedness: UR,
    url: 'https://en.wikipedia.org/wiki/Open-mid_back_unrounded_vowel',
  },
  {
    symbol: 'ɔ',
    height: OM,
    backness: B,
    roundedness: R,
    url: 'https://en.wikipedia.org/wiki/Open-mid_back_rounded_vowel',
  },
  {
    symbol: 'ɑ',
    height: O,
    backness: B,
    roundedness: UR,
    url: 'https://en.wikipedia.org/wiki/Open_back_unrounded_vowel',
  },
  {
    symbol: 'ɒ',
    height: O,
    backness: B,
    roundedness: R,
    url: 'https://en.wikipedia.org/wiki/Open_back_rounded_vowel',
  },
];
