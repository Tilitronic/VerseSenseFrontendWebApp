/**
 * syllabifier.ts — Pass 6: Token-aware syllabification
 *
 * Implements Ukrainian syllabification based on
 * Савченко І. С. (2014), §20 "Особливості українського складоподілу",
 * pp. 69–76, and the Jespersen sonority scale.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * JESPERSEN SONORITY SCALE (as cited by Савченко via Семчинський 1986):
 *   0 — voiceless plosives / affricates  (п, т, к, ц, ч)
 *   1 — voiced plosives / affricates     (б, д, ґ, дз, дж)
 *   2 — voiceless fricatives             (ф, с, ш, х)
 *   3 — voiced fricatives                (з, ж, ɦ)
 *   4 — nasals                           (м, н, нь)
 *   5 — laterals                         (л, ль)
 *   6 — trills                           (р, рь)
 *   7–9 — vowels (by height)
 *
 * ТОЦЬКА simplified scale: 4=V, 3=sonorant, 2=voiced obstruent, 1=voiceless
 * ═══════════════════════════════════════════════════════════════════════
 *
 * RULES (Савченко §20, pp. 71–75):
 *
 * Rule 1 — Single intervocalic C → onset of next syllable.
 *          V.CV:  са-ди-ба, де-ре-во
 *
 * Rule 2 — Two intervocalic consonants CC:
 *   2a) Both voiceless obstruents → both to next:           V.CCV  гу-сто, ша-пка
 *   2b) Both voiced obstruents, same manner → both to next: V.CCV  при-дба-ти
 *   2c) Obstruent + sonorant → both to next:                V.CCV  ху-тро, ша-бля
 *   2d) Two sonorants → split:                              VC.CV  гор-ло, пер-ли
 *   2e) Sonorant + obstruent → split:                       VC.CV  скля-нка, чай-ка
 *   2f) Voiced obs + voiceless obs → split:                 VC.CV  каз-ка, швед-ка
 *   2g) Voiced fricative + voiced stop/affricate (or vice versa) → split:
 *                                                           VC.CV  друж-ба, куз-бас
 *
 * Rule 3 — Three+ intervocalic consonants:
 *   3a) First sonorant stays in prev syllable, rest → next:
 *        лін-гвіст, пор-тфель, тем-бро-вий
 *   3b) If obstruents precede a sonorant, all of them + sonorant → next:
 *        пи-скля, по-стріл, кра-ве-цтво
 *   3c) All voiceless obstruents → all to next: ху-стка
 *   3d) Voiced obs + voiceless cluster → split after voiced:
 *        роз-пла-та, роз-спів
 *
 * General principle: boundary at the sonority "trough" — where
 * the lowest sonority dip occurs in the cluster.
 *
 * The syllabifier works on PhoneticToken[] and produces UaSyllable[].
 */

import type { PhoneticToken, UaSyllable } from './types';

// ── Sonority helpers ────────────────────────────────────────────────────────

/**
 * Jespersen sonority value for a consonant token.
 * Scale 0–6 for consonants; vowels get 9 (never compared here).
 */
function sonority(t: PhoneticToken): number {
  if (t.type === 'vowel') return 9;

  const f = t.consonantFeatures;
  if (!f) return 0; // unknown → treat as voiceless stop (lowest)

  // Sonorants by manner
  if (f.voicePower === 'sonorant') {
    switch (f.manner) {
      case 'trill':
        return 6; // р, рь
      case 'lateral':
        return 5; // л, ль
      case 'nasal':
        return 4; // м, н, нь
      case 'approximant':
        return 5; // ʋ (в) — between lateral and trill
      default:
        return 4;
    }
  }

  // Glide j — treat as high sonorant (palatal approximant)
  if (t.type === 'glide') return 5;
  // w, u̯ — also glide-like
  if (t.ipa === 'w' || t.ipa === 'u̯') return 5;

  // Obstruents
  if (f.voicePower === 'voiced') {
    // Voiced fricatives = 3, voiced stops/affricates = 1
    if (f.manner === 'fricative') return 3;
    return 1; // plosive or affricate
  }

  // Voiceless
  if (f.manner === 'fricative') return 2;
  return 0; // voiceless plosive or affricate
}

