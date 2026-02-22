/**
 * ipaTokenizer.ts
 *
 * Splits an IPA string into an ordered list of discrete sound tokens.
 * Each token represents exactly ONE phoneme/sound unit for grid display.
 *
 * Examples:
 *   "tʃa"  → ["tʃ", "a"]
 *   "strɛs" → ["s", "t", "r", "ɛ", "s"]
 *   "ɔ̃"    → ["ɔ̃"]   (nasal vowel is one token)
 *   "dʑi"  → ["dʑ", "i"]
 */

/**
 * IPA multi-character ligatures that represent a SINGLE sound.
 * Ordered longest-first so the greedy scan picks the right one.
 */
const DIGRAPHS: string[] = [
  // Affricates (must precede their component chars)
  'tʃ', 'dʒ', 'tɕ', 'dʑ', 'tʂ', 'dʐ', 'ts', 'dz',
  // Nasalised vowels (combining tilde ̃ U+0303 attached)
  'ɔ̃', 'ɛ̃', 'ã', 'õ', 'ũ',
  // Long vowels with ː
  'iː', 'uː', 'aː', 'eː', 'oː', 'ɑː', 'ɔː', 'ɜː',
  // Diphthongs used by EN engine
  'eɪ', 'aɪ', 'ɔɪ', 'aʊ', 'oʊ', 'ɪə', 'eə', 'ʊə',
  // Palatalization marker attached to consonant
  'nʲ', 'lʲ', 'rʲ', 'sʲ', 'zʲ', 'tʲ', 'dʲ',
  // English r-colored vowels
  'ɚ', 'ɝ',
];

// Build a prefix trie map for fast greedy matching
const DIGRAPH_SET = new Set(DIGRAPHS);

/**
 * Split an IPA string into an array of sound tokens.
 * Each element is one phoneme / sound unit (may be 1–3 chars).
 */
export function tokenizeIPA(ipa: string): string[] {
  const tokens: string[] = [];
  let i = 0;

  while (i < ipa.length) {
    let matched = false;

    // Try longest digraphs first (up to 3 chars)
    for (let len = 3; len >= 2; len--) {
      const candidate = ipa.slice(i, i + len);
      if (DIGRAPH_SET.has(candidate)) {
        tokens.push(candidate);
        i += len;
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Check for combining diacritic on next char (e.g. ɔ + ̃)
      const ch   = ipa[i]!;
      const next = ipa[i + 1];
      if (next && isCombiningDiacritic(next.charCodeAt(0))) {
        tokens.push(ch + next);
        i += 2;
      } else {
        tokens.push(ch);
        i++;
      }
    }
  }

  return tokens.filter((t) => t.trim().length > 0);
}

/** Unicode combining diacritics range */
function isCombiningDiacritic(code: number): boolean {
  return (code >= 0x0300 && code <= 0x036F) || // Combining Diacritical Marks
         (code >= 0x1DC0 && code <= 0x1DFF) || // Combining Diacritical Marks Supplement
         (code >= 0x20D0 && code <= 0x20FF);   // Combining Diacritical Marks for Symbols
}
