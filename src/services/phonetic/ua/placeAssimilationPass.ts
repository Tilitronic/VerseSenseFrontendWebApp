/**
 * placeAssimilationPass.ts — Pass 3b: Assimilation by place of articulation
 *
 * Ukrainian has regressive place assimilation where dental sibilants
 * assimilate to the postalveolar place before postalveolar consonants,
 * and dental stops merge with following homorganic fricatives into affricates.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * SIBILANT ASSIMILATION (Тоцька 1997, Савченко 2014):
 *   з/с + ш → шш     (зшити → [шшити], розсіяти: [рɔзсіяти])
 *   з/с + ж → жж     (зжати → [жжати])
 *   з/с + ч → шч     (зчепити → [шчепити])
 *   з/с + дж → ждж   (зджерти → [ждж...])
 *
 * AFFRICATE ASSIMILATION:
 *   т + с → ц        (братство → [брацтвɔ])
 *   ть + с → ць      (багатство → [баɦацʲтвɔ])
 *   т + ц → цц       (отці → [оцʲці])
 *
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Direction: regressive (right-to-left scanning).
 * This pass runs AFTER voicing assimilation (Pass 3) because voicing
 * changes must resolve before place assimilation applies.
 *
 * Data-driven: rules from placeAssimilation.json.
 */

import type { PhoneticToken, ConsonantFeatures } from './types';
import placeData from './data/placeAssimilation';
import consonantData from './data/consonants';

// ── Lookup structures ───────────────────────────────────────────────────────

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

// ── Build sibilant assimilation lookup ──────────────────────────────────────

interface SibilantRule {
  target: string;    // IPA of the token that changes
  trigger: string;   // IPA of the following token that causes the change
  result: string;    // IPA the target becomes
}

const sibilantRules: SibilantRule[] = placeData.sibilantAssimilation.rules.map((r) => ({
  target: r.target,
  trigger: r.trigger,
  result: r.result,
}));

// ── Build affricate assimilation lookup ─────────────────────────────────────

interface AffricateRule {
  first: string;   // IPA of first token
  second: string;  // IPA of second token
  result: string;  // IPA that replaces the first token (second removed)
}

const affricateRules: AffricateRule[] = placeData.affricateAssimilation.rules.map((r) => ({
  first: r.first,
  second: r.second,
  result: r.result,
}));

// ── Pass implementation ─────────────────────────────────────────────────────

/**
 * Apply assimilation by place of articulation.
 *
 * Scans right-to-left through the token array:
 * 1. Sibilant assimilation: dental sibilants become postalveolar before postalveolar C
 * 2. Affricate assimilation: t+s→ts (affricate formation)
 *
 * @param tokens - The token array (modified in place; may shrink for affricate merges)
 * @returns The (possibly shortened) token array
 */
export function applyPlaceAssimilation(tokens: PhoneticToken[]): PhoneticToken[] {
  if (tokens.length < 2) return tokens;

  // ── Phase 1: Sibilant assimilation (does NOT remove tokens) ───────────
  // Right-to-left scan
  for (let i = tokens.length - 2; i >= 0; i--) {
    const current = tokens[i]!;
    const next = tokens[i + 1]!;

    // Both must be consonant-type
    if (current.type !== 'consonant' && current.type !== 'glide') continue;
    if (next.type !== 'consonant' && next.type !== 'glide') continue;

    // Check sibilant rules (strip ː for geminate-aware matching)
    for (const rule of sibilantRules) {
      const currentBase = current.ipa.replace(/ː$/, '');
      const nextBase = next.ipa.replace(/ː$/, '');
      const currentIsGeminate = current.ipa.endsWith('ː');

      if (currentBase === rule.target && nextBase === rule.trigger) {
        current.ipa = rule.result + (currentIsGeminate ? 'ː' : '');
        current.palatalized = rule.result.includes('ʲ');

        // Update features
        const features = consonantFeatureMap.get(rule.result);
        if (features) {
          current.consonantFeatures = { ...features };
        } else if (current.consonantFeatures) {
          current.consonantFeatures.place = 'postalveolar';
        }
        break;
      }
    }
  }

  // ── Phase 2: Affricate assimilation (may remove tokens) ───────────────
  // Scan left-to-right, merge t+s → ts etc.
  let writeIdx = 0;

  for (let i = 0; i < tokens.length; i++) {
    const current = tokens[i]!;
    const next = tokens[i + 1];

    if (
      next &&
      (current.type === 'consonant' || current.type === 'glide') &&
      (next.type === 'consonant' || next.type === 'glide')
    ) {
      let matched = false;
      for (const rule of affricateRules) {
        const currentBase = current.ipa.replace(/ː$/, '');
        const nextBase = next.ipa.replace(/ː$/, '');

        if (currentBase === rule.first && nextBase === rule.second) {
          // Merge: current becomes the affricate, skip next
          current.ipa = rule.result;
          current.source = current.source + next.source;
          current.palatalized = rule.result.includes('ʲ');

          const features = consonantFeatureMap.get(rule.result);
          if (features) {
            current.consonantFeatures = { ...features };
          }

          i++; // skip next token
          matched = true;
          break;
        }
      }

      tokens[writeIdx++] = current;
      if (matched) continue;
    } else {
      tokens[writeIdx++] = current;
    }
  }

  // Trim if any affricate merges occurred
  if (writeIdx < tokens.length) {
    tokens.length = writeIdx;
  }

  return tokens;
}
