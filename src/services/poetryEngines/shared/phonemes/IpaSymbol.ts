/**
 * IpaSymbol.ts
 *
 * Class hierarchy for IPA phoneme representation.
 *
 * Data sourced from the `ipa-symbols` npm package (CONSONANTS / VOWELS arrays)
 * which provides place, manner, voicing, height, backness, and roundedness for
 * every standard IPA symbol. We extend those raw objects with:
 *  - a `palatalized` flag (needed for UA/PL soft consonant pairs)
 *  - a `sonorant` flag (needed for UA phonological rules)
 *  - typed enums instead of raw strings so TypeScript can enforce exhaustiveness
 *
 * Hierarchy:
 *   IpaSymbol                   ← abstract base: symbol + wikiUrl
 *     └─ Consonant              ← place, manner, voicing, palatalized, sonorant
 *     └─ Vowel                  ← height, backness, roundedness
 */

// ─────────────────────────────────────────────────────────────────────────────
// Enums — values are lowercase strings matching the ipa-symbols library where
//         possible so we can use them as lookup keys without transformation.
// ─────────────────────────────────────────────────────────────────────────────

export enum PhonemeType {
  CONSONANT = 'CONSONANT',
  VOWEL = 'VOWEL',
}

// --- Consonant features ---

/** Place of articulation — superset of all ipa-symbols library values */
export enum ConsonantPlace {
  BILABIAL = 'BILABIAL',
  LABIODENTAL = 'LABIODENTAL',
  LINGUOLABIAL = 'LINGUOLABIAL',
  DENTAL = 'DENTAL',
  ALVEOLAR = 'ALVEOLAR',
  POSTALVEOLAR = 'POSTALVEOLAR',
  RETROFLEX = 'RETROFLEX',
  PALATAL = 'PALATAL',
  VELAR = 'VELAR',
  LABIALVELAR = 'LABIALVELAR',
  UVULAR = 'UVULAR',
  PHARYNGEAL = 'PHARYNGEAL/EPIGLOTTAL',
  GLOTTAL = 'GLOTTAL',
}

/** Manner of articulation — superset of all ipa-symbols library values */
export enum ConsonantManner {
  NASAL = 'NASAL',
  PLOSIVE = 'PLOSIVE',
  IMPLOSIVE = 'IMPLOSIVE',
  SIBILANT_AFFRICATE = 'SIBILANT AFFRICATE',
  NONSIBILANT_AFFRICATE = 'NON-SIBILANT AFFRICATE',
  SIBILANT_FRICATIVE = 'SIBILANT FRICATIVE',
  NONSIBILANT_FRICATIVE = 'NON-SIBILANT FRICATIVE',
  APPROXIMANT = 'APPROXIMANT',
  TAP_FLAP = 'TAP/FLAP',
  TRILL = 'TRILL',
  LATERAL_AFFRICATE = 'LATERAL AFFRICATE',
  LATERAL_FRICATIVE = 'LATERAL FRICATIVE',
  LATERAL_APPROXIMANT = 'LATERAL APPROXIMANT',
  LATERAL_TAP_FLAP = 'LATERAL TAP/FLAP',
}

export enum Voicing {
  VOICED = 'voiced',
  VOICELESS = 'voiceless',
}

// --- Vowel features ---

/** Vowel height — matches ipa-symbols library string values exactly */
export enum VowelHeight {
  CLOSE = 'close',
  NEAR_CLOSE = 'near-close',
  CLOSE_MID = 'close-mid',
  MID = 'mid',
  OPEN_MID = 'open-mid',
  NEAR_OPEN = 'near-open',
  OPEN = 'open',
}

/** Vowel backness — matches ipa-symbols library string values exactly */
export enum VowelBackness {
  FRONT = 'front',
  NEAR_FRONT = 'near-front',
  CENTRAL = 'central',
  NEAR_BACK = 'near-back',
  BACK = 'back',
}

/** Lip rounding */
export enum Roundedness {
  ROUNDED = 'rounded',
  UNROUNDED = 'unrounded',
}

