/**
 * rhyme/rhymeAnalyzer.ts
 *
 * Orchestrates the full rhyme-analysis pipeline and returns a RhymeAnalysis
 * ready for the visualizer.
 *
 * Pipeline:
 *   1. Build a flat FlatToken sequence from confirmed lines in the store document.
 *   2. Call findMotifs() to get all FoundMotif records.
 *   3. Convert FoundMotif positions back to (lineIdx, wordId, renderKey) spans.
 *   4. Assign a visually distinct color to each motif group.
 *   5. Build the cellMotifs lookup map for O(1) cell → motif queries.
 *
 * ── Color assignment ──────────────────────────────────────────────────────────
 *
 * Each motif tier gets a distinct lightness band:
 *   exact      → L = 52% (vivid, saturated — confident match)
 *   near       → L = 65% (lighter — approximate match)
 *   structural → L = 75% (pale — skeleton match only)
 *
 * Hues are distributed evenly across the HSL wheel in order of motif length
 * (longer motifs get lower hue values = red-orange range, which feels "heavier").
 * Within a tier, motifs are ordered by occurrence count (most frequent first)
 * and then by length (longer first) so the most prominent patterns get
 * the most distinctive colors.
 */

import type { IPoetryDocument } from 'src/model/Token';
import { transcribeWord } from 'src/services/phonetic/wordTranscription';
import { encodeToken } from './phonemeEncoder';
import { findMotifs, type FlatToken } from './motifFinder';
import type { PhonemeMotif, MotifSpan, RhymeAnalysis, MotifTier } from './types';

// ── Lightness per tier ────────────────────────────────────────────────────────

const TIER_LIGHTNESS: Record<MotifTier, number> = {
  exact: 50,
  near: 63,
  structural: 74,
};

const TIER_SATURATION: Record<MotifTier, number> = {
  exact: 85,
  near: 68,
  structural: 48,
};

// ── Flat sequence builder ─────────────────────────────────────────────────────

interface FlatEntry extends FlatToken {
  /** If this is a real phoneme (not boundary), which syllable/token position */
  sylIdx: number;
  tokIdx: number;
  isBoundary: boolean;
}

/** Characters that have no phonetic content (punctuation-only words) */
const HAS_LETTER = /\p{L}/u;

/**
 * Build the flat token sequence from all confirmed lines.
 * Returns both the flat array and an index from flat position → FlatEntry.
 */
function buildFlatSequence(
  doc: IPoetryDocument,
  isLineConfirmed: (lineId: string) => boolean,
): FlatEntry[] {
  const flat: FlatEntry[] = [];

  // LINE_BOUNDARY sentinel at the very start
  flat.push(makeBoundary('', -1, 1 /* LINE_BOUNDARY */));

  for (let lineIdx = 0; lineIdx < doc.lines.length; lineIdx++) {
    const line = doc.lines[lineIdx]!;
    if (!isLineConfirmed(line.id)) continue;

    let firstWordOnLine = true;

    for (const tok of line.tokens) {
      if (tok.kind !== 'WORD') continue;
      const wt = tok;
      if (!HAS_LETTER.test(wt.text)) continue; // skip punctuation

      // WORD_BOUNDARY between words (not before the very first word of a line)
      if (!firstWordOnLine) {
        flat.push(makeBoundary(wt.id, lineIdx, 0 /* WORD_BOUNDARY */));
      }
      firstWordOnLine = false;

      const tw = transcribeWord(wt);
      for (let si = 0; si < tw.syllables.length; si++) {
        const syl = tw.syllables[si]!;
        for (let ti = 0; ti < syl.ipaTokens.length; ti++) {
          const token = syl.ipaTokens[ti]!;
          const renderKey = `${wt.id}:${si}:${ti}`;
          flat.push({
            token,
            renderKey,
            wordId: wt.id,
            lineIdx,
            sylIdx: si,
            tokIdx: ti,
            isBoundary: false,
            codeExact: encodeToken(token, 'exact'),
            codeFuzzy: encodeToken(token, 'fuzzy'),
            codeStructural: encodeToken(token, 'structural'),
          });
        }
      }
    }

    // LINE_BOUNDARY after each line
    flat.push(makeBoundary('', lineIdx, 1 /* LINE_BOUNDARY */));
  }

  return flat;
}

function makeBoundary(wordId: string, lineIdx: number, code: number): FlatEntry {
  return {
    token: '',
    renderKey: '',
    wordId,
    lineIdx,
    sylIdx: -1,
    tokIdx: -1,
    isBoundary: true,
    codeExact: code,
    codeFuzzy: code,
    codeStructural: code,
  };
}

// ── Color assignment ──────────────────────────────────────────────────────────

/**
 * Generate `count` hues spread evenly around the HSL wheel,
 * starting at `startHue` and stepping by golden-ratio offsets to avoid
 * perceptually similar adjacent colors.
 */
function generateHues(count: number): number[] {
  const hues: number[] = [];
  // Golden-ratio hue stepping (≈ 137.5°) gives maximally distinct colors
  const GOLDEN_ANGLE = 137.508;
  let hue = 11; // start near red-orange
  for (let i = 0; i < count; i++) {
    hues.push(Math.round(hue) % 360);
    hue += GOLDEN_ANGLE;
  }
  return hues;
}

