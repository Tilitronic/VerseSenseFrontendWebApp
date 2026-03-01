<template>
  <div class="rp-root">
    <!-- Empty state -->
    <div v-if="lineRows.length === 0" class="rp-empty">
      <q-icon name="music_note" size="2rem" color="grey-6" />
      <p>No rhyme patterns detected yet.<br />Confirm lines and enable Rhymes highlight.</p>
    </div>

    <!-- Rhyme skeleton: one row per poem line, only rhyming phonemes shown -->
    <div v-else class="rp-scroll">
      <div v-for="row in lineRows" :key="row.lineIdx" class="rp-line">
        <!-- Rhyme groups on this line, right-aligned -->
        <div class="rp-line__body">
          <template v-if="row.groups.length > 0">
            <span
              v-for="(group, gi) in row.groups"
              :key="gi"
              class="rp-pill"
              :style="pillStyle(group.motif)"
              :title="`[${TIER_LABEL[group.motif.tier]}] ${group.motif.canonicalTokens.join('')}`"
              >{{ group.tokens.join('') }}</span
            >
          </template>
          <!-- Line has no rhymes: show a faint dash -->
          <span v-else class="rp-line__empty">—</span>
        </div>

        <!-- Line number on the right -->
        <span class="rp-line__num">{{ row.lineIdx + 1 }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { usePoetryStore } from 'src/stores/poetry';
import { analyzeRhymes } from 'src/services/phonetic/rhyme/rhymeAnalyzer';
import { transcribeWord } from 'src/services/phonetic/wordTranscription';
import type { PhonemeMotif, MotifTier } from 'src/services/phonetic/rhyme/types';
import type { IWordToken } from 'src/model/Token';

const store = usePoetryStore();

const TIER_LABEL: Record<MotifTier, string> = {
  exact: 'Exact',
  near: 'Near',
  structural: 'Structural',
};

const analysis = computed(() => analyzeRhymes(store.document, store.isLineConfirmed));

interface RhymeGroup {
  /** word-position order key so groups sort left-to-right */
  orderKey: string;
  motif: PhonemeMotif;
  /** The actual IPA tokens from this span (not canonical — the real occurrence) */
  tokens: string[];
}

interface LineRow {
  lineIdx: number;
  /** Rhyme groups sorted by position in the line */
  groups: RhymeGroup[];
}

const lineRows = computed<LineRow[]>(() => {
  const { motifs, cellMotifs } = analysis.value;
  if (motifs.length === 0) return [];

  // Build a motifId → motif lookup
  const motifById = new Map<string, PhonemeMotif>(motifs.map((m) => [m.id, m]));

  const rows: LineRow[] = [];

  for (let lineIdx = 0; lineIdx < store.document.lines.length; lineIdx++) {
    const line = store.document.lines[lineIdx]!;
    if (!store.isLineConfirmed(line.id)) continue;

    // Walk words in order, collect (renderKey → motifId) hits
    // Then group consecutive renderKeys that share the same motif into a single pill
    const groups: RhymeGroup[] = [];
    const seenRenderKeys = new Set<string>();

    for (const tok of line.tokens) {
      if (tok.kind !== 'WORD') continue;
      const wt = tok as IWordToken;
      const tw = transcribeWord(wt);

      for (let si = 0; si < tw.syllables.length; si++) {
        const syl = tw.syllables[si]!;
        for (let ti = 0; ti < syl.ipaTokens.length; ti++) {
          const rk = `${wt.id}:${si}:${ti}`;
          if (seenRenderKeys.has(rk)) continue;

          const motifIds = cellMotifs.get(rk);
          if (!motifIds || motifIds.length === 0) continue;

          // Pick the highest-priority motif (exact > near > structural, then longest)
          const TIER_PRIO: Record<MotifTier, number> = { exact: 0, near: 1, structural: 2 };
          const bestId = motifIds.slice().sort((a, b) => {
            const ma = motifById.get(a)!;
            const mb = motifById.get(b)!;
            const tp = TIER_PRIO[ma.tier] - TIER_PRIO[mb.tier];
            if (tp !== 0) return tp;
            return mb.canonicalTokens.length - ma.canonicalTokens.length;
          })[0]!;

          const motif = motifById.get(bestId);
          if (!motif) continue;

          // Find the span on this line that contains this renderKey
          const span = motif.spans.find((s) => s.lineIdx === lineIdx && s.renderKeys.includes(rk));
          if (!span) continue;

          // Collect all renderKeys in this span as actual IPA tokens
          const tokens: string[] = [];
          for (const srk of span.renderKeys) {
            seenRenderKeys.add(srk);
            // parse renderKey: wordId:sylIdx:tokIdx
            const parts = srk.split(':');
            const sylIdx = parseInt(parts[parts.length - 2]!, 10);
            const tokIdx = parseInt(parts[parts.length - 1]!, 10);
            const ipaToken = tw.syllables[sylIdx]?.ipaTokens[tokIdx];
            if (ipaToken !== undefined) tokens.push(ipaToken);
          }

          if (tokens.length > 0) {
            groups.push({ orderKey: rk, motif, tokens });
          }
        }
      }
    }

    rows.push({ lineIdx, groups });
  }

  return rows;
});

function pillStyle(motif: PhonemeMotif): Record<string, string> {
  return { background: motif.color };
}
</script>

<style scoped lang="scss">
.rp-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f7f7fa;
  border-left: 1px solid rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

// ── empty ─────────────────────────────────────────────────────────────────────
.rp-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  text-align: center;
  color: rgba(0, 0, 0, 0.38);
  font-size: 0.76rem;
  line-height: 1.5;
}

// ── scroll container ──────────────────────────────────────────────────────────
.rp-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 6px 8px 20px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

// ── poem line row ─────────────────────────────────────────────────────────────
.rp-line {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  min-height: 26px;
  padding: 2px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);

  &__num {
    flex-shrink: 0;
    width: 20px;
    font-size: 0.58rem;
    font-variant-numeric: tabular-nums;
    color: rgba(0, 0, 0, 0.28);
    text-align: left;
    user-select: none;
  }

  &__body {
    flex: 1;
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: center;
    gap: 3px;
    min-width: 0;
  }

  &__empty {
    font-size: 0.68rem;
    color: rgba(0, 0, 0, 0.18);
    line-height: 1;
  }
}

// ── IPA rhyme pill ────────────────────────────────────────────────────────────
.rp-pill {
  display: inline-flex;
  align-items: center;
  padding: 1px 5px 2px;
  border-radius: 4px;
  font-family: 'Noto Serif', 'Georgia', serif;
  font-size: 0.82rem;
  color: rgba(0, 0, 0, 0.82);
  white-space: nowrap;
  cursor: default;
  line-height: 1.4;
}
</style>