function isVowel(t: PhoneticToken): boolean {
  return t.type === 'vowel';
}

function isSonorant(t: PhoneticToken): boolean {
  if (t.type === 'glide') return true;
  if (t.ipa === 'w' || t.ipa === 'u̯') return true;
  if (!t.consonantFeatures) return false;
  return t.consonantFeatures.voicePower === 'sonorant';
}

function isVoicedObstruent(t: PhoneticToken): boolean {
  if (!t.consonantFeatures) return false;
  return t.consonantFeatures.voicePower === 'voiced';
}

function isVoicelessObstruent(t: PhoneticToken): boolean {
  if (!t.consonantFeatures) return false;
  return t.consonantFeatures.voicePower === 'voiceless';
}

function isObstruent(t: PhoneticToken): boolean {
  return isVoicedObstruent(t) || isVoicelessObstruent(t);
}

function isPlosiveOrAffricate(t: PhoneticToken): boolean {
  if (!t.consonantFeatures) return false;
  return t.consonantFeatures.manner === 'plosive' || t.consonantFeatures.manner === 'affricate';
}

function isFricative(t: PhoneticToken): boolean {
  if (!t.consonantFeatures) return false;
  return t.consonantFeatures.manner === 'fricative';
}

// ── Cluster splitting — Савченко §20 rules ──────────────────────────────────

/**
 * Given a consonant cluster (tokens between two vowels), decide the
 * split point.
 *
 * Returns the split index: cluster[0..split-1] → coda (prev syllable),
 *                          cluster[split..] → onset (next syllable).
 */
