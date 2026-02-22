/**
 * ipaColorMap.ts
 *
 * Psychoacoustic color coding for IPA phonemes.
 *
 * Grouping principle: sounds that feel/sound SIMILAR to a human ear share a
 * colour family, regardless of their formal place/manner category.  The goal
 * is that a poet scanning the grid immediately recognises "this poem is heavy
 * on hissing sibilants (lime), hushing postalveolars (teal), or deep velars
 * (violet)" without reading individual symbols.
 *
 * ── Consonant psychoacoustic families ────────────────────────────────────────
 *
 *  NASALS           m  n  ŋ  ɴ  ɱ       humming, warm resonance     → amber  42°
 *  LIQUIDS/GLIDES   l  r  ɾ  ɹ  j  w    flowing, melodic sonorants  → gold   60°
 *  LABIAL STOPS     p  b                 lip pops, sharp percussive  → red     0°
 *  CORONAL STOPS    t  d  (dental+alv)   tongue clicks               → orange 22°
 *  VELAR STOPS      k  g  ʔ (glottal)   deep / back-of-mouth thump  → indigo 252°
 *  LABIAL FRICS     f  v  ɸ  β           breath at lips              → coral  10°
 *  SIBILANTS        s  z  ts dz          hissing ("свист")           → lime   105°
 *  HUSHING          ʃ  ʒ  tʃ dʒ ɕ ʑ    shushing ("шиплячі")        → teal   172°
 *  DENTAL FRICS     θ  ð                 interdental ("th")          → olive   78°
 *  GUTTURAL FRICS   x  ɣ  χ  ʁ  ħ  ʕ   guttural, back fricatives   → violet 272°
 *  GLOTTAL BREATH   h                    breathy, aspirated          → rose   330°
 *  AFFRICATES       tʃ dʒ ts dz (→ see hushing/sibilant per group)
 *
 * Saturation: stops=88, affricates=78, fricatives=68, nasals=55, sonorants=44
 * Lightness:  voiced=63%, voiceless=53%  (vivid on dark background)
 *
 * ── Vowels ───────────────────────────────────────────────────────────────────
 *  Hue        ← backness:  front=210°(blue)  central=150°(green)  back=28°(orange)
 *  Saturation ← height:    close=88% … open=38%
 *  Lightness  ← 60% (uniform — vowels are all "open" sounding)
 */

import {
  CONSONANTS,
  VOWELS,
  type PlaceOfArticulation,
  type MannerOfArticulation,
  type VowelHeight,
  type VowelBackness,
} from 'src/services/poetryEngines/shared/ipaService/consts/ipa-symbols.const';

// ── Psychoacoustic groups ─────────────────────────────────────────────────────

type PsychoGroup =
  | 'nasal' // m n ŋ — humming resonance            → amber
  | 'liquid-glide' // l r ɾ ɹ j w — flowing sonorants      → gold
  | 'labial-stop' // p b — lip pop                        → red
  | 'coronal-stop' // t d — tongue click                   → orange
  | 'velar-stop' // k g q ʔ — deep thump                 → indigo
  | 'labial-fric' // f v ɸ β — breath at lips             → coral
  | 'sibilant' // s z ts dz — hissing                  → lime
  | 'hushing' // ʃ ʒ tʃ dʒ ɕ ʑ — shushing            → teal
  | 'dental-fric' // θ ð — interdental                    → olive
  | 'guttural-fric' // x ɣ χ ʁ ħ ʕ — guttural/back         → violet
  | 'glottal-breath' // h — aspirated breath                 → rose
  | 'other'; // anything unclassified                → neutral grey

/** HSL base values for each psychoacoustic group */
interface GroupColor {
  h: number;
  s: number;
}
const GROUP: Record<PsychoGroup, GroupColor> = {
  nasal: { h: 42, s: 72 }, // amber
  'liquid-glide': { h: 60, s: 58 }, // gold-green
  'labial-stop': { h: 0, s: 88 }, // red
  'coronal-stop': { h: 22, s: 88 }, // orange
  'velar-stop': { h: 252, s: 80 }, // indigo
  'labial-fric': { h: 10, s: 70 }, // coral/salmon
  sibilant: { h: 105, s: 78 }, // lime-green
  hushing: { h: 172, s: 72 }, // teal-cyan
  'dental-fric': { h: 78, s: 62 }, // olive
  'guttural-fric': { h: 272, s: 70 }, // violet
  'glottal-breath': { h: 330, s: 55 }, // rose-pink
  other: { h: 210, s: 35 }, // neutral grey-blue
};