// ── Weight (opacity) computation ──────────────────────────────────────────

/**
 * Compute visual opacity for a motif in [0.25, 1.0].
 *
 * Formula combines two factors:
 *
 *   length_score  = min(1, length / LENGTH_TARGET)
 *     Saturates at LENGTH_TARGET tokens (e.g. 5). Short motifs (2 tokens)
 *     start at 2/5 = 0.40; 5+-token motifs reach 1.0.
 *
 *   proximity_score = exp(-meanGap / GAP_DECAY)
 *     meanGap is the average flat-index distance between consecutive occurrences.
 *     GAP_DECAY = 20 tokens: gap=0 → 1.0, gap=20 → 0.37, gap=50 → 0.08.
 *
 *   raw = length_score * 0.5 + proximity_score * 0.5
 *   opacity = clamp(raw, MIN_OPACITY, 1.0)
 */
const LENGTH_TARGET = 5; // tokens at which length contribution maxes out
const GAP_DECAY = 20; // exponential decay constant (flat token positions)
const MIN_OPACITY = 0.25;

function computeOpacity(length: number, occurrenceStarts: number[]): number {
  const lengthScore = Math.min(1, length / LENGTH_TARGET);

  let proximityScore = 0.5; // default if only 1 pair
  if (occurrenceStarts.length >= 2) {
    const sorted = [...occurrenceStarts].sort((a, b) => a - b);
    let totalGap = 0;
    for (let i = 1; i < sorted.length; i++) {
      totalGap += sorted[i]! - sorted[i - 1]! - length; // gap BETWEEN occurrences
    }
    const meanGap = totalGap / (sorted.length - 1);
    proximityScore = Math.exp(-Math.max(0, meanGap) / GAP_DECAY);
  }

  const raw = lengthScore * 0.5 + proximityScore * 0.5;
  return Math.max(MIN_OPACITY, Math.min(1.0, raw));
}

// ── ID generation ─────────────────────────────────────────────────────────────

function motifId(canonicalTokens: string[], tier: MotifTier): string {
  return `motif:${tier}:${canonicalTokens.join('+')}`;
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Run the full rhyme analysis on the given document.
 *
 * @param doc               The parsed poetry document
 * @param isLineConfirmed   Store function to check if a line is fully annotated
 */
export function analyzeRhymes(
  doc: IPoetryDocument,
  isLineConfirmed: (lineId: string) => boolean,
): RhymeAnalysis {
  const flat = buildFlatSequence(doc, isLineConfirmed);

  // Only the real phoneme entries (non-boundary)
  const phonemeFlat = flat; // findMotifs handles boundaries internally

  const rawMotifs = findMotifs(phonemeFlat);

  if (rawMotifs.length === 0) return { motifs: [], cellMotifs: new Map() };

  // ── Sort: exact first, then near, structural; within tier: longer then more frequent
  const tierOrder: Record<MotifTier, number> = { exact: 0, near: 1, structural: 2 };
  rawMotifs.sort((a, b) => {
    const to = tierOrder[a.tier] - tierOrder[b.tier];
    if (to !== 0) return to;
    const lo = b.length - a.length;
    if (lo !== 0) return lo;
    return b.occurrenceStarts.length - a.occurrenceStarts.length;
  });

  // ── Assign colors ──────────────────────────────────────────────────────────
  const hues = generateHues(rawMotifs.length);

  // ── Convert raw motifs → PhonemeMotif (with spans) ────────────────────────
  const motifs: PhonemeMotif[] = [];
  const cellMotifs = new Map<string, string[]>();

  for (let mi = 0; mi < rawMotifs.length; mi++) {
    const raw = rawMotifs[mi]!;
    const tier = raw.tier;
    const hue = hues[mi]!;
    const opacity = computeOpacity(raw.length, raw.occurrenceStarts);
    const color = `hsla(${hue}, ${TIER_SATURATION[tier]}%, ${TIER_LIGHTNESS[tier]}%, ${opacity.toFixed(3)})`;
    const id = motifId(raw.canonicalTokens, tier);

    // Build spans: group consecutive flat positions by wordId
    const spans: MotifSpan[] = [];
    for (const start of raw.occurrenceStarts) {
      // Group the slice into per-word spans
      const spanMap = new Map<string, { lineIdx: number; wordId: string; renderKeys: string[] }>();
      for (let offset = 0; offset < raw.length; offset++) {
        const entry = flat[start + offset];
        if (!entry || entry.isBoundary) continue;
        let span = spanMap.get(entry.wordId);
        if (!span) {
          span = { lineIdx: entry.lineIdx, wordId: entry.wordId, renderKeys: [] };
          spanMap.set(entry.wordId, span);
        }
        span.renderKeys.push(entry.renderKey);
      }
      for (const span of spanMap.values()) spans.push(span);
    }

    const motif: PhonemeMotif = {
      id,
      tier,
      canonicalTokens: raw.canonicalTokens,
      spans,
      color,
      opacity,
    };
    motifs.push(motif);

    // Build cellMotifs lookup
    for (const span of spans) {
      for (const rk of span.renderKeys) {
        let list = cellMotifs.get(rk);
        if (!list) {
          list = [];
          cellMotifs.set(rk, list);
        }
        if (!list.includes(id)) list.push(id);
      }
    }
  }

  return { motifs, cellMotifs };
}
