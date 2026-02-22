/**
 * uaTranscription.ts
 *
 * Ukrainian grapheme-to-IPA transcription service.
 *
 * Based on academic sources (Савченко 2014, Мойсієнко 2010, Тоцька 1997)
 * and ported from the Python UkrainianPhoneticTranscriber draft in the
 * VersaSenseBackend project.
 *
 * Rules implemented:
 * - Full Cyrillic→IPA consonant and vowel mapping
 * - Stressed vs. unstressed vowel allophones (е→еи, и→ие, о→оу before high vowel)
 * - Palatalized consonants via soft sign (ь → ʲ on preceding consonant)
 * - Iotated vowels (є, ї, ю, я) → j+vowel or palatal consonant+vowel
 * - Apostrophe → ʔ (glottal stop / hard separation marker)
 * - Digraph affricates: дж → dʒ, дз → dz
 * - Syllabification following Ukrainian phonological rules
 */

export interface UaSyllable {
  /** IPA string for this syllable */
  ipa: string;
  /** Whether this syllable is stressed */
  stressed: boolean;
  /** Whether this syllable ends on a vowel (open syllable) */
  isOpen: boolean;
}

// ── IPA vowel maps ────────────────────────────────────────────────────────────

/** Stressed vowel realizations */
const VOWEL_STRESSED: Record<string, string> = {
  'а': 'ɑ',
  'е': 'ɛ',
  'є': 'jɛ',
  'и': 'ɪ',
  'і': 'i',
  'ї': 'ji',
  'о': 'ɔ',
  'у': 'u',
  'ю': 'ju',
  'я': 'jɑ',
};

/** Unstressed vowel allophones (е→[еи], и→[ие], о stable unless before у/і) */
const VOWEL_UNSTRESSED: Record<string, string> = {
  'а': 'ɑ',   // stable
  'е': 'eɪ̯',  // pulls toward и: transcribed as diphthong approximation
  'є': 'je',
  'и': 'ɪe̞',  // pulls toward е
  'і': 'i',   // stable
  'ї': 'ji',
  'о': 'ɔ',   // stable (assimilation to у handled below)
  'у': 'u',   // stable
  'ю': 'ju',
  'я': 'jɑ',
};

/** Unstressed /о/ before a syllable containing stressed /у/ or /і/ */
const O_BEFORE_HIGH = 'o̝';  // narrows toward у

// ── Consonant map ─────────────────────────────────────────────────────────────

const CONSONANT_IPA: Record<string, string> = {
  'б': 'b',
  'в': 'ʋ',   // labiodental approximant (characteristic of Ukrainian)
  'г': 'ɦ',   // voiced glottal fricative (Ukrainian г ≠ Russian г)
  'ґ': 'ɡ',   // voiced velar plosive
  'д': 'd',
  'ж': 'ʒ',
  'з': 'z',
  'й': 'j',
  'к': 'k',
  'л': 'l',
  'м': 'm',
  'н': 'n',
  'п': 'p',
  'р': 'r',
  'с': 's',
  'т': 't',
  'ф': 'f',
  'х': 'x',
  'ц': 'ts',
  'ч': 'tʃ',
  'ш': 'ʃ',
  'щ': 'ʃtʃ',
  // Digraph affricates (handled as single tokens)
  'дж': 'dʒ',
  'дз': 'dz',
};

// ── Ukrainian vowel set (Cyrillic) ────────────────────────────────────────────

const UA_VOWELS = new Set(['а','е','є','и','і','ї','о','у','ю','я']);

// ── IPA vowel set (for syllable boundary / open-syllable detection) ───────────

const IPA_VOWEL_RE = /[ɑɛɪiɔuɐeɪoɨ]/;

// ── Core transcription ────────────────────────────────────────────────────────

interface Token {
  /** Cyrillic source character(s) */
  src: string;
  /** IPA output string */
  ipa: string;
  /** Is this token a vowel nucleus? */
  isVowel: boolean;
  /** 0-based vowel index within the word (set during processing) */
  vowelIdx: number;
}