function classify(place: PlaceOfArticulation, manner: MannerOfArticulation): PsychoGroup {
  // ── Nasals ────────────────────────────────────────────────────────────────
  if (manner === 'NASAL') return 'nasal';

  // ── Sonorants (liquids, glides, trills, taps, approximants) ───────────────
  if (
    manner === 'APPROXIMANT' ||
    manner === 'LATERAL APPROXIMANT' ||
    manner === 'TRILL' ||
    manner === 'TAP/FLAP' ||
    manner === 'LATERAL TAP/FLAP'
  )
    return 'liquid-glide';

  // ── Sibilant affricates: split by place into sibilant vs hushing ──────────
  if (manner === 'SIBILANT AFFRICATE') {
    return place === 'POSTALVEOLAR' || place === 'RETROFLEX' ? 'hushing' : 'sibilant';
  }

  // ── Sibilant fricatives: same split ───────────────────────────────────────
  if (manner === 'SIBILANT FRICATIVE') {
    return place === 'POSTALVEOLAR' || place === 'RETROFLEX' ? 'hushing' : 'sibilant';
  }

  // ── Non-sibilant fricatives ───────────────────────────────────────────────
  if (manner === 'NON-SIBILANT FRICATIVE' || manner === 'LATERAL FRICATIVE') {
    switch (place) {
      case 'BILABIAL':
      case 'LABIODENTAL':
        return 'labial-fric';
      case 'DENTAL':
        return 'dental-fric';
      case 'VELAR':
      case 'UVULAR':
      case 'PHARYNGEAL/EPIGLOTTAL':
        return 'guttural-fric';
      case 'GLOTTAL':
        return 'glottal-breath';
      default:
        // Alveolar/postalveolar non-sibilant fricatives are more hissing-adjacent
        return 'sibilant';
    }
  }

  // ── Lateral affricates → liquid-glide family ──────────────────────────────
  if (manner === 'LATERAL AFFRICATE') return 'liquid-glide';

  // ── Non-sibilant affricates: go with place ────────────────────────────────
  if (manner === 'NON-SIBILANT AFFRICATE') {
    switch (place) {
      case 'BILABIAL':
      case 'LABIODENTAL':
        return 'labial-stop';
      default:
        return 'coronal-stop';
    }
  }

  // ── Plosives / implosives ─────────────────────────────────────────────────
  if (manner === 'PLOSIVE' || manner === 'IMPLOSIVE') {
    switch (place) {
      case 'BILABIAL':
      case 'LABIODENTAL':
      case 'LINGUOLABIAL':
        return 'labial-stop';
      case 'DENTAL':
      case 'ALVEOLAR':
        return 'coronal-stop';
      case 'POSTALVEOLAR':
      case 'RETROFLEX':
      case 'PALATAL':
        return 'coronal-stop';
      case 'LABIALVELAR':
      case 'VELAR':
      case 'UVULAR':
        return 'velar-stop';
      case 'GLOTTAL':
        return 'velar-stop'; // ʔ — sounds deep/closed
      default:
        return 'coronal-stop';
    }
  }

  return 'other';
}

// ── Vowel mappings ────────────────────────────────────────────────────────────
const BACKNESS_HUE: Record<VowelBackness, number> = {
  front: 210, // blue  (clear, bright)
  'near-front': 188, // cyan-blue
  central: 150, // green (neutral)
  'near-back': 50, // yellow-green
  back: 28, // orange-red (dark, round)
};

const HEIGHT_SAT: Record<VowelHeight, number> = {
  close: 88,
  'near-close': 76,
  'close-mid': 64,
  mid: 54,
  'open-mid': 46,
  'near-open': 42,
  open: 38,
};

// ── Lookup table (built once, keyed by IPA symbol string) ────────────────────
type ColorEntry = { h: number; s: number; l: number };

