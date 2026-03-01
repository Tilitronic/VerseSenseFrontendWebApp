/**
 * voicingAssimilationPass.ts — Pass 3: Regressive voicing assimilation
 *
 * Ukrainian obstruent clusters assimilate voicing regressively:
 * - A voiceless obstruent becomes voiced before a voiced obstruent
 * - A voiced obstruent becomes voiceless before a voiceless obstruent
 *
 * Critical rules (Тоцька 1997):
 * - Sonorants do NOT trigger assimilation and are NOT affected by it
 * - Ukrainian does NOT have word-final devoicing (unlike Russian/German)
 * - Only cluster-internal assimilation
 * - /ʋ/ (в) is classified as sonorant → exempt
 *
 * Examples:
 *   просьба  → prɔzʲbɑ    (sʲ → zʲ before b)
 *   вокзал   → ʋɔɡzɑl     (k → ɡ before z)
 *   боротьба → bɔrɔdʲbɑ   (tʲ → dʲ before b)
 *   легко    → lɛxkɔ      (ɦ → x before k — devoicing)
 *
 * Data-driven: pairing tables from assimilation.json.
 */

import type { PhoneticToken, ConsonantFeatures } from './types';
import assimData from './data/assimilation';
import consonantData from './data/consonants';

// ── Lookup structures ───────────────────────────────────────────────────────

const voicingPairs = assimData.voicingPairs;
const voicedObstruents = new Set(assimData.obstruents.voiced);
const voicelessObstruents = new Set(assimData.obstruents.voiceless);
const sonorants = new Set(assimData.sonorantExemption.sonorants);

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

function isObstruent(ipa: string): boolean {
  const base = ipa.replace(/ː$/, '');
  return voicedObstruents.has(base) || voicelessObstruents.has(base);
}

function isVoicedObstruent(ipa: string): boolean {
  return voicedObstruents.has(ipa.replace(/ː$/, ''));
}

function isVoicelessObstruent(ipa: string): boolean {
  return voicelessObstruents.has(ipa.replace(/ː$/, ''));
}

function isSonorant(ipa: string): boolean {
  return sonorants.has(ipa.replace(/ː$/, ''));
}

// ── Pass implementation ─────────────────────────────────────────────────────

/**
 * Apply regressive voicing assimilation across obstruent clusters.
 *
 * Scan right-to-left. For each obstruent, check the next consonant
 * to its right (skipping non-consonants is NOT needed here since
 * assimilation only applies within consonant clusters).
 *
 * @param tokens - The token array (modified in place)
 */
export function applyVoicingAssimilation(tokens: PhoneticToken[]): void {
  // Right-to-left scan through the token array
  for (let i = tokens.length - 2; i >= 0; i--) {
    const current = tokens[i]!;
    const next = tokens[i + 1]!;

    // Both must be consonant-type tokens
    if (current.type !== 'consonant' || next.type !== 'consonant') continue;

    // Current must be an obstruent
    if (!isObstruent(current.ipa)) continue;

    // Next must be an obstruent (sonorants don't trigger assimilation)
    if (isSonorant(next.ipa) || !isObstruent(next.ipa)) continue;

    // Determine assimilation direction
    const isGeminate = current.ipa.endsWith('ː');
    const currentBase = current.ipa.replace(/ː$/, '');
    const nextBase = next.ipa.replace(/ː$/, '');
    const suffix = isGeminate ? 'ː' : '';

    if (isVoicelessObstruent(currentBase) && isVoicedObstruent(nextBase)) {
      // Voiceless → voiced (progressive voicing)
      const voiced = voicingPairs[currentBase];
      if (voiced && voicedObstruents.has(voiced)) {
        current.ipa = voiced + suffix;
        const features = consonantFeatureMap.get(voiced);
        if (features) {
          current.consonantFeatures = { ...features };
        } else if (current.consonantFeatures) {
          current.consonantFeatures.voicePower = 'voiced';
        }
        current.palatalized = voiced.includes('ʲ');
      }
    } else if (isVoicedObstruent(currentBase) && isVoicelessObstruent(nextBase)) {
      // Voiced → voiceless (devoicing)
      const voiceless = voicingPairs[currentBase];
      if (voiceless && voicelessObstruents.has(voiceless)) {
        current.ipa = voiceless + suffix;
        const features = consonantFeatureMap.get(voiceless);
        if (features) {
          current.consonantFeatures = { ...features };
        } else if (current.consonantFeatures) {
          current.consonantFeatures.voicePower = 'voiceless';
        }
        current.palatalized = voiceless.includes('ʲ');
      }
    }
  }
}
