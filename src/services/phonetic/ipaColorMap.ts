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
 *  TRILLS / TAPS    r  ɾ  ʀ             vibrating, rolling          → copper 28°
 *  LATERALS         l  ɬ  ɭ             lateral flow                → gold   55°
 *  GLIDES           j  w  ɹ  ɰ          semi-vowels (vowel-bridge)  → cyan  195°
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
  | 'nasal' // m n ŋ — humming resonance                → amber  42°
  | 'trill' // r ɾ ʀ — vibrating/rolling trill/tap      → copper 28°
  | 'lateral' // l ɬ ɭ — lateral sonorant                 → gold   55°
  | 'glide' // j w ɹ — semi-vowel / vowel-bridge        → cyan  195°
  | 'labial-stop' // p b — lip pop                            → red     0°
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
  nasal: { h: 42, s: 72 }, // amber          — humming resonance
  trill: { h: 28, s: 80 }, // copper-bronze  — vibrating roll
  lateral: { h: 55, s: 62 }, // warm gold      — lateral flow
  glide: { h: 195, s: 45 }, // cool cyan      — semi-vowel bridge
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

  // ── Sonorants: split by acoustic character ──────────────────────────────
  // Trills and taps: r, ɾ — vibrating/rolling; phonetically energetic
  if (manner === 'TRILL' || manner === 'TAP/FLAP') return 'trill';
  // Lateral approximants and taps: l — smooth lateral flow
  if (manner === 'LATERAL APPROXIMANT' || manner === 'LATERAL TAP/FLAP') return 'lateral';
  // Central approximants: j, w, ɹ — semi-vowels / vowel-like glides
  if (manner === 'APPROXIMANT') return 'glide';

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

  // ── Lateral affricates → lateral family (same acoustic quality as l) ─────
  if (manner === 'LATERAL AFFRICATE') return 'lateral';

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

// ── Legend / annotation data exports ─────────────────────────────────────────

export interface PsychoGroupInfo {
  id: string;
  /** Ukrainian name for the group */
  labelUa: string;
  /** Short description in Ukrainian */
  descriptionUa: string;
  /** English name for the group */
  labelEn: string;
  /** Short description in English */
  descriptionEn: string;
  /** Representative CSS hsl color (voiced variant) */
  cssColor: string;
  /** Example IPA symbols */
  examplesIpa: string[];
}