function splitCluster(cluster: PhoneticToken[]): number {
  const len = cluster.length;

  // ── Rule 1: single consonant → all to onset ────────────────────────
  if (len === 1) return 0;

  // ── Rule 2: two consonants ─────────────────────────────────────────
  if (len === 2) {
    const a = cluster[0]!;
    const b = cluster[1]!;

    // 2a) Both voiceless obstruents → both to next (гу-сто, ша-пка)
    if (isVoicelessObstruent(a) && isVoicelessObstruent(b)) return 0;

    // 2b) Both voiced obstruents, same manner → both to next (при-дба-ти)
    if (isVoicedObstruent(a) && isVoicedObstruent(b)) {
      const ma = a.consonantFeatures?.manner;
      const mb = b.consonantFeatures?.manner;
      // Same manner class: both stops, or both fricatives
      if (ma === mb) return 0;
      // Different manner (fricative + stop or vice versa) → split (друж-ба)
      // 2g) voiced fricative + voiced stop/affricate → split
      if (isFricative(a) && isPlosiveOrAffricate(b)) return 1;
      if (isPlosiveOrAffricate(a) && isFricative(b)) return 1;
      // Fallback for mixed voiced: split
      return 1;
    }

    // 2c) Obstruent + sonorant → both to next (ху-тро, ша-бля)
    if (isObstruent(a) && isSonorant(b)) return 0;

    // 2d) Two sonorants → split (гор-ло, грив-ня)
    if (isSonorant(a) && isSonorant(b)) return 1;

    // 2e) Sonorant + obstruent → split (скля-нка, чай-ка, став-ки)
    if (isSonorant(a) && isObstruent(b)) return 1;

    // 2f) Voiced obstruent + voiceless obstruent → split (каз-ка, швед-ка)
    if (isVoicedObstruent(a) && isVoicelessObstruent(b)) return 1;

    // Voiceless + voiced — this is uncommon but by rising sonority → both to next
    if (isVoicelessObstruent(a) && isVoicedObstruent(b)) return 0;

    // Fallback: use sonority — split at the sonority trough
    return sonority(a) >= sonority(b) ? 1 : 0;
  }

  // ── Rule 3: three or more consonants ───────────────────────────────
  //
  // Strategy derived from Савченко §20 rules 3a–3d:
  //
  // Scan left-to-right. Find the first sonorant in the cluster.
  // - If found at position k > 0:
  //     Rule 3a: sonorant stays in prev syllable → split after it (k+1)
  //              UNLESS everything before it is obstruent and everything
  //              after it is also obstruent → use sonority trough
  //     Rule 3b: if k=0, the sonorant is the first; check if all
  //              following are obstruent → sonorant is coda, rest onset
  //
  // Then apply the voicing rules:
  // - Rule 3c: all voiceless obstruents → all to next
  // - Rule 3d: voiced obs + voiceless cluster → split after voiced

  // ── Check if all consonants are voiceless obstruents (3c) ──────────
  if (cluster.every(isVoicelessObstruent)) return 0;

  // ── Find leftmost sonorant ─────────────────────────────────────────
  const firstSonIdx = cluster.findIndex(isSonorant);

  if (firstSonIdx >= 0) {
    // 3a: If the sonorant is NOT at position 0, check what's before it
    if (firstSonIdx > 0) {
      // Everything before the sonorant — are they all obstruents?
      const allObsBefore = cluster.slice(0, firstSonIdx).every(isObstruent);
      if (allObsBefore) {
        // 3b variant: obstruents + sonorant → all go to next syllable
        // (по-стріл, кра-ве-цтво, акт-ри-са — obs+sonorant cluster)
        // But we need to check: is there anything AFTER the sonorant?
        // If after sonorant there are more consonants, the sonorant group
        // may need to split differently.
        // Check: is everything from firstSonIdx onward going to next?
        // That includes sonorant(s) + possibly more consonants.
        // In Савченко examples: об-шук, по-стріл, шкі-рно → yes, all to next.
        return 0;
      }
    }

    // If sonorant is at position 0:
    // 3a: first sonorant stays in prev syllable
    // Rest goes to next syllable
    if (firstSonIdx === 0) {
      // Check if there's a second sonorant
      // Two sonorants at start → first is coda, recurse/check rest
      // (e.g., гой-дал-ка)
      // Look for end of sonorant run
      let sonEnd = 0;
      while (sonEnd < len && isSonorant(cluster[sonEnd]!)) sonEnd++;
      // First sonorant → coda; everything from second sonorant onward → onset
      // But if there are obstruents after, apply sub-rules
      if (sonEnd === 1) {
        // Single sonorant at start, rest are obstruents/mix → split at 1
        return 1;
      }
      // Multiple sonorants at start → split: first sonorant is coda
      // (сум-но, гор-ло)
      return 1;
    }

    // Sonorant somewhere in the middle
    // Split: everything up to and including the sonorant → coda
    // Rest → onset
    // Actually per rule 3a: first sonorant stays in prev syllable
    return firstSonIdx + 1;
  }

  // ── No sonorants — all obstruents ──────────────────────────────────
  // 3d: If first is voiced and rest are voiceless → split after voiced
  if (isVoicedObstruent(cluster[0]!) && cluster.slice(1).every(isVoicelessObstruent)) {
    return 1;
  }

  // General: find the sonority trough
  return findSonorityTrough(cluster);
}

/**
 * Find the position of the sonority trough (minimum) in the cluster.
 * Split the cluster at this point: everything up to (exclusive) the
 * trough → coda, trough and after → onset.
 * If the trough is at position 0, split at 1 to keep at least one coda.
 */
function findSonorityTrough(cluster: PhoneticToken[]): number {
  let minSon = Infinity;
  let minIdx = 0;

  for (let i = 0; i < cluster.length; i++) {
    const s = sonority(cluster[i]!);
    if (s < minSon) {
      minSon = s;
      minIdx = i;
    }
  }

  // The trough and everything after → onset
  // But never return 0 for clusters of 2+ (leave at least one coda)
  return minIdx > 0 ? minIdx : 1;
}