function tokenize(word: string): Token[] {
  const chars = Array.from(word.toLowerCase());
  const tokens: Token[] = [];
  let vowelIdx = 0;

  let i = 0;
  while (i < chars.length) {
    const ch = chars[i]!;
    const next = chars[i + 1] ?? '';

    // Apostrophe / hard sign → glottal stop
    if (ch === "'" || ch === 'ʼ' || ch === '\u2019' || ch === '\u02BC') {
      tokens.push({ src: ch, ipa: 'ʔ', isVowel: false, vowelIdx: -1 });
      i++;
      continue;
    }

    // Soft sign — mark as palatalization placeholder (merged into previous consonant later)
    if (ch === 'ь') {
      tokens.push({ src: 'ь', ipa: 'ʲ', isVowel: false, vowelIdx: -1 });
      i++;
      continue;
    }

    // Digraphs дж / дз
    if ((ch === 'д') && (next === 'ж' || next === 'з')) {
      const digraph = ch + next;
      tokens.push({ src: digraph, ipa: CONSONANT_IPA[digraph]!, isVowel: false, vowelIdx: -1 });
      i += 2;
      continue;
    }

    // Vowel
    if (UA_VOWELS.has(ch)) {
      // IPA will be filled in during stress pass; store raw vowel key here
      tokens.push({ src: ch, ipa: ch, isVowel: true, vowelIdx: vowelIdx++ });
      i++;
      continue;
    }

    // Regular consonant
    const ipa = CONSONANT_IPA[ch];
    if (ipa !== undefined) {
      tokens.push({ src: ch, ipa, isVowel: false, vowelIdx: -1 });
    } else {
      // Unknown character — pass through
      tokens.push({ src: ch, ipa: ch, isVowel: false, vowelIdx: -1 });
    }
    i++;
  }

  return tokens;
}

/**
 * Determine whether the vowel at vowelIndex is followed (in any later syllable)
 * by a stressed high vowel (у or і), for the о→оу allophone rule.
 */
function nextStressedIsHigh(
  tokens: Token[],
  currentVowelIdx: number,
  stressedVowelIdx: number,
  stressedSrc: string,
): boolean {
  if (currentVowelIdx >= stressedVowelIdx) return false;
  return stressedSrc === 'у' || stressedSrc === 'ю' || stressedSrc === 'і' || stressedSrc === 'ї';
}

function applyVowelIPA(tokens: Token[], stressedVowelIdx: number): void {
  // Find what the stressed vowel actually is (for о assimilation)
  const stressedToken = tokens.find((t) => t.isVowel && t.vowelIdx === stressedVowelIdx);
  const stressedSrc = stressedToken?.src ?? '';

  for (const tok of tokens) {
    if (!tok.isVowel) continue;
    const isStressed = tok.vowelIdx === stressedVowelIdx;

    if (isStressed) {
      tok.ipa = VOWEL_STRESSED[tok.src] ?? tok.src;
    } else {
      // /о/ assimilation: unstressed о before stressed у/і → о̝
      if (tok.src === 'о' && nextStressedIsHigh(tokens, tok.vowelIdx, stressedVowelIdx, stressedSrc)) {
        tok.ipa = O_BEFORE_HIGH;
      } else {
        tok.ipa = VOWEL_UNSTRESSED[tok.src] ?? tok.src;
      }
    }
  }
}

/** Merge ь (soft sign) into the preceding consonant as ʲ */
function mergeSoftSign(tokens: Token[]): Token[] {
  const result: Token[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i]!.src === 'ь' && result.length > 0) {
      // Append ʲ to previous token's IPA
      result[result.length - 1]!.ipa += 'ʲ';
    } else {
      result.push(tokens[i]!);
    }
  }
  return result;
}

// ── Syllabification ───────────────────────────────────────────────────────────

/**
 * Split the flat IPA string into syllables.
 * Strategy: one vowel nucleus per syllable.
 * Single consonant between vowels → onset of next syllable.
 * Cluster → first consonant is coda of previous, rest are onset of next.
 */
