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
  'tʃ',
  'dʒ',
  'tɕ',
  'dʑ',
  'tʂ',
  'dʐ',
  'ts',
  'dz',
  // Nasalised vowels (combining tilde ̃ U+0303 attached)
  'ɔ̃',
  'ɛ̃',
  'ã',
  'õ',
  'ũ',
  // Long vowels with ː
  'iː',
  'uː',
  'aː',
  'eː',
  'oː',
  'ɑː',
  'ɔː',
  'ɜː',
  // Diphthongs used by EN engine
  'eɪ',
  'aɪ',
  'ɔɪ',
  'aʊ',
  'oʊ',
  'ɪə',
  'eə',
  'ʊə',
  // Palatalization marker attached to consonant
  'nʲ',
  'lʲ',
  'rʲ',
  'sʲ',
  'zʲ',
  'tʲ',
  'dʲ',
  // English r-colored vowels
  'ɚ',
  'ɝ',
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
      const ch = ipa[i]!;
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

  return tokens.filter((t) => t.trim().length > 0 && isIpaToken(t));
}

/** Unicode combining diacritics range */
function isCombiningDiacritic(code: number): boolean {
  return (
    (code >= 0x0300 && code <= 0x036f) || // Combining Diacritical Marks
    (code >= 0x1dc0 && code <= 0x1dff) || // Combining Diacritical Marks Supplement
    (code >= 0x20d0 && code <= 0x20ff)
  ); // Combining Diacritical Marks for Symbols
}
function isIpaToken(t: string): boolean {
  if (DIGRAPH_SET.has(t)) return true;
  // Check the base character (first code point)
  const base = t.charCodeAt(0);
  // Reject plain printable ASCII outside the IPA subset (0x20–0x7E)
  if (base >= 0x20 && base <= 0x7e) {
    // Only allow lowercase a–z that are genuine IPA base letters
    // and IPA-use ASCII: ɪ-like letters don't fall here, so just allow a-z
    return base >= 0x61 && base <= 0x7a; // a–z
  }
  // IPA Extensions: ɐ–ɿ  U+0250–U+02AF
  if (base >= 0x0250 && base <= 0x02af) return true;
  // Spacing Modifier Letters: ʰ ʲ ʷ etc  U+02B0–U+02FF
  if (base >= 0x02b0 && base <= 0x02ff) return true;
  // Phonetic Extensions  U+1D00–U+1DBF
  if (base >= 0x1d00 && base <= 0x1dbf) return true;
  // Latin Extended Additional  U+1E00–U+1EFF (rare but used in some IPA)
  if (base >= 0x1e00 && base <= 0x1eff) return true;
  // Latin-1 Supplement letters used in IPA: æ ø ð þ etc  U+00C0–U+00FF
  if (base >= 0x00c0 && base <= 0x00ff) return true;
  // Greek letters occasionally used: β θ χ  U+0370–U+03FF
  if (base >= 0x0370 && base <= 0x03ff) return true;
  return false;
}