// ── Main syllabifier ────────────────────────────────────────────────────────

/**
 * Syllabify a token array into UaSyllable[].
 *
 * @param tokens - Post-all-passes PhoneticToken array
 * @returns Array of UaSyllable objects
 */
export function syllabify(tokens: PhoneticToken[]): UaSyllable[] {
  if (tokens.length === 0) return [];

  // ── Step 1: Find vowel nucleus positions ──────────────────────────────
  const vowelIndices: number[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (isVowel(tokens[i]!)) vowelIndices.push(i);
  }

  // No vowels → single syllable containing all tokens
  if (vowelIndices.length === 0) {
    return [buildSyllable(tokens)];
  }

  // Single vowel → single syllable
  if (vowelIndices.length === 1) {
    return [buildSyllable(tokens)];
  }

  // ── Step 2: Identify consonant clusters between vowels and split ─────
  // We process pairs of adjacent vowels and decide where the consonant
  // cluster between them splits.

  // syllableTokens[i] will accumulate tokens for syllable i
  const syllableGroups: PhoneticToken[][] = [];
  let currentGroup: PhoneticToken[] = [];

  // Everything up to and including the first vowel → first syllable start
  let lastVowelEnd = 0;

  for (let vi = 0; vi < vowelIndices.length; vi++) {
    const vowelPos = vowelIndices[vi]!;

    if (vi === 0) {
      // Everything from start to this vowel (inclusive) → first syllable
      for (let j = 0; j <= vowelPos; j++) {
        currentGroup.push(tokens[j]!);
      }
      lastVowelEnd = vowelPos + 1;
      continue;
    }

    // Consonant cluster between previous vowel and this vowel
    const clusterStart = lastVowelEnd;
    const clusterEnd = vowelPos; // exclusive — the vowel itself
    const cluster: PhoneticToken[] = [];

    for (let j = clusterStart; j < clusterEnd; j++) {
      cluster.push(tokens[j]!);
    }

    if (cluster.length === 0) {
      // Two adjacent vowels (hiatus) — start new syllable at current vowel
      syllableGroups.push(currentGroup);
      currentGroup = [tokens[vowelPos]!];
    } else {
      // Split the cluster
      const splitAt = splitCluster(cluster);

      // Coda: cluster[0..splitAt-1] → append to current syllable
      for (let j = 0; j < splitAt; j++) {
        currentGroup.push(cluster[j]!);
      }

      // Finish current syllable
      syllableGroups.push(currentGroup);

      // Onset: cluster[splitAt..] + vowel → start new syllable
      currentGroup = [];
      for (let j = splitAt; j < cluster.length; j++) {
        currentGroup.push(cluster[j]!);
      }
      currentGroup.push(tokens[vowelPos]!);
    }

    lastVowelEnd = vowelPos + 1;
  }

  // ── Step 3: Remaining tokens after last vowel → coda of last syllable ─
  for (let j = lastVowelEnd; j < tokens.length; j++) {
    currentGroup.push(tokens[j]!);
  }
  syllableGroups.push(currentGroup);

  // ── Step 4: Build UaSyllable objects ──────────────────────────────────
  return syllableGroups.map(buildSyllable);
}

// ── Build a UaSyllable from a group of tokens ───────────────────────────────

function buildSyllable(tokens: PhoneticToken[]): UaSyllable {
  const ipa = tokens.map((t) => t.ipa).join('');
  const stressed = tokens.some((t) => t.stressed);
  const lastToken = tokens[tokens.length - 1];
  const isOpen = lastToken ? isVowel(lastToken) : false;

  return {
    ipa,
    tokens: [...tokens], // defensive copy
    stressed,
    isOpen,
  };
}