/** All psychoacoustic consonant groups with colors, for building legends. */
export const PSYCHO_GROUP_INFO: readonly PsychoGroupInfo[] = [
  {
    id: 'nasal',
    labelUa: 'Носові',
    descriptionUa: 'м, н, нь — гудіння, резонанс',
    labelEn: 'Nasals',
    descriptionEn: 'm, n — humming, resonance',
    cssColor: `hsl(42,72%,63%)`,
    examplesIpa: ['m', 'n', 'ŋ'],
  },
  {
    id: 'trill',
    labelUa: 'Дрижачі (вібранти)',
    descriptionUa: 'р, рь — вібруючий рокіт',
    labelEn: 'Trills',
    descriptionEn: 'r — vibrating rumble',
    cssColor: `hsl(28,80%,56%)`,
    examplesIpa: ['r', 'ɾ'],
  },
  {
    id: 'lateral',
    labelUa: 'Бокові (латеральні)',
    descriptionUa: 'л, ль — плавний бічний сонорний',
    labelEn: 'Laterals',
    descriptionEn: 'l — smooth lateral sonorant',
    cssColor: `hsl(55,62%,52%)`,
    examplesIpa: ['l'],
  },
  {
    id: 'glide',
    labelUa: 'Ковзні (глайди)',
    descriptionUa: 'й, в — напівголосні, перехідні',
    labelEn: 'Glides',
    descriptionEn: 'j, w — semivowels, transitions',
    cssColor: `hsl(195,45%,58%)`,
    examplesIpa: ['j', 'w'],
  },
  {
    id: 'labial-stop',
    labelUa: 'Губні зупинні',
    descriptionUa: 'п, б — губний вибух',
    labelEn: 'Labial stops',
    descriptionEn: 'p, b — labial burst',
    cssColor: `hsl(0,88%,63%)`,
    examplesIpa: ['p', 'b'],
  },
  {
    id: 'coronal-stop',
    labelUa: 'Зубні зупинні',
    descriptionUa: 'т, д — клацання язика',
    labelEn: 'Coronal stops',
    descriptionEn: 't, d — tongue tap',
    cssColor: `hsl(22,88%,63%)`,
    examplesIpa: ['t', 'd'],
  },
  {
    id: 'velar-stop',
    labelUa: 'Задньоротові зупинні',
    descriptionUa: 'к, ґ — глибокий удар',
    labelEn: 'Velar stops',
    descriptionEn: 'k, g — deep back burst',
    cssColor: `hsl(252,80%,68%)`,
    examplesIpa: ['k', 'g'],
  },
  {
    id: 'labial-fric',
    labelUa: 'Губні фрикативні',
    descriptionUa: 'ф, в — подих губами',
    labelEn: 'Labial fricatives',
    descriptionEn: 'f, v — lip friction',
    cssColor: `hsl(10,70%,63%)`,
    examplesIpa: ['f', 'v'],
  },
  {
    id: 'sibilant',
    labelUa: 'Свистячі',
    descriptionUa: 'с, з, ц, дз — свист',
    labelEn: 'Sibilants',
    descriptionEn: 's, z, ts — hissing whistle',
    cssColor: `hsl(105,78%,52%)`,
    examplesIpa: ['s', 'z', 'ts'],
  },
  {
    id: 'hushing',
    labelUa: 'Шиплячі',
    descriptionUa: 'ш, ж, ч, дж — шипіння',
    labelEn: 'Hushing sibilants',
    descriptionEn: 'ʃ, ʒ, tʃ — slushing hiss',
    cssColor: `hsl(172,72%,52%)`,
    examplesIpa: ['ʃ', 'ʒ', 'tʃ'],
  },
  {
    id: 'guttural-fric',
    labelUa: 'Гортанні / задні',
    descriptionUa: 'х, г — горловий фрикатив',
    labelEn: 'Velars / gutturals',
    descriptionEn: 'x, ɣ — guttural fricative',
    cssColor: `hsl(272,70%,63%)`,
    examplesIpa: ['x', 'ɣ', 'χ'],
  },
  {
    id: 'glottal-breath',
    labelUa: 'Гортанний видих',
    descriptionUa: 'h — аспірований подих',
    labelEn: 'Glottal / aspiration',
    descriptionEn: 'h — aspirated breath',
    cssColor: `hsl(330,55%,63%)`,
    examplesIpa: ['h'],
  },
] as const;

export interface VowelGroupInfo {
  labelUa: string;
  descriptionUa: string;
  labelEn: string;
  descriptionEn: string;
  cssColor: string;
  examplesIpa: string[];
}

/** Vowel groups by backness, for legends. */
export const VOWEL_GROUP_INFO: readonly VowelGroupInfo[] = [
  {
    labelUa: 'Голосні передні',
    descriptionUa: 'і, е, и — передній ряд',
    labelEn: 'Front vowels',
    descriptionEn: 'i, e — front row',
    cssColor: `hsl(210,88%,60%)`,
    examplesIpa: ['i', 'e', 'ɪ'],
  },
  {
    labelUa: 'Голосні центральні',
    descriptionUa: 'ə, ɛ — нейтральні',
    labelEn: 'Central vowels',
    descriptionEn: 'ə, ɛ — neutral',
    cssColor: `hsl(150,64%,52%)`,
    examplesIpa: ['ə', 'ɛ'],
  },
  {
    labelUa: 'Голосні задні',
    descriptionUa: 'а, о, у — задній ряд',
    labelEn: 'Back vowels',
    descriptionEn: 'a, o, u — back row',
    cssColor: `hsl(28,64%,58%)`,
    examplesIpa: ['a', 'o', 'u'],
  },
] as const;