function buildLookup(): Map<string, ColorEntry> {
  const map = new Map<string, ColorEntry>();

  for (const c of CONSONANTS) {
    const g = GROUP[classify(c.place, c.manner)];
    // Voiced variant is 10 points brighter — creates a natural voiced/voiceless pair
    const l = c.voiced ? 63 : 53;
    map.set(c.symbol, { h: g.h, s: g.s, l });
  }

  for (const v of VOWELS) {
    const h = BACKNESS_HUE[v.backness] ?? 160;
    const s = HEIGHT_SAT[v.height] ?? 60;
    // Rounded vowels slightly warmer/darker; unrounded brighter
    const l = v.roundedness === 'rounded' ? 56 : 63;
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
  const entry = LOOKUP.get(token) ?? LOOKUP.get(token[0] ?? '');
  if (!entry) return null;
  return `hsla(${entry.h}, ${entry.s}%, ${entry.l}%, ${alpha.toFixed(3)})`;
}

// ── Shape / width descriptor ──────────────────────────────────────────────────

/**
 * Visual style descriptor for a single IPA token ribbon.
 *
 * Properties encode independent phonetic features as visual dimensions:
 *  - `background`   → psychoacoustic group (color by place+manner family)
 *  - `borderRadius` → manner class (stops=sharp, fricatives=rounded, sonorants=pill)
 *  - `height`       → voicing (voiced=taller, voiceless=shorter)
 *  - `alignSelf`    → always 'center' (ribbon sits in the middle of its cell)
 */
export interface TokenVisual {
  background: string; // hsla color
  borderRadius: string; // shape: 0px | 3px | 6px | 999px
  height: string; // ribbon thickness: 54% | 70% | 82% | 92%
  alignSelf: 'center';
  // Required for Vue to accept this as StyleValue / CSSProperties
  [key: `--${string}`]: string | undefined;
}

// ── Manner → border-radius ────────────────────────────────────────────────────
// Plosives/affricates: sharp angular stop/burst.
// Fricatives: slightly rounded — continuous turbulent flow.
// Nasals/sonorants/approximants: fully round pill — smooth resonance.
// Vowels: dome — wide open oval (handled separately).

const MANNER_RADIUS: Record<MannerOfArticulation, string> = {
  PLOSIVE: '2px', // sharp percussive
  IMPLOSIVE: '2px', // same family
  'SIBILANT AFFRICATE': '4px', // stop+friction hybrid
  'NON-SIBILANT AFFRICATE': '4px',
  'LATERAL AFFRICATE': '6px',
  'SIBILANT FRICATIVE': '8px', // pure continuous friction
  'NON-SIBILANT FRICATIVE': '8px',
  'LATERAL FRICATIVE': '8px',
  NASAL: '999px', // humming resonance — fully round
  TRILL: '999px',
  'TAP/FLAP': '999px',
  APPROXIMANT: '999px',
  'LATERAL APPROXIMANT': '999px',
  'LATERAL TAP/FLAP': '999px',
};

// ── Manner → ribbon height ────────────────────────────────────────────────────
// Vowels dominate their cell, voiced consonants are mid-tall,
// voiceless consonants are shorter.  (Actual height applied below.)

// Per-manner height for VOICED consonants  (% of pp-cell height)
const MANNER_H_VOICED: Record<MannerOfArticulation, string> = {
  PLOSIVE: '76%',
  IMPLOSIVE: '72%',
  'SIBILANT AFFRICATE': '74%',
  'NON-SIBILANT AFFRICATE': '72%',
  'LATERAL AFFRICATE': '70%',
  'SIBILANT FRICATIVE': '68%',
  'NON-SIBILANT FRICATIVE': '66%',
  'LATERAL FRICATIVE': '66%',
  NASAL: '80%', // nasals fill more — resonant
  TRILL: '75%',
  'TAP/FLAP': '66%',
  APPROXIMANT: '78%',
  'LATERAL APPROXIMANT': '78%',
  'LATERAL TAP/FLAP': '64%',
};

// Voiceless: uniformly 14 pp shorter
const MANNER_H_VOICELESS: Record<MannerOfArticulation, string> = Object.fromEntries(
  (Object.keys(MANNER_H_VOICED) as MannerOfArticulation[]).map((k) => {
    const v = parseFloat(MANNER_H_VOICED[k] ?? '70%');
    return [k, `${v - 14}%`];
  }),
) as Record<MannerOfArticulation, string>;

// ── Build consonant shape lookup ──────────────────────────────────────────────
type ShapeEntry = { radius: string; height: string };

function buildShapeLookup(): Map<string, ShapeEntry> {
  const map = new Map<string, ShapeEntry>();
  for (const c of CONSONANTS) {
    map.set(c.symbol, {
      radius: MANNER_RADIUS[c.manner] ?? '4px',
      height: c.voiced
        ? (MANNER_H_VOICED[c.manner] ?? '70%')
        : (MANNER_H_VOICELESS[c.manner] ?? '56%'),
    });
  }
  return map;
}

const SHAPE_LOOKUP = buildShapeLookup();

/**
 * Returns a full `TokenVisual` style descriptor for the given IPA token.
 * Returns `null` if the token is not in the database (e.g. punctuation).
 * @param token  IPA symbol string (may be a digraph: tʃ, eɪ, iː …)
 * @param alpha  Opacity 0–1 for the background color (default 1)
 */
export function ipaTokenStyle(token: string, alpha = 1): TokenVisual | null {
  const colorEntry = LOOKUP.get(token) ?? LOOKUP.get(token[0] ?? '');
  if (!colorEntry) return null;

  const bg = `hsla(${colorEntry.h}, ${colorEntry.s}%, ${colorEntry.l}%, ${alpha.toFixed(3)})`;

  // ── Vowel ──
  const vowelCheck = VOWELS.find((v) => v.symbol === token || v.symbol === token[0]);
  if (vowelCheck) {
    return {
      background: bg,
      borderRadius: '999px 999px 4px 4px', // dome top — open oral cavity shape
      height: '90%',
      alignSelf: 'center',
    };
  }

  // ── Consonant ──
  const shape = SHAPE_LOOKUP.get(token) ?? SHAPE_LOOKUP.get(token[0] ?? '');
  return {
    background: bg,
    borderRadius: shape?.radius ?? '4px',
    height: shape?.height ?? '62%',
    alignSelf: 'center',
  };
}
