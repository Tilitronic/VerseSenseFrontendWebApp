/**
 * PhonemeRegistry.ts
 *
 * Single source of truth for all IPA phonemes used by the UA, PL, and EN
 * phonetic engines. Entries are bootstrapped from the `ipa-symbols` npm
 * package (which covers the full IPA consonant/vowel chart), then extended
 * with:
 *   - palatalized consonant variants (UA/PL soft pairs)
 *   - sonorant flags (UA phonological rules)
 *   - alias keys for convenience (e.g. plain "tʃ" → library symbol "t̠ʃ")
 *
 * Usage:
 *   import { PhonemeRegistry } from './PhonemeRegistry';
 *   const p = PhonemeRegistry.get('p');   // Consonant
 *   const a = PhonemeRegistry.get('ɑ');   // Vowel
 *   const nSoft = PhonemeRegistry.get('nʲ'); // palatalized Consonant
 */

// The ipa-symbols library ships as CJS; Vite handles the interop.
import { CONSONANTS as IPA_CONSONANTS, VOWELS as IPA_VOWELS } from 'ipa-symbols/ipa_symbols.js';

import {
  Consonant,
  Vowel,
  type IpaSymbol,
  ConsonantPlace,
  ConsonantManner,
  Voicing,
  VowelHeight,
  VowelBackness,
  Roundedness,
  type ConsonantInit,
  type VowelInit,
} from './IpaSymbol';
import { getSimilarityBySymbol, type SimilarityOptions } from './similarity';

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers — bridge library string values to our typed enums
// ─────────────────────────────────────────────────────────────────────────────

function toPlace(raw: string): ConsonantPlace {
  const map: Record<string, ConsonantPlace> = {
    BILABIAL: ConsonantPlace.BILABIAL,
    LABIODENTAL: ConsonantPlace.LABIODENTAL,
    LINGUOLABIAL: ConsonantPlace.LINGUOLABIAL,
    DENTAL: ConsonantPlace.DENTAL,
    ALVEOLAR: ConsonantPlace.ALVEOLAR,
    POSTALVEOLAR: ConsonantPlace.POSTALVEOLAR,
    RETROFLEX: ConsonantPlace.RETROFLEX,
    PALATAL: ConsonantPlace.PALATAL,
    VELAR: ConsonantPlace.VELAR,
    LABIALVELAR: ConsonantPlace.LABIALVELAR,
    UVULAR: ConsonantPlace.UVULAR,
    'PHARYNGEAL/EPIGLOTTAL': ConsonantPlace.PHARYNGEAL,
    GLOTTAL: ConsonantPlace.GLOTTAL,
  };
  const result = map[raw];
  if (!result) throw new Error(`Unknown consonant place: "${raw}"`);
  return result;
}

function toManner(raw: string): ConsonantManner {
  const map: Record<string, ConsonantManner> = {
    NASAL: ConsonantManner.NASAL,
    PLOSIVE: ConsonantManner.PLOSIVE,
    IMPLOSIVE: ConsonantManner.IMPLOSIVE,
    'SIBILANT AFFRICATE': ConsonantManner.SIBILANT_AFFRICATE,
    'NON-SIBILANT AFFRICATE': ConsonantManner.NONSIBILANT_AFFRICATE,
    'SIBILANT FRICATIVE': ConsonantManner.SIBILANT_FRICATIVE,
    'NON-SIBILANT FRICATIVE': ConsonantManner.NONSIBILANT_FRICATIVE,
    APPROXIMANT: ConsonantManner.APPROXIMANT,
    'TAP/FLAP': ConsonantManner.TAP_FLAP,
    TRILL: ConsonantManner.TRILL,
    'LATERAL AFFRICATE': ConsonantManner.LATERAL_AFFRICATE,
    'LATERAL FRICATIVE': ConsonantManner.LATERAL_FRICATIVE,
    'LATERAL APPROXIMANT': ConsonantManner.LATERAL_APPROXIMANT,
    'LATERAL TAP/FLAP': ConsonantManner.LATERAL_TAP_FLAP,
  };
  const result = map[raw];
  if (!result) throw new Error(`Unknown consonant manner: "${raw}"`);
  return result;
}