function syllabifyIPA(ipa: string, stressedVowelIdx: number): UaSyllable[] {
  if (!ipa) return [];

  // Find vowel nucleus positions in the IPA string
  // We'll work character-by-character tracking vowel nuclei
  // Simple approach: split into segments around vowel runs
  type Seg = { text: string; isVowel: boolean };
  const segments: Seg[] = [];

  let j = 0;
  while (j < ipa.length) {
    // Try vowel run first
    let vrun = '';
    while (j < ipa.length && IPA_VOWEL_RE.test(ipa[j]!)) {
      vrun += ipa[j++];
    }
    if (vrun) {
      segments.push({ text: vrun, isVowel: true });
      continue;
    }
    // Consonant run
    let crun = '';
    while (j < ipa.length && !IPA_VOWEL_RE.test(ipa[j]!)) {
      crun += ipa[j++];
    }
    if (crun) segments.push({ text: crun, isVowel: false });
  }

  if (segments.length === 0) return [{ ipa, stressed: stressedVowelIdx === 0, isOpen: false }];

  // Group into syllables: each syllable = onset-consonants + one vowel nucleus + optional coda
  // We'll do it by collecting runs
  const sylParts: string[] = [];
  let current = '';

  for (let si = 0; si < segments.length; si++) {
    const seg = segments[si]!;

    if (!seg.isVowel) {
      // Consonant cluster between syllables
      const prevHasVowel = current.length > 0 && IPA_VOWEL_RE.test(current);
      const nextHasVowel = segments.slice(si + 1).some((s) => s.isVowel);

      if (prevHasVowel && nextHasVowel) {
        // Split: single → onset of next; cluster → 1 coda + rest onset
        if (seg.text.length === 1) {
          // Single consonant: onset of next syllable
          sylParts.push(current);
          current = seg.text;
        } else {
          // Cluster: first char is coda, rest are onset of next
          current += seg.text[0];
          sylParts.push(current);
          current = seg.text.slice(1);
        }
      } else {
        current += seg.text;
      }
    } else {
      current += seg.text;
    }
  }
  if (current) sylParts.push(current);

  if (sylParts.length === 0) return [{ ipa, stressed: true, isOpen: false }];

  // Assign stress: stressedVowelIdx is 0-based index of the stressed vowel.
  // Count vowels across syllable parts to find which part contains it.
  let vCount = 0;
  return sylParts.map((part) => {
    const vowelsInPart = Array.from(part).filter((c) => IPA_VOWEL_RE.test(c)).length;
    const startVowelIdx = vCount;
    vCount += vowelsInPart;
    const stressed = stressedVowelIdx >= startVowelIdx && stressedVowelIdx < vCount;
    const lastChar = part[part.length - 1] ?? '';
    const isOpen = IPA_VOWEL_RE.test(lastChar);
    return { ipa: part, stressed, isOpen };
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Transcribe a Ukrainian word into IPA syllables.
 *
 * @param word        - Ukrainian word in Cyrillic (any case)
 * @param stressIndex - 0-based index of the STRESSED VOWEL in the word
 */
export function transcribeUkrainian(word: string, stressIndex: number): UaSyllable[] {
  if (!word) return [];

  // 1. Tokenize into phoneme tokens
  let tokens = tokenize(word);

  // 2. Apply vowel IPA based on stress position
  applyVowelIPA(tokens, stressIndex);

  // 3. Merge soft-sign palatalization into preceding consonant
  tokens = mergeSoftSign(tokens);

  // 4. Build flat IPA string
  const flatIPA = tokens.map((t) => t.ipa).join('');

  // 5. Count total vowels (for syllabification context)
  const totalVowels = tokens.filter((t) => t.isVowel).length;
  if (totalVowels === 0) {
    return [{ ipa: flatIPA || word, stressed: false, isOpen: false }];
  }

  // 6. Syllabify
  const syllables = syllabifyIPA(flatIPA, stressIndex);

  return syllables.length > 0
    ? syllables
    : [{ ipa: flatIPA, stressed: true, isOpen: false }];
}