// ─────────────────────────────────────────────────────────────────────────────
// Base class
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Abstract base class for every IPA symbol.
 *
 * All concrete phoneme objects extend this class. The `type` discriminator
 * allows TypeScript to narrow between `Consonant` and `Vowel` via instanceof
 * or a type-guard on `phoneme.type`.
 */
export abstract class IpaSymbol {
  /** IPA character(s) representing this phoneme, e.g. "p", "t̠ʃ", "ɑ" */
  readonly symbol: string;

  /** Phoneme category — used as a discriminator for narrowing */
  abstract readonly type: PhonemeType;

  /** Wikipedia article URL provided by the ipa-symbols library */
  readonly wikiUrl: string;

  constructor(symbol: string, wikiUrl: string) {
    this.symbol = symbol;
    this.wikiUrl = wikiUrl;
  }

  /**
   * Human-readable label derived from the Wikipedia URL slug.
   * e.g. "https://…/Voiced_bilabial_nasal" → "Voiced bilabial nasal"
   */
  get label(): string {
    const slug = this.wikiUrl.split('/wiki/').at(1) ?? this.symbol;
    return slug.replace(/_/g, ' ');
  }

  /** Type-guard: narrows to Consonant */
  isConsonant(): this is Consonant {
    return this.type === PhonemeType.CONSONANT;
  }

  /** Type-guard: narrows to Vowel */
  isVowel(): this is Vowel {
    return this.type === PhonemeType.VOWEL;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Consonant
// ─────────────────────────────────────────────────────────────────────────────

export interface ConsonantInit {
  symbol: string;
  wikiUrl: string;
  place: ConsonantPlace;
  manner: ConsonantManner;
  voicing: Voicing;
  /**
   * Palatalization (м'якість).
   * When `true` this entry represents a soft/palatalized variant of the
   * consonant (e.g. Ukrainian "нь" → /nʲ/). The base symbol stays the same;
   * the superscript ʲ is appended when displaying.
   */
  palatalized?: boolean;
  /**
   * Sonorant classification (сонорний).
   * Sonorants (nasals, liquids, glides) behave differently in UA/PL
   * phonological rules (e.g. they don't participate in voicing assimilation).
   */
  sonorant?: boolean;
}

/**
 * A consonant phoneme.
 *
 * Features come from the IPA table:
 *   place   — where in the vocal tract it is formed
 *   manner  — how airflow is modified
 *   voicing — whether vocal cords vibrate
 *
 * Additional flags:
 *   palatalized — soft consonant variant (UA/PL)
 *   sonorant    — true for nasals, liquids, approximants
 */
export class Consonant extends IpaSymbol {
  override readonly type = PhonemeType.CONSONANT;

  readonly place: ConsonantPlace;
  readonly manner: ConsonantManner;
  readonly voicing: Voicing;
  readonly palatalized: boolean;
  readonly sonorant: boolean;

  constructor(init: ConsonantInit) {
    super(init.symbol, init.wikiUrl);
    this.place = init.place;
    this.manner = init.manner;
    this.voicing = init.voicing;
    this.palatalized = init.palatalized ?? false;
    this.sonorant = init.sonorant ?? false;
  }

  /**
   * Display symbol: appends superscript ʲ for palatalized variants.
   * Use this when rendering to UI, not for registry key lookups.
   */
  get displaySymbol(): string {
    return this.palatalized ? `${this.symbol}ʲ` : this.symbol;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Vowel
// ─────────────────────────────────────────────────────────────────────────────

export interface VowelInit {
  symbol: string;
  wikiUrl: string;
  height: VowelHeight;
  backness: VowelBackness;
  roundedness: Roundedness;
}

/**
 * A vowel phoneme.
 *
 * Features come from the IPA vowel chart:
 *   height      — tongue body position (close ↔ open)
 *   backness    — tongue body front/back position
 *   roundedness — lip rounding
 */
export class Vowel extends IpaSymbol {
  override readonly type = PhonemeType.VOWEL;

  readonly height: VowelHeight;
  readonly backness: VowelBackness;
  readonly roundedness: Roundedness;

  constructor(init: VowelInit) {
    super(init.symbol, init.wikiUrl);
    this.height = init.height;
    this.backness = init.backness;
    this.roundedness = init.roundedness;
  }
}
