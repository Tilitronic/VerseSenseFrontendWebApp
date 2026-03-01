/**
 * geminatePass.ts — Pass 1.5: Merge geminate (doubled) consonants
 *
 * Ukrainian has phonemically long (geminate) consonants, primarily at
 * morpheme boundaries. When two identical consonant graphemes appear
 * adjacent, the tokenizer produces two separate PhoneticToken objects.
 * This pass merges them into a single token with the length diacritic [ː].
 *
 * Examples:
 *   життя  → ʒɪtːɑ   (тт → tː)
 *   зілля  → zʲilːɑ  (лл → lː)
 *   ніччю  → nʲitʃːu (чч → tʃː)
 *   волосся → ʋɔlɔsːɑ (сс → sː)
 *   стаття → stɑtːɑ  (тт → tː)
 *   Запоріжжя → ... ʒːɑ (жж → ʒː)
 *   піддашшя → ... (дд → dː, шш → ʃː)
 *
 * Rules:
 * 1. Two adjacent consonant tokens with the SAME base IPA → merge into one,
 *    appending ː to the IPA.
 * 2. The merged token inherits all properties from the first token.
 * 3. The source field concatenates both source graphemes.
 * 4. If the second token is palatalized but the first is not, the merged
 *    token inherits palatalization (палалізація подовженого приголосного).
 * 5. Soft + hard of same base → the soft variant prevails (зілля: ль+л → лʲː).
 *
 * This pass runs AFTER tokenization but BEFORE palatalization propagation,
 * so it works on the raw token stream.
 *
 * Sources: Савченко 2014, Тоцька 1997.
 */

import type { PhoneticToken } from './types';

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Strip the palatalization diacritic to get the "base" IPA of a consonant.
 * e.g., "tʲ" → "t", "lʲ" → "l", "dʒ" → "dʒ"
 */
function baseIpa(ipa: string): string {
  return ipa.replace(/ʲ$/, '');
}

// ── Pass implementation ─────────────────────────────────────────────────────

/**
 * Merge adjacent identical consonant tokens into geminate tokens with ː.
 *
 * @param tokens - The token array (modified in place; array length may shrink)
 * @returns The modified array (same reference, but may be shorter)
 */
export function applyGeminates(tokens: PhoneticToken[]): PhoneticToken[] {
  if (tokens.length < 2) return tokens;

  let writeIdx = 0;

  for (let i = 0; i < tokens.length; i++) {
    const current = tokens[i]!;

    // Only merge consonant-type tokens (consonant, glide, glottal)
    if (current.type !== 'consonant' && current.type !== 'glide') {
      tokens[writeIdx++] = current;
      continue;
    }

    // Look ahead: check if the next token has the same base IPA
    const next = tokens[i + 1];
    if (
      next &&
      (next.type === 'consonant' || next.type === 'glide') &&
      baseIpa(current.ipa) === baseIpa(next.ipa)
    ) {
      // Merge: take the more palatalized variant
      const useSoft = current.palatalized || next.palatalized;
      const mergedIpa = useSoft ? baseIpa(current.ipa) + 'ʲː' : baseIpa(current.ipa) + 'ː';

      current.ipa = mergedIpa;
      current.source = current.source + next.source;
      current.palatalized = useSoft;

      // Inherit consonant features from whichever is palatalized (prefer soft)
      if (useSoft) {
        if (next.palatalized && next.consonantFeatures) {
          current.consonantFeatures = { ...next.consonantFeatures };
        } else if (current.consonantFeatures) {
          current.consonantFeatures.softness = 'soft';
        }
      }

      // Skip the next token (consumed by merge)
      i++;
    }

    tokens[writeIdx++] = current;
  }

  // Trim the array to the new length
  tokens.length = writeIdx;
  return tokens;
}
