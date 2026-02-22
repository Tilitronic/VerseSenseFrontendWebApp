/**
 * ipaColorMap.ts
 *
 * Deterministic HSL color derived purely from phonetic features of an IPA symbol.
 * Returns null if the symbol is not found in the IPA database (unknown token).
 *
 * Color encoding rationale:
 *  Consonants
 *    Hue        ← place of articulation (front-of-mouth = warm, back = cool)
 *    Saturation ← manner of articulation (stops=100%, fricatives=70%, others=50%)
 *    Lightness  ← voiced=38%, voiceless=30%   (dark enough on white; distinct)
 *
 *  Vowels
 *    Hue        ← backness (front=blue-green, central=yellow, back=orange-red)
 *    Saturation ← height   (close=95%, near-close=80%, close-mid=65%, ..., open=40%)
 *    Lightness  ← roundedness (unrounded=35%, rounded=28%)
 */

import {
  CONSONANTS,
  VOWELS,
  type PlaceOfArticulation,
  type MannerOfArticulation,
  type VowelHeight,
  type VowelBackness,
} from 'src/services/poetryEngines/shared/ipaService/consts/ipa-symbols.const';

// ── Place → hue (degrees) ────────────────────────────────────────────────────
const PLACE_HUE: Record<PlaceOfArticulation, number> = {
  BILABIAL:              0,    // red
  LABIODENTAL:           18,   // red-orange
  LINGUOLABIAL:          30,   // orange
  DENTAL:                45,   // yellow-orange
  ALVEOLAR:              65,   // yellow-green
  POSTALVEOLAR:          100,  // green
  RETROFLEX:             140,  // teal-green
  PALATAL:               180,  // cyan
  LABIALVELAR:           200,  // sky blue
  VELAR:                 220,  // blue
  UVULAR:                255,  // blue-violet
  'PHARYNGEAL/EPIGLOTTAL': 285, // violet
  GLOTTAL:               310,  // magenta
};

// ── Manner → saturation (%) ───────────────────────────────────────────────────
const MANNER_SAT: Record<MannerOfArticulation, number> = {
  PLOSIVE:               95,
  IMPLOSIVE:             88,
  'SIBILANT AFFRICATE':  82,
  'NON-SIBILANT AFFRICATE': 76,
  'SIBILANT FRICATIVE':  70,
  'NON-SIBILANT FRICATIVE': 62,
  NASAL:                 55,
  TRILL:                 50,
  'TAP/FLAP':            46,
  APPROXIMANT:           40,
  'LATERAL AFFRICATE':   72,
  'LATERAL FRICATIVE':   60,
  'LATERAL APPROXIMANT': 42,
  'LATERAL TAP/FLAP':    38,
};

// ── Vowel backness → hue ──────────────────────────────────────────────────────
const BACKNESS_HUE: Record<VowelBackness, number> = {
  front:        200,  // sky blue
  'near-front': 175,  // cyan
  central:      145,  // green
  'near-back':  55,   // yellow
  back:         25,   // orange
};

// ── Vowel height → saturation ─────────────────────────────────────────────────
const HEIGHT_SAT: Record<VowelHeight, number> = {
  close:          90,
  'near-close':   78,
  'close-mid':    66,
  mid:            56,
  'open-mid':     48,
  'near-open':    42,
  open:           36,
};

// ── Lookup table (built once, keyed by symbol string) ────────────────────────
type ColorEntry = { h: number; s: number; l: number };

function buildLookup(): Map<string, ColorEntry> {
  const map = new Map<string, ColorEntry>();

  for (const c of CONSONANTS) {
    const h = PLACE_HUE[c.place] ?? 0;
    const s = MANNER_SAT[c.manner] ?? 60;
    // Lightness: vivid ribbon — voiced slightly brighter
    const l = c.voiced ? 62 : 55;
    map.set(c.symbol, { h, s, l });
  }

  for (const v of VOWELS) {
    const h = BACKNESS_HUE[v.backness] ?? 160;
    const s = HEIGHT_SAT[v.height] ?? 60;
    const l = v.roundedness === 'rounded' ? 55 : 62;
    map.set(v.symbol, { h, s, l });
  }

  return map;
}

const LOOKUP = buildLookup();

/**
 * Returns an `hsla(h, s%, l%, alpha)` CSS color for the given IPA token,
 * or null if the token is not in the IPA database.
 * @param token   IPA symbol string
 * @param alpha   Opacity 0–1 (default 1)
 */
export function ipaTokenColor(token: string, alpha = 1): string | null {
  // Try exact match first, then first character (covers modifiers like ɪ̯)
  const entry = LOOKUP.get(token) ?? LOOKUP.get(token[0] ?? '');
  if (!entry) return null;
  return `hsla(${entry.h}, ${entry.s}%, ${entry.l}%, ${alpha.toFixed(3)})`;
}