function toHeight(raw: string): VowelHeight {
  const map: Record<string, VowelHeight> = {
    close: VowelHeight.CLOSE,
    'near-close': VowelHeight.NEAR_CLOSE,
    'close-mid': VowelHeight.CLOSE_MID,
    mid: VowelHeight.MID,
    'open-mid': VowelHeight.OPEN_MID,
    'near-open': VowelHeight.NEAR_OPEN,
    open: VowelHeight.OPEN,
  };
  const result = map[raw];
  if (!result) throw new Error(`Unknown vowel height: "${raw}"`);
  return result;
}

function toBackness(raw: string): VowelBackness {
  const map: Record<string, VowelBackness> = {
    front: VowelBackness.FRONT,
    'near-front': VowelBackness.NEAR_FRONT,
    central: VowelBackness.CENTRAL,
    'near-back': VowelBackness.NEAR_BACK,
    back: VowelBackness.BACK,
  };
  const result = map[raw];
  if (!result) throw new Error(`Unknown vowel backness: "${raw}"`);
  return result;
}

function toRoundedness(raw: string | undefined): Roundedness {
  if (raw === 'rounded') return Roundedness.ROUNDED;
  // "unrounded" or undefined (some library entries omit it for central vowels)
  return Roundedness.UNROUNDED;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sonorant set — consonants that are sonorants in the traditional UA/PL sense
// ─────────────────────────────────────────────────────────────────────────────

const SONORANT_SYMBOLS = new Set([
  'm',
  'n',
  'ŋ',
  'ɲ', // nasals
  'r',
  'l',
  'ʎ',
  'ɾ', // liquids
  'j',
  'w', // glides / approximants
  'v', // Ukrainian treats в as sonorant in some contexts
]);

// ─────────────────────────────────────────────────────────────────────────────
// Palatalized pairs — additional entries derived from base consonants
// Each entry maps  registryKey → base symbol to clone features from
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Palatalized consonant aliases.
 * Key   = the registry lookup key (e.g. "nʲ")
 * Value = the base symbol in the library (e.g. "n")
 *
 * We derive all features from the base symbol and set `palatalized = true`.
 * The ʲ is part of the key for lookups but is NOT the IPA symbol stored
 * on the object — use `consonant.displaySymbol` to get the rendered form.
 */
const PALATALIZED_PAIRS: Record<string, string> = {
  // Ukrainian soft consonants (м'які приголосні)
  nʲ: 'n', // нь
  lʲ: 'l', // ль
  tʲ: 't', // ть
  dʲ: 'd', // дь
  sʲ: 's', // сь
  zʲ: 'z', // зь
  tsʲ: 'ts', //ць
  dzʲ: 'dz', // дзь
  rʲ: 'r', // рь (rare)
  // Polish additional soft consonants
  pʲ: 'p', // pi
  bʲ: 'b', // bi
  mʲ: 'm', // mi
  fʲ: 'f', // fi
  vʲ: 'v', // wi
  kʲ: 'k', // ki
  ɡʲ: 'ɡ', // gi
  xʲ: 'x', // chi
};

/**
 * Alias keys — some engines use simplified IPA spellings that differ from
 * the multi-diacritic symbols the ipa-symbols library uses.
 * Key   = the alias (what engines write)
 * Value = the canonical library symbol
 */
const ALIASES: Record<string, string> = {
  tʃ: 't̠ʃ', // postalveolar voiceless affricate (Ukrainian ч, English ch)
  dʒ: 'd̠ʒ', // postalveolar voiced affricate (Ukrainian дж, English j)
};

// ─────────────────────────────────────────────────────────────────────────────
// Registry class
// ─────────────────────────────────────────────────────────────────────────────

class PhonemeRegistryClass {
  private readonly registry = new Map<string, IpaSymbol>();

  constructor() {
    this.loadFromLibrary();
    this.addPalatalized();
    this.addAliases();
  }

  // ── Bootstrap from ipa-symbols ──────────────────────────────────────────

  private loadFromLibrary(): void {
    for (const raw of IPA_CONSONANTS) {
      try {
        const init: ConsonantInit = {
          symbol: raw.symbol,
          wikiUrl: raw.url,
          place: toPlace(raw.place),
          manner: toManner(raw.manner),
          voicing: raw.voiced ? Voicing.VOICED : Voicing.VOICELESS,
          sonorant: SONORANT_SYMBOLS.has(raw.symbol),
        };
        this.registry.set(raw.symbol, new Consonant(init));
      } catch {
        // Skip exotic consonants with unmapped features
      }
    }

    for (const raw of IPA_VOWELS) {
      try {
        const init: VowelInit = {
          symbol: raw.symbol,
          wikiUrl: raw.url,
          height: toHeight(raw.height),
          backness: toBackness(raw.backness),
          roundedness: toRoundedness(raw.roundedness),
        };
        this.registry.set(raw.symbol, new Vowel(init));
      } catch {
        // Skip vowels with unmapped features
      }
    }
  }

  // ── Add palatalized variants ─────────────────────────────────────────────

  private addPalatalized(): void {
    for (const [palKey, baseSymbol] of Object.entries(PALATALIZED_PAIRS)) {
      const base = this.registry.get(baseSymbol);
      if (!base || !base.isConsonant()) {
        console.warn(`PhonemeRegistry: cannot palatalize "${baseSymbol}" — not found`);
        continue;
      }
      const palatal = new Consonant({
        symbol: base.symbol,
        wikiUrl: base.wikiUrl,
        place: base.place,
        manner: base.manner,
        voicing: base.voicing,
        sonorant: base.sonorant,
        palatalized: true,
      });
      this.registry.set(palKey, palatal);
    }
  }

  // ── Add alias keys ───────────────────────────────────────────────────────

  private addAliases(): void {
    for (const [alias, canonical] of Object.entries(ALIASES)) {
      const base = this.registry.get(canonical);
      if (!base) {
        console.warn(`PhonemeRegistry: alias target "${canonical}" not found`);
        continue;
      }
      // Store the alias pointing to the same object
      this.registry.set(alias, base);
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Look up a phoneme by its IPA symbol string.
   * Supports plain symbols ("p"), multi-char affricates ("tʃ", "dʒ"),
   * and palatalized keys ("nʲ", "lʲ").
   * Returns `undefined` for unknown symbols.
   */
  get(symbol: string): IpaSymbol | undefined {
    return this.registry.get(symbol);
  }

  /**
   * Like `get`, but throws if the symbol is not found.
   * Use when you are certain the symbol exists (e.g. in engine code).
   */
  getOrThrow(symbol: string): IpaSymbol {
    const phoneme = this.registry.get(symbol);
    if (!phoneme) throw new Error(`PhonemeRegistry: unknown symbol "${symbol}"`);
    return phoneme;
  }

  /** Returns true if the registry contains an entry for this symbol. */
  has(symbol: string): boolean {
    return this.registry.has(symbol);
  }

  /** All registered IPA symbols. */
  get symbols(): string[] {
    return [...this.registry.keys()];
  }

  /** All registered phoneme objects. */
  get all(): IpaSymbol[] {
    return [...this.registry.values()];
  }

  /** All consonant entries (excluding aliases that point to the same object). */
  get consonants(): Consonant[] {
    return [...new Set(this.registry.values())].filter((p): p is Consonant => p.isConsonant());
  }

  /** All vowel entries. */
  get vowels(): Vowel[] {
    return [...new Set(this.registry.values())].filter((p): p is Vowel => p.isVowel());
  }

  /** Debug: print registry size. */
  get size(): number {
    return this.registry.size;
  }

  /**
   * Convenience: compute phonetic similarity between two IPA symbol strings.
   *
   * @example
   * PhonemeRegistry.getSimilarity('p', 'b'); // ≈ 0.80
   * PhonemeRegistry.getSimilarity('s', 'ʃ'); // ≈ 0.65
   */
  getSimilarity(symbolA: string, symbolB: string, options?: SimilarityOptions): number {
    return getSimilarityBySymbol(symbolA, symbolB, (s) => this.registry.get(s), options);
  }
}

// Singleton — import this everywhere
export const PhonemeRegistry = new PhonemeRegistryClass();
