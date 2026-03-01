/**
 * palatalizationPass.ts — Pass 2: Regressive palatalization propagation
 *
 * Ukrainian has regressive palatalization: a palatalized consonant
 * can soften the preceding consonant if they share the same place
 * of articulation (dental+dental, labial is NOT propagated).
 *
 * Rules (Тоцька 1997, Мойсієнко 2010):
 * 1. Only dental consonants propagate softness regressively:
 *    /d, t, z, s, dz, ts, l, n, r/ and their soft variants.
 * 2. Softening propagates through a cluster of dentals right-to-left.
 * 3. Labials, velars, postalveolars do NOT participate.
 * 4. /j/ does NOT trigger regressive palatalization (it's already soft).
 *
 * Examples:
 *   сніг   → [sʲnʲiɦ]   (н soft before і, с soft before нʲ)
 *   стіл   → [sʲtʲil]   (т soft before і, с soft before тʲ)
 *   пісня  → [pʲisʲnʲɑ] — wait, п is labial, it doesn't soften
 *            actually: [pisʲnʲɑ] — сь before нь
 *
 * This pass modifies the tokens array IN PLACE.
 */

import type { PhoneticToken, ConsonantFeatures } from './types';
import graphemeData from './data/graphemes';
import consonantData from './data/consonants';

// ── Lookup structures ───────────────────────────────────────────────────────

const softMap = graphemeData.softMap;
const softenableSet = new Set(graphemeData.softenableConsonants);

/** IPA → ConsonantFeatures */
const consonantFeatureMap = new Map<string, ConsonantFeatures>();
for (const p of consonantData.phonemes) {
  consonantFeatureMap.set(p.ipa, {
    voicePower: p.voicePower as ConsonantFeatures['voicePower'],
    place: p.place as ConsonantFeatures['place'],
    manner: p.manner as ConsonantFeatures['manner'],
    softness: p.softness as ConsonantFeatures['softness'],
    nasality: p.nasality as ConsonantFeatures['nasality'],
  });
}

/** Dental place IPA consonants that participate in regressive palatalization */
const dentalIpas = new Set<string>();
for (const p of consonantData.phonemes) {
  if (p.place === 'dental') {
    dentalIpas.add(p.ipa);
  }
}

// ── Pass implementation ─────────────────────────────────────────────────────

/**
 * Apply regressive palatalization propagation across dental clusters.
 *
 * Scan right-to-left. When a palatalized dental is found, check the
 * token to its left: if it's also a dental and softenable, soften it.
 * Repeat until we hit a non-dental or a non-softenable consonant.
 *
 * @param tokens - The token array (modified in place)
 */
export function applyPalatalization(tokens: PhoneticToken[]): void {
  // Right-to-left scan
  for (let i = tokens.length - 1; i > 0; i--) {
    const current = tokens[i]!;

    // Only palatalized consonants trigger propagation
    if (!current.palatalized) continue;
    if (current.type !== 'consonant') continue;

    // Check if current is dental (strip ʲ and ː for base lookup)
    const currentBase = current.ipa.replace(/[ʲː]/g, '');
    if (!dentalIpas.has(currentBase) && !dentalIpas.has(current.ipa.replace(/ː$/, ''))) continue;

    // Propagate leftward through dentals
    let k = i - 1;
    while (k >= 0) {
      const prev = tokens[k]!;

      // Stop at non-consonants
      if (prev.type !== 'consonant') break;

      // Stop at already-palatalized consonants (already handled)
      if (prev.palatalized) {
        k--;
        continue;
      }

      // Check if previous is a softenable dental (strip ʲ and ː for base lookup)
      const prevBase = prev.ipa.replace(/[ʲː]/g, '');
      const prevNoGem = prev.ipa.replace(/ː$/, '');
      if (!dentalIpas.has(prevBase) && !dentalIpas.has(prevNoGem)) break;
      if (!softenableSet.has(prevNoGem) && !softenableSet.has(prevBase)) break;

      // Soften it (preserve ː suffix if geminate)
      const isGeminate = prev.ipa.endsWith('ː');
      const lookupIpa = prevNoGem;
      const softIpa = softMap[lookupIpa] ?? softMap[prevBase];
      if (softIpa) {
        prev.ipa = softIpa + (isGeminate ? 'ː' : '');
        prev.palatalized = true;
        const softFeatures = consonantFeatureMap.get(softIpa);
        if (softFeatures) {
          prev.consonantFeatures = { ...softFeatures };
        } else if (prev.consonantFeatures) {
          prev.consonantFeatures.softness = 'soft';
        }
      }

      k--;
    }
  }
}
