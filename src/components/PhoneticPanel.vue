<template>
  <div class="pp-root">
    <!-- Empty state -->
    <div v-if="allWordTokenCount === 0" class="pp-empty">
      <q-icon name="music_note" size="2.5rem" color="grey-7" />
      <p>Confirm each line to see its phonetic grid.</p>
    </div>

    <template v-else>
      <!-- Line-by-line grid + optional SVG overlay -->
      <div ref="gridContainer" class="pp-grid-wrap">
        <!-- SVG clustering web (sits on top, pointer-events:none) -->
        <svg
          v-if="showWeb"
          class="pp-web-svg"
          :width="svgSize.w"
          :height="svgSize.h"
          :viewBox="`0 0 ${svgSize.w} ${svgSize.h}`"
        >
          <line
            v-for="(seg, i) in webSegments"
            :key="i"
            :x1="seg.x1"
            :y1="seg.y1"
            :x2="seg.x2"
            :y2="seg.y2"
            :stroke="seg.color"
            :stroke-width="seg.width"
            :stroke-opacity="seg.opacity"
            stroke-linecap="round"
          />
        </svg>

        <!-- SVG rhyme web (connects same-group rhyme occurrences) -->
        <svg
          v-if="showRhymeWeb"
          class="pp-rhyme-web-svg"
          :width="rhymeWebSize.w"
          :height="rhymeWebSize.h"
          :viewBox="`0 0 ${rhymeWebSize.w} ${rhymeWebSize.h}`"
        >
          <path
            v-for="(seg, i) in rhymeWebPaths"
            :key="i"
            :d="seg.d"
            :stroke="seg.color"
            :stroke-opacity="seg.opacity"
            stroke-width="2.5"
            fill="none"
            stroke-linecap="round"
          />
        </svg>

        <div
          v-if="showGlobalMetric && overallMetricPct !== null"
          class="pp-global-metric"
          :style="overallMetricStyle"
          :title="overallMetricTitle"
        >
          <span class="pp-global-metric__label">{{ $t('metrics.globalScore') }}</span>
          <span class="pp-global-metric__value">{{ overallMetricPct }}%</span>
        </div>

        <div class="pp-lines" :class="{ 'pp-lines--right': alignRight }">
          <template v-for="(line, lineIdx) in visualizerDocument.lines" :key="line.id">
            <!-- Empty line (no tokens at all) → blank row -->
            <div v-if="line.tokens.length === 0" class="pp-blank-row" />

            <!-- TAB-only line with no words → compact blank row (indented empty line) -->
            <div
              v-else-if="wordTokensInLine(line).length === 0 && !isLineConfirmed(line.id)"
              class="pp-blank-row"
            />

            <!-- Unconfirmed line that has words → dim placeholder -->
            <div
              v-else-if="!isLineConfirmed(line.id)"
              :ref="(el) => setRowRef(lineIdx, el)"
              class="pp-row pp-row--pending"
              :class="{ 'pp-row--active': activeLineIndex === lineIdx }"
            >
              <span v-if="showNumBadge" class="pp-row__num">{{ lineIdx + 1 }}</span>
              <span v-if="showSylBadge" class="pp-row__syl" />
              <span v-if="showCvBadge" class="pp-row__cv" />
              <span class="pp-row__hint">· · ·</span>
            </div>

            <!-- Confirmed line → syllable cell row -->
            <div
              v-else
              :ref="(el) => setRowRef(lineIdx, el)"
              class="pp-row"
              :class="{ 'pp-row--active': activeLineIndex === lineIdx }"
            >
              <span v-if="showNumBadge" class="pp-row__num">{{ lineIdx + 1 }}</span>
              <span v-if="showSylBadge" class="pp-row__syl">{{ lineSyllableCount(line) }}</span>
              <span v-if="showCvBadge" class="pp-row__cv">{{ lineCvRatio(line) }}</span>
              <span
                v-if="lineRhythmLabel(lineIdx)"
                class="pp-row__rhythm"
                :title="lineRhythmTitle(lineIdx)"
                >{{ lineRhythmLabel(lineIdx) }}</span
              >
              <div class="pp-cells">
                <template
                  v-for="(item, itemIdx) in visualizationItems(line)"
                  :key="`${line.id}:${itemIdx}`"
                >
                  <div
                    v-if="item.type === 'tab' && !alignRight && bindTabs"
                    class="pp-cell pp-cell--tab"
                  />
                  <div
                    v-else-if="item.type === 'cell'"
                    class="pp-cell"
                    :class="{
                      'pp-cell--stressed': item.stressed,
                      'pp-cell--word-last': item.wordLast,
                    }"
                  >
                    <div class="pp-cell__tokens">
                      <span
                        v-for="(token, ti) in item.ipaTokens"
                        :key="ti"
                        :ref="
                          (el) =>
                            setTokenRef(item.renderKeys?.[ti] ?? `${line.id}:${itemIdx}:${ti}`, el)
                        "
                        class="pp-cell__token"
                        :class="
                          isVowelToken(token)
                            ? 'pp-cell__token--vowel'
                            : 'pp-cell__token--consonant'
                        "
                        :style="
                          showSounds
                            ? (tokenStyleMap.get(item.renderKeys?.[ti] ?? '') ?? undefined)
                            : undefined
                        "
                        >{{ token }}</span
                      >
                    </div>
                    <div
                      v-if="showRhymes && item.motifWordId"
                      class="pp-cell__rhyme-bar"
                      :class="{ 'pp-cell__rhyme-bar--word-last': item.wordLast }"
                      :style="engineRhymeBarStyle(line, item, item.motifWordId)"
                      :title="engineRhymeTitle(item.motifWordId)"
                    />
                    <!-- Label bubble: sibling of bar so it is NOT affected by bar's CSS opacity -->
                    <div
                      v-if="
                        showRhymes &&
                        item.motifWordId &&
                        isRhymeLabelCell(line, itemIdx, item.motifWordId)
                      "
                      :ref="(el) => setRhymeDotRef(item.motifWordId, el)"
                      class="pp-cell__rhyme-dot"
                      :style="engineRhymeDotStyle(line, itemIdx, item.motifWordId)"
                    >
                      {{ rhymeLabel(item.motifWordId) }}
                    </div>
                    <div
                      v-if="item.wordLast && item.motifWordId"
                      class="pp-cell__pause-mark"
                      :style="pauseMarkStyle(item.motifWordId)"
                      :title="pauseMarkTitle(item.motifWordId)"
                    />
                  </div>
                </template>
              </div>
            </div>
          </template>
        </div>
      </div>
    </template>

    <!-- Demo badge — always-visible notice in the bottom-right corner -->
    <div class="pp-demo-badge">
      Demo
      <q-tooltip anchor="top right" self="bottom right" :offset="[0, 6]" class="pp-demo-tooltip">
        <div class="pp-demo-tooltip__title">
          <q-icon name="science" size="16px" color="amber-4" class="q-mr-xs" />
          {{ $t('about.demoTitle') }}
        </div>
        <div class="pp-demo-tooltip__body">{{ $t('about.demoText') }}</div>
      </q-tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { watch, computed, ref, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { usePoetryStore } from 'src/stores/poetry';
import type { ILine, IWordToken } from 'src/model/Token';
import { ipaTokenColor, ipaTokenStyle, type TokenVisual } from 'src/services/phonetic/ipaColorMap';
import { generateVisualizationSvg, downloadSvg, textHash } from 'src/composables/useSvgExport';
import { buildVisualizationLineItems } from 'src/services/phonetic/visualizationLine';
import type { EchoAnnotation, StreamAnalysisResult } from 'src/services/phonetic/analysisTypes';
import type {
  EditorVisualizerChannel,
  PhoneticVisualizerInput,
} from 'src/components/visualizer/phoneticVisualizerContract';
import { analyzeRhymes } from 'src/services/phonetic/rhyme/rhymeAnalyzer';
import { dtwDistance } from 'src/services/phonetic/rhyme/motifFinder';
import { transcribeWord } from 'src/services/phonetic/wordTranscription';
import type { MotifTier, RhymeAnalysis } from 'src/services/phonetic/rhyme/types';

const props = defineProps<{
  input?: PhoneticVisualizerInput;
  editorChannel?: EditorVisualizerChannel;
}>();

const showWeb = defineModel<boolean>('showWeb', { default: false });
const alignRight = defineModel<boolean>('alignRight', { default: false });
const bindTabs = defineModel<boolean>('bindTabs', { default: true });
const showRhymes = defineModel<boolean>('showRhymes', { default: false });
const showRhymeWeb = defineModel<boolean>('showRhymeWeb', { default: false });
const rhymeMinLength = defineModel<number>('rhymeMinLength', { default: 3 });
const rhymeThreshold = defineModel<number>('rhymeThreshold', { default: 0.6 });
const showGlobalMetric = defineModel<boolean>('showGlobalMetric', { default: false });
const showSounds = defineModel<boolean>('showSounds', { default: true });
const alliterationThreshold = defineModel<number>('alliterationThreshold', { default: 0.35 });
const showNumBadge = defineModel<boolean>('showNumBadge', { default: true });
const showSylBadge = defineModel<boolean>('showSylBadge', { default: true });
const showCvBadge = defineModel<boolean>('showCvBadge', { default: true });

// Debounce rhyme min length so expensive analyzeRhymes() doesn't run on every
// keystroke — even with q-input debounce, step-button clicks and rapid typing
// can trigger multiple synchronous recomputes that freeze the UI.
const committedMinLength = ref(rhymeMinLength.value);
let commitMinLenTimer: ReturnType<typeof setTimeout>;
watch(
  rhymeMinLength,
  (val) => {
    clearTimeout(commitMinLenTimer);
    commitMinLenTimer = setTimeout(() => {
      committedMinLength.value = val;
    }, 400);
  },
  { immediate: true },
);
onBeforeUnmount(() => clearTimeout(commitMinLenTimer));

const store = usePoetryStore();

const fallbackInput = computed<PhoneticVisualizerInput>(() => ({
  document: store.document,
  allWordTokenCount: store.allWordTokens.length,
  activeLineIndex: store.activeLineIndex,
  rawText: store.rawText,
  analysisResult: store.analysisResult,
  isLineConfirmed: store.isLineConfirmed,
}));

const visualizerInput = computed<PhoneticVisualizerInput>(() => props.input ?? fallbackInput.value);
const visualizerDocument = computed(() => visualizerInput.value.document);
const allWordTokenCount = computed(() => visualizerInput.value.allWordTokenCount);
const activeLineIndex = computed(() => visualizerInput.value.activeLineIndex);

function isLineConfirmed(lineId: string): boolean {
  return visualizerInput.value.isLineConfirmed(lineId);
}

// ── Scroll sync ──────────────────────────────────────────────────────────────
const rowRefs = new Map<number, Element>();
function setRowRef(lineIdx: number, el: unknown) {
  if (el instanceof Element) rowRefs.set(lineIdx, el);
  else rowRefs.delete(lineIdx);
}

watch(activeLineIndex, (idx) => {
  if (idx === null) return;
  const el = rowRefs.get(idx);
  if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});

function wordTokensInLine(line: ILine): IWordToken[] {
  return line.tokens.filter((t): t is IWordToken => t.kind === 'WORD');
}

function lineSyllableCount(line: ILine): number {
  return visualizationItems(line).filter((item) => item.type === 'cell' && item.countsAsSyllable)
    .length;
}

function lineCvRatio(line: ILine): string {
  let vowels = 0;
  let consonants = 0;
  for (const item of visualizationItems(line)) {
    if (item.type !== 'cell') continue;
    for (const token of item.ipaTokens ?? []) {
      if (isVowelToken(token)) vowels++;
      else consonants++;
    }
  }
  if (vowels === 0) return consonants > 0 ? '∞' : '–';
  const r = consonants / vowels;
  return r % 1 === 0 ? String(r) : r.toFixed(1);
}

function visualizationItems(line: ILine) {
  return buildVisualizationLineItems(line);
}

const IPA_VOWEL_CHARS = new Set([
  'a',
  'e',
  'i',
  'o',
  'u',
  'æ',
  'ɛ',
  'ɪ',
  'ɒ',
  'ʌ',
  'ɑ',
  'ɔ',
  'ə',
  'ɜ',
  'ʊ',
  'iː',
  'uː',
  'aː',
  'eː',
  'oː',
  'ɑː',
  'ɔː',
  'ɜː',
  'eɪ',
  'aɪ',
  'ɔɪ',
  'aʊ',
  'oʊ',
  'ɪə',
  'eə',
  'ʊə',
  'ɔ̃',
  'ɛ̃',
  'ã',
  'õ',
  'ũ',
]);

function isVowelToken(token: string): boolean {
  return IPA_VOWEL_CHARS.has(token) || /[æɛɪɒʌɑɔəɜʊaeiouаеєиіїоуюя]/i.test(token[0] ?? '');
}

// ── Sound pattern analysis ───────────────────────────────────────────────────
interface IndexedToken {
  token: string;
  flatIdx: number;
  renderKey: string;
}

const indexedTokens = computed<IndexedToken[]>(() => {
  const result: IndexedToken[] = [];
  let flatIdx = 0;
  for (const line of visualizerDocument.value.lines) {
    if (!isLineConfirmed(line.id)) continue;
    for (const item of visualizationItems(line)) {
      if (item.type !== 'cell') continue;
      const ipaTokens = item.ipaTokens ?? [];
      const renderKeys = item.renderKeys ?? [];
      for (let ti = 0; ti < ipaTokens.length; ti++) {
        result.push({
          token: ipaTokens[ti]!,
          flatIdx,
          renderKey: renderKeys[ti] ?? `${line.id}:${flatIdx}:${ti}`,
        });
        flatIdx++;
      }
    }
  }
  return result;
});

const analysis = computed<StreamAnalysisResult | null>(() => visualizerInput.value.analysisResult);

const echoByFlatIndex = computed<Map<number, EchoAnnotation>>(() => {
  const map = new Map<number, EchoAnnotation>();
  for (const entry of analysis.value?.echo ?? []) {
    const flatIndex =
      (entry.source as { flatIndex?: number; flat_index?: number }).flatIndex ??
      (entry.source as { flatIndex?: number; flat_index?: number }).flat_index;
    if (typeof flatIndex === 'number') map.set(flatIndex, entry);
  }
  return map;
});

const echoByRenderKey = computed<Map<string, EchoAnnotation>>(() => {
  const map = new Map<string, EchoAnnotation>();
  for (const entry of analysis.value?.echo ?? []) {
    const src = entry.source as {
      wordId?: string;
      word_id?: string;
      syllableIndex?: number;
      syllable_index?: number;
      phonemeIndex?: number;
      phoneme_index?: number;
    };
    const wordId = src.wordId ?? src.word_id;
    const syllableIndex = src.syllableIndex ?? src.syllable_index;
    const phonemeIndex = src.phonemeIndex ?? src.phoneme_index;
    if (!wordId || typeof syllableIndex !== 'number' || typeof phonemeIndex !== 'number') {
      continue;
    }
    const key = `${wordId}:${syllableIndex}:${phonemeIndex}`;
    const prev = map.get(key);
    if (!prev || entry.opacity > prev.opacity) map.set(key, entry);
  }
  return map;
});

const echoOpacityByRenderKeyFromLayer = computed<Map<string, number>>(() => {
  const map = new Map<string, number>();
  const entries = ((analysis.value as { phonemes?: { entries?: unknown[] } } | null)?.phonemes
    ?.entries ?? []) as Array<{
    source?: {
      wordId?: string;
      word_id?: string;
      syllableIndex?: number;
      syllable_index?: number;
      phonemeIndex?: number;
      phoneme_index?: number;
    };
    computedMetrics?: { echoOpacity?: number };
    computed_metrics?: { echo_opacity?: number };
  }>;

  for (const entry of entries) {
    const source = entry.source;
    const wordId = source?.wordId ?? source?.word_id;
    const syllableIndex = source?.syllableIndex ?? source?.syllable_index;
    const phonemeIndex = source?.phonemeIndex ?? source?.phoneme_index;
    const opacity = entry.computedMetrics?.echoOpacity ?? entry.computed_metrics?.echo_opacity;
    if (!wordId || typeof syllableIndex !== 'number' || typeof phonemeIndex !== 'number') continue;
    if (typeof opacity !== 'number' || Number.isNaN(opacity)) continue;
    const key = `${wordId}:${syllableIndex}:${phonemeIndex}`;
    const prev = map.get(key) ?? 0;
    if (opacity > prev) map.set(key, opacity);
  }
  return map;
});

const pauseStrengthByWordId = computed<Map<string, number>>(() => {
  const map = new Map<string, number>();
  for (const pause of analysis.value?.pauses ?? []) {
    const current = map.get(pause.afterWordId) ?? 0;
    if (pause.strength > current) map.set(pause.afterWordId, pause.strength);
  }
  return map;
});

const rhythmByEngineLineIndex = computed(() => {
  const map = new Map<number, StreamAnalysisResult['rhythm'][number]>();
  for (const line of analysis.value?.rhythm ?? []) {
    map.set(line.lineIndex, line);
  }
  return map;
});

function confirmedLineOrdinal(lineIdx: number): number {
  let ordinal = -1;
  for (let i = 0; i <= lineIdx; i++) {
    const line = visualizerDocument.value.lines[i];
    if (line && isLineConfirmed(line.id)) ordinal++;
  }
  return ordinal;
}

function lineRhythmLabel(lineIdx: number): string {
  const ordinal = confirmedLineOrdinal(lineIdx);
  if (ordinal < 0) return '';
  const rhythm = rhythmByEngineLineIndex.value.get(ordinal);
  if (!rhythm) return '';
  const foot = rhythm.period === 2 ? '2-beat' : '3-beat';
  return `${foot} · ${rhythm.clausula} · ${Math.round(rhythm.confidence * 100)}%`;
}

function lineRhythmTitle(lineIdx: number): string {
  const ordinal = confirmedLineOrdinal(lineIdx);
  if (ordinal < 0) return '';
  const rhythm = rhythmByEngineLineIndex.value.get(ordinal);
  if (!rhythm) return '';
  return `Period ${rhythm.period}, phase ${rhythm.phase}, clausula ${rhythm.clausula}, confidence ${rhythm.confidence.toFixed(2)}, syllables ${rhythm.syllableCount}`;
}

const overallMetric = computed<number | null>(() => {
  const global = analysis.value?.structurality?.global;
  if (typeof global !== 'number' || Number.isNaN(global)) return null;
  return Math.max(0, Math.min(1, global));
});

const overallMetricPct = computed<number | null>(() => {
  const global = overallMetric.value;
  if (global === null) return null;
  return Math.round(global * 100);
});

const overallMetricStyle = computed<Record<string, string>>(() => {
  const global = overallMetric.value ?? 0;
  const hue = Math.round(global * 120);
  return {
    borderColor: `hsl(${hue}, 70%, 44%)`,
    background: `linear-gradient(135deg, hsla(${hue}, 80%, 50%, 0.16), rgba(255, 255, 255, 0.92))`,
    boxShadow: `0 4px 14px hsla(${hue}, 80%, 35%, 0.18)`,
  };
});

const overallMetricTitle = computed<string>(() => {
  const pct = overallMetricPct.value;
  if (pct === null) return '';
  return `${pct}%`;
});

const tokenStyleMap = computed<Map<string, TokenVisual>>(() => {
  const map = new Map<string, TokenVisual>();
  const threshold = Math.max(0.05, Math.min(0.8, alliterationThreshold.value));
  for (const { token, flatIdx, renderKey } of indexedTokens.value) {
    const rawOpacity =
      echoOpacityByRenderKeyFromLayer.value.get(renderKey) ??
      echoByRenderKey.value.get(renderKey)?.opacity ??
      echoByFlatIndex.value.get(flatIdx)?.opacity;
    if (rawOpacity === undefined || rawOpacity < threshold) continue;
    const normalised = (rawOpacity - threshold) / Math.max(0.0001, 1 - threshold);
    const visual = ipaTokenStyle(token, Math.max(0.05, Math.min(1, normalised)));
    if (visual) map.set(renderKey, visual);
  }
  return map;
});

const RHYME_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function buildGroupsFromPairs(
  res: StreamAnalysisResult,
  threshold: number,
  minLength: number,
): Map<string, EngineRhymeEntry> {
  const pairs = (res.rhyme_pairs ?? []).filter(
    (pair) =>
      pair.similarity >= threshold &&
      Math.min(pair.codaLengthA ?? 0, pair.codaLengthB ?? 0) >= minLength,
  );
  if (pairs.length === 0) return new Map();

  const adj = new Map<string, Set<string>>();
  const bestByWord = new Map<string, number>();

  for (const pair of pairs) {
    const a = pair.wordIdA;
    const b = pair.wordIdB;
    if (!a || !b || a === b) continue;

    const aSet = adj.get(a) ?? new Set<string>();
    aSet.add(b);
    adj.set(a, aSet);

    const bSet = adj.get(b) ?? new Set<string>();
    bSet.add(a);
    adj.set(b, bSet);

    bestByWord.set(a, Math.max(bestByWord.get(a) ?? 0, pair.similarity));
    bestByWord.set(b, Math.max(bestByWord.get(b) ?? 0, pair.similarity));
  }

  const out = new Map<string, EngineRhymeEntry>();
  const visited = new Set<string>();
  let groupIdx = 0;

  for (const wordId of adj.keys()) {
    if (visited.has(wordId)) continue;

    const stack = [wordId];
    const members: string[] = [];
    visited.add(wordId);

    while (stack.length > 0) {
      const current = stack.pop()!;
      members.push(current);
      for (const next of adj.get(current) ?? []) {
        if (visited.has(next)) continue;
        visited.add(next);
        stack.push(next);
      }
    }

    if (members.length < 2) continue;

    const label = RHYME_LABELS[groupIdx % RHYME_LABELS.length] ?? String(groupIdx + 1);
    const color = `hsl(${groupHue(label)} 72% 52%)`;
    groupIdx++;

    for (const member of members) {
      out.set(member, {
        label,
        color,
        score: Math.max(0.2, Math.min(1, bestByWord.get(member) ?? threshold)),
      });
    }
  }

  return out;
}

// ── Engine-driven annotation layer ───────────────────────────────────────────

function groupHue(group: string): number {
  let hash = 0;
  for (let i = 0; i < group.length; i++) hash = (hash * 31 + group.charCodeAt(i)) >>> 0;
  return hash % 360;
}

// ── Local rhyme analysis (reliable, always available) ─────────────────────────

const TIER_PRIO: Record<MotifTier, number> = { exact: 0, near: 1, structural: 2 };

interface EngineRhymeEntry {
  label: string;
  color: string;
  score: number;
}

interface WordRhymeEntry {
  color: string;
  opacity: number;
  tier: MotifTier;
  label: string;
  motifId: string;
  renderKeys: Set<string>;
}

function normalizeRhymeThreshold(value: number): number {
  if (Number.isNaN(value)) return 0.6;
  return Math.max(0, Math.min(1, value));
}

function normalizeMinRhymeLength(value: number): number {
  if (Number.isNaN(value)) return 3;
  return Math.max(1, Math.floor(value));
}

/**
 * Build the engine rhyme word map from local motif analysis when available,
 * falling back to rhyme_pairs or engine annotations.
 *
 * NOTE: This uses the *same* `localRhymeAnalysis` computed as the bar/label
 * rendering, so `analyzeRhymes()` runs only ONCE per reactive flush instead
 * of twice — crucial for avoiding UI freezes on threshold changes.
 */
const engineRhymeWordMap = computed<Map<string, EngineRhymeEntry>>(() => {
  const res = analysis.value;
  if (!res) return new Map();

  const threshold = normalizeRhymeThreshold(rhymeThreshold.value);
  const minLength = normalizeMinRhymeLength(committedMinLength.value);

  // Primary path: use DTW-based word similarity grouping from the local
  // motif analysis.  Instead of grouping by motif label (which is fixed
  // regardless of the Similarity ≥ slider), we compute pairwise phonetic
  // similarity between all words that participate in ANY motif, then form
  // connected components where similarity >= threshold.
  //
  // This makes the "Similarity ≥" slider directly control group merging:
  //   high threshold → only nearly identical words group together
  //   low threshold  → phonetically distant words merge into one group
  const ra = localRhymeAnalysis.value;
  if (ra && ra.motifs.length > 0) {
    // Collect unique wordIds from all motif spans.
    const wordIds = new Set<string>();
    for (const motif of ra.motifs) {
      for (const span of motif.spans) wordIds.add(span.wordId);
    }
    if (wordIds.size < 2) return new Map();

    // Build full IPA token sequence for each word.
    const wordIpa = new Map<string, string[]>();
    for (const wordId of wordIds) {
      const tok = visualizerDocument.value.tokenIndex.get(wordId);
      if (!tok || tok.kind !== 'WORD') continue;
      const tw = transcribeWord(tok);
      const tokens: string[] = [];
      for (const syl of tw.syllables) tokens.push(...syl.ipaTokens);
      wordIpa.set(wordId, tokens);
    }

    // Build the best-motif info per word (for label/color assignment later).
    const wordBestMotif = new Map<string, { label: string; color: string; score: number }>();
    for (const motif of ra.motifs) {
      for (const span of motif.spans) {
        if (!wordBestMotif.has(span.wordId)) {
          wordBestMotif.set(span.wordId, {
            label: motif.label,
            color: motif.color,
            score: motif.opacity,
          });
        }
      }
    }

    // Compute pairwise DTW similarity and build adjacency graph.
    const wordArr = [...wordIds];
    const adj = new Map<string, Set<string>>();
    for (let i = 0; i < wordArr.length; i++) {
      for (let j = i + 1; j < wordArr.length; j++) {
        const a = wordArr[i]!;
        const b = wordArr[j]!;
        const ipaA = wordIpa.get(a);
        const ipaB = wordIpa.get(b);
        if (!ipaA || !ipaB) continue;
        const dist = dtwDistance(ipaA, ipaB);
        if (1 - dist >= threshold) {
          let s = adj.get(a);
          if (!s) {
            s = new Set();
            adj.set(a, s);
          }
          s.add(b);
          s = adj.get(b);
          if (!s) {
            s = new Set();
            adj.set(b, s);
          }
          s.add(a);
        }
      }
    }

    // Connected components = rhyme groups.
    const visited = new Set<string>();
    const groups: string[][] = [];
    for (const wordId of wordIds) {
      if (visited.has(wordId)) continue;
      const stack = [wordId];
      const group: string[] = [];
      visited.add(wordId);
      while (stack.length > 0) {
        const cur = stack.pop()!;
        group.push(cur);
        for (const next of adj.get(cur) ?? []) {
          if (!visited.has(next)) {
            visited.add(next);
            stack.push(next);
          }
        }
      }
      if (group.length >= 2) groups.push(group);
    }

    if (groups.length === 0) return new Map();

    // Assign group labels (A, B, C …) and pick a representative color.
    const out = new Map<string, EngineRhymeEntry>();
    for (let gi = 0; gi < groups.length; gi++) {
      const groupLabel = RHYME_LABELS[gi % RHYME_LABELS.length] ?? String(gi + 1);
      let bestScore = 0;
      let groupColor = `hsl(${(gi * 137.5) % 360}, 72%, 52%)`;
      for (const wordId of groups[gi]!) {
        const info = wordBestMotif.get(wordId);
        if (info && info.score > bestScore) {
          bestScore = info.score;
          groupColor = info.color;
        }
      }
      for (const wordId of groups[gi]!) {
        const info = wordBestMotif.get(wordId);
        out.set(wordId, {
          label: groupLabel,
          color: groupColor,
          score: Math.max(0.2, info?.score ?? 0.5),
        });
      }
    }
    if (out.size > 0) return out;
  }

  // Fallback: DTW-based grouping on ALL words in the document.
  // This handles the case where minLength is too high for the motif
  // finder to find shared patterns (e.g. only ɔn shared across words,
  // but minLength=3), yet we still want the Similarity ≥ slider to
  // control phonetic merge distance.
  const allWordIds = new Set<string>();
  for (const line of visualizerDocument.value.lines) {
    if (!isLineConfirmed(line.id)) continue;
    for (const tok of line.tokens) {
      if (tok.kind === 'WORD' && /[А-ЯЄІЇҐа-яєіїґA-Za-z]/.test(tok.text)) {
        allWordIds.add(tok.id);
      }
    }
  }
  if (allWordIds.size >= 2) {
    const wordIpa = new Map<string, string[]>();
    for (const wordId of allWordIds) {
      const tok = visualizerDocument.value.tokenIndex.get(wordId);
      if (!tok || tok.kind !== 'WORD') continue;
      const tw = transcribeWord(tok);
      const tokens: string[] = [];
      for (const syl of tw.syllables) tokens.push(...syl.ipaTokens);
      wordIpa.set(wordId, tokens);
    }
    const wordArr = [...allWordIds];
    const adj = new Map<string, Set<string>>();
    for (let i = 0; i < wordArr.length; i++) {
      for (let j = i + 1; j < wordArr.length; j++) {
        const a = wordArr[i]!;
        const b = wordArr[j]!;
        const ipaA = wordIpa.get(a);
        const ipaB = wordIpa.get(b);
        if (!ipaA || !ipaB) continue;
        const dist = dtwDistance(ipaA, ipaB);
        if (1 - dist >= threshold) {
          let s = adj.get(a);
          if (!s) {
            s = new Set();
            adj.set(a, s);
          }
          s.add(b);
          s = adj.get(b);
          if (!s) {
            s = new Set();
            adj.set(b, s);
          }
          s.add(a);
        }
      }
    }
    const visited = new Set<string>();
    const groups: string[][] = [];
    for (const wordId of allWordIds) {
      if (visited.has(wordId)) continue;
      const stack = [wordId];
      const group: string[] = [];
      visited.add(wordId);
      while (stack.length > 0) {
        const cur = stack.pop()!;
        group.push(cur);
        for (const next of adj.get(cur) ?? []) {
          if (!visited.has(next)) {
            visited.add(next);
            stack.push(next);
          }
        }
      }
      if (group.length >= 2) groups.push(group);
    }
    if (groups.length > 0) {
      const out = new Map<string, EngineRhymeEntry>();
      for (let gi = 0; gi < groups.length; gi++) {
        const groupLabel = RHYME_LABELS[gi % RHYME_LABELS.length] ?? String(gi + 1);
        const color = `hsl(${groupHue(groupLabel)} 72% 52%)`;
        for (const wordId of groups[gi]!) {
          out.set(wordId, { label: groupLabel, color, score: threshold });
        }
      }
      if (out.size > 0) return out;
    }
  }

  // Last-resort: pair-based grouping from WASM engine.
  const fromPairs = buildGroupsFromPairs(res, threshold, minLength);
  if (fromPairs.size > 0) return fromPairs;

  // Last fallback: use the engine's rhymeGroup annotations directly.
  const byGroup = new Map<string, string[]>();
  for (const [wordId, ann] of Object.entries(res.annotations ?? {})) {
    if (!ann.rhymeGroup) continue;
    const score = ann.rhymeScore;
    if (score !== null && score !== undefined && score < threshold) continue;
    const list = byGroup.get(ann.rhymeGroup) ?? [];
    list.push(wordId);
    byGroup.set(ann.rhymeGroup, list);
  }

  const out2 = new Map<string, EngineRhymeEntry>();
  for (const [label, members] of byGroup) {
    if (members.length < 2) continue;
    const color = `hsl(${groupHue(label)} 72% 52%)`;
    for (const cid of members) {
      const ann = res.annotations[cid];
      out2.set(cid, {
        label,
        color,
        score: Math.max(0.2, Math.min(1, ann?.rhymeScore ?? threshold)),
      });
    }
  }

  return out2;
});

/** Single analyzeRhymes call shared by the bar map and the rhyme web. */
const localRhymeAnalysis = computed<RhymeAnalysis | null>(() => {
  if (!showRhymes.value && !showRhymeWeb.value) return null;
  return analyzeRhymes(visualizerDocument.value, isLineConfirmed, {
    minLength: normalizeMinRhymeLength(committedMinLength.value),
    similarityThreshold: normalizeRhymeThreshold(rhymeThreshold.value),
    mode: 'sounds',
  });
});

const localRhymeWordMap = computed<Map<string, WordRhymeEntry>>(() => {
  const ra = localRhymeAnalysis.value;
  if (!ra) return new Map();
  const map = new Map<string, WordRhymeEntry>();
  for (const motif of ra.motifs) {
    for (const span of motif.spans) {
      if (!engineRhymeWordMap.value.has(span.wordId)) continue;
      const existing = map.get(span.wordId);
      if (!existing || TIER_PRIO[motif.tier] < TIER_PRIO[existing.tier]) {
        map.set(span.wordId, {
          color: motif.color,
          opacity: motif.opacity,
          tier: motif.tier,
          label: motif.label,
          motifId: motif.id,
          renderKeys: new Set(span.renderKeys),
        });
      }
    }
  }
  return map;
});

/**
 * Returns true for the one cell (the center syllable of a word) where the
 * group-label bubble is rendered.
 */
function isRhymeLabelCell(line: ILine, itemIdx: number, wordId: string | undefined): boolean {
  if (!wordId) return false;
  const cells = wordCells(line, wordId);
  if (cells.length === 0) return false;
  // Dot owner is the first cell of the word; left offset places it on actual rhyme midpoint.
  return itemIdx === cells[0]!.itemIdx;
}

function rhymeLabel(wordId: string): string {
  const engine = engineRhymeWordMap.value.get(wordId);
  if (engine) return engine.label;
  return '';
}

interface WordCellMeta {
  itemIdx: number;
  renderKeys: string[];
}

function wordCells(line: ILine, wordId: string): WordCellMeta[] {
  const items = visualizationItems(line);
  const out: WordCellMeta[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it?.type !== 'cell' || it.motifWordId !== wordId) continue;
    out.push({ itemIdx: i, renderKeys: [...(it.renderKeys ?? [])] });
  }
  return out;
}

function localWordRhymeBounds(line: ILine, wordId: string): { start: number; end: number } | null {
  const local = localRhymeWordMap.value.get(wordId);
  if (!local) return null;
  const cells = wordCells(line, wordId);
  if (cells.length === 0) return null;

  let minEdge = Number.POSITIVE_INFINITY;
  let maxEdge = Number.NEGATIVE_INFINITY;

  for (let ci = 0; ci < cells.length; ci++) {
    const cell = cells[ci]!;
    const tokenCount = Math.max(1, cell.renderKeys.length);
    for (let ti = 0; ti < cell.renderKeys.length; ti++) {
      const rk = cell.renderKeys[ti]!;
      if (!local.renderKeys.has(rk)) continue;
      const left = ci + ti / tokenCount;
      const right = ci + (ti + 1) / tokenCount;
      if (left < minEdge) minEdge = left;
      if (right > maxEdge) maxEdge = right;
    }
  }

  if (!Number.isFinite(minEdge) || !Number.isFinite(maxEdge)) return null;
  return { start: minEdge, end: maxEdge };
}

function cellLocalRhymeSegment(
  line: ILine,
  wordId: string,
  itemRenderKeys: string[] | undefined,
): { leftPct: number; rightPct: number } | null {
  const local = localRhymeWordMap.value.get(wordId);
  if (!local || !itemRenderKeys || itemRenderKeys.length === 0) return null;

  const matched: number[] = [];
  for (let i = 0; i < itemRenderKeys.length; i++) {
    if (local.renderKeys.has(itemRenderKeys[i]!)) matched.push(i);
  }
  if (matched.length === 0) return null;

  const tokenCount = itemRenderKeys.length;
  const first = matched[0]!;
  const last = matched[matched.length - 1]!;
  const leftPct = (first / tokenCount) * 100;
  const rightPct = ((tokenCount - (last + 1)) / tokenCount) * 100;
  return { leftPct, rightPct };
}

function engineRhymeBarStyle(
  line: ILine,
  item: { renderKeys?: string[] },
  wordId: string,
): Record<string, string> {
  const engine = engineRhymeWordMap.value.get(wordId);
  if (!engine) return { display: 'none' };

  // Use local motif geometry when available, but keep engine group color/score.
  const local = localRhymeWordMap.value.get(wordId);
  if (local) {
    const seg = cellLocalRhymeSegment(line, wordId, item.renderKeys);
    if (!seg) return { display: 'none' };
    return {
      background: engine.color,
      opacity: String(Math.max(local.opacity, engine.score)),
      left: `${seg.leftPct.toFixed(3)}%`,
      right: `${seg.rightPct.toFixed(3)}%`,
    };
  }

  return {
    background: engine.color,
    opacity: String(engine.score),
  };
}

/** Opaque dot style — NOT affected by the bar's CSS opacity since it is a sibling element. */
function engineRhymeDotStyle(line: ILine, itemIdx: number, wordId: string): Record<string, string> {
  const engine = engineRhymeWordMap.value.get(wordId);
  if (!engine) return { display: 'none' };

  const local = localRhymeWordMap.value.get(wordId);
  if (local) {
    const bounds = localWordRhymeBounds(line, wordId);
    const cells = wordCells(line, wordId);
    if (!bounds || cells.length === 0) return { background: engine.color };
    const ownerIdx = cells[0]!.itemIdx;
    if (ownerIdx !== itemIdx) return { display: 'none' };
    const midpoint = (bounds.start + bounds.end) / 2;
    const leftPct = midpoint * 100;
    return { background: engine.color, left: `${leftPct.toFixed(3)}%` };
  }
  return { background: engine.color };
}

function engineRhymeTitle(wordId: string): string {
  const engine = engineRhymeWordMap.value.get(wordId);
  if (!engine) return '';

  const local = localRhymeWordMap.value.get(wordId);
  const ann = analysis.value?.annotations[wordId];
  const parts: string[] = [];

  parts.push(`Rhyme ${engine.label} (score ${(engine.score ?? 0).toFixed(2)})`);
  parts.push(
    `Filters: group score ≥ ${normalizeRhymeThreshold(rhymeThreshold.value).toFixed(2)}, local motif length ≥ ${normalizeMinRhymeLength(rhymeMinLength.value)}`,
  );

  if (local) {
    parts.push(`Local rhyme ${local.label} [${local.tier}]`);
  }

  if (ann?.rhymeScore !== null && ann?.rhymeScore !== undefined) {
    parts.push(`Best engine pair score ${ann.rhymeScore.toFixed(2)}`);
  }

  if (ann?.structuralRhymeGroup) {
    parts.push(`Structural rhyme ${ann.structuralRhymeGroup}`);
  }

  return parts.join(' · ');
}

// ── Rhyme dot refs (for rhyme-web connection endpoints) ───────────────────────

const rhymeDotElems = new Map<string, Element>();
function setRhymeDotRef(wordId: string | undefined, el: unknown) {
  if (!wordId) return;
  if (el instanceof Element) rhymeDotElems.set(wordId, el);
  else rhymeDotElems.delete(wordId);
}

function pauseMarkStyle(wordId: string): Record<string, string> {
  const strength = pauseStrengthByWordId.value.get(wordId);
  if (strength === undefined || strength <= 0) return { display: 'none' };
  const width = Math.max(1, Math.round(strength * 6));
  return {
    width: `${width}px`,
    opacity: `${Math.max(0.25, strength)}`,
  };
}

function pauseMarkTitle(wordId: string): string {
  const strength = pauseStrengthByWordId.value.get(wordId);
  if (strength === undefined || strength <= 0) return '';
  return `Pause strength ${strength.toFixed(2)}`;
}

// ── Clustering web ───────────────────────────────────────────────────────────
const gridContainer = ref<HTMLElement | null>(null);

/** renderKey → span element (set by :ref callbacks in template) */
const tokenElems = new Map<string, Element>();
function setTokenRef(key: string, el: unknown) {
  if (el instanceof Element) tokenElems.set(key, el);
  else tokenElems.delete(key);
}

interface WebSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
  opacity: number;
}

const svgSize = ref({ w: 0, h: 0 });
const webSegments = ref<WebSegment[]>([]);

const patterningSounds = computed<Set<string>>(() => {
  const threshold = Math.max(0.05, Math.min(0.8, alliterationThreshold.value));
  const byToken = new Map<string, { sum: number; count: number }>();
  for (const item of indexedTokens.value) {
    const opacity = echoByFlatIndex.value.get(item.flatIdx)?.opacity;
    if (opacity === undefined) continue;
    const agg = byToken.get(item.token) ?? { sum: 0, count: 0 };
    agg.sum += opacity;
    agg.count += 1;
    byToken.set(item.token, agg);
  }
  const out = new Set<string>();
  for (const [token, agg] of byToken) {
    if (agg.count > 0 && agg.sum / agg.count >= threshold) out.add(token);
  }
  return out;
});

function rebuildWeb() {
  const container = gridContainer.value;
  if (!container || !showWeb.value) {
    webSegments.value = [];
    return;
  }

  // Canvas must cover the full scrollable content height
  svgSize.value = { w: container.clientWidth, h: container.scrollHeight };

  if (patterningSounds.value.size === 0) {
    webSegments.value = [];
    return;
  }

  const containerRect = container.getBoundingClientRect();
  const scrollTop = container.scrollTop;

  // Collect scroll-adjusted center point for every patterning token
  const byToken = new Map<string, Array<{ x: number; y: number; flatIdx: number }>>();
  for (const { token, flatIdx, renderKey } of indexedTokens.value) {
    if (!patterningSounds.value.has(token)) continue;
    const el = tokenElems.get(renderKey);
    if (!el) continue;
    const er = el.getBoundingClientRect();
    const x = er.left - containerRect.left + er.width / 2;
    const y = er.top - containerRect.top + er.height / 2 + scrollTop;
    let list = byToken.get(token);
    if (!list) {
      list = [];
      byToken.set(token, list);
    }
    list.push({ x, y, flatIdx });
  }

  const segs: WebSegment[] = [];
  for (const [token, pts] of byToken) {
    for (let k = 0; k + 1 < pts.length; k++) {
      const a = pts[k]!;
      const b = pts[k + 1]!;
      const gap = b.flatIdx - a.flatIdx - 1; // tokens between the pair
      const opacity = Math.max(0.05, Math.exp(-gap / 8));
      const width = 1 + opacity * 2.5; // 1 – 3.5 px
      const color = ipaTokenColor(token, 1) ?? '#000';
      segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, color, width, opacity });
    }
  }
  webSegments.value = segs;
}

watch([showWeb, indexedTokens, patterningSounds], async () => {
  if (!showWeb.value) {
    webSegments.value = [];
    return;
  }
  await nextTick();
  rebuildWeb();
});

// ── Rhyme web (connecting same-group rhyme occurrences) ───────────────────────

interface RhymeWebPath {
  d: string;
  color: string;
  opacity: number;
}

const rhymeWebSize = ref({ w: 0, h: 0 });
const rhymeWebPaths = ref<RhymeWebPath[]>([]);

function rebuildRhymeWeb() {
  const container = gridContainer.value;
  if (!container || !showRhymeWeb.value) {
    rhymeWebPaths.value = [];
    return;
  }
  rhymeWebSize.value = { w: container.clientWidth, h: container.scrollHeight };

  const groups = engineRhymeWordMap.value;
  if (groups.size === 0) {
    rhymeWebPaths.value = [];
    return;
  }

  const containerRect = container.getBoundingClientRect();
  const scrollTop = container.scrollTop;
  const paths: RhymeWebPath[] = [];

  interface DotPoint {
    wordId: string;
    el: Element;
    lineIndex: number;
    wordIndex: number;
    score: number;
    color: string;
  }

  const byLabel = new Map<string, DotPoint[]>();
  const annotations = analysis.value?.annotations ?? {};

  for (const [wordId, group] of groups) {
    const el = rhymeDotElems.get(wordId);
    const ann = annotations[wordId];
    if (!el || !ann) continue;
    const list = byLabel.get(group.label) ?? [];
    list.push({
      wordId,
      el,
      lineIndex: ann.lineIndex,
      wordIndex: ann.wordIndex,
      score: group.score,
      color: group.color,
    });
    byLabel.set(group.label, list);
  }

  for (const dots of byLabel.values()) {
    if (dots.length < 2) continue;
    dots.sort((a, b) =>
      a.lineIndex - b.lineIndex !== 0 ? a.lineIndex - b.lineIndex : a.wordIndex - b.wordIndex,
    );

    for (let k = 0; k + 1 < dots.length; k++) {
      const a = dots[k]!;
      const b = dots[k + 1]!;
      const ra2 = a.el.getBoundingClientRect();
      const rb = b.el.getBoundingClientRect();
      const ax = ra2.left - containerRect.left + ra2.width / 2;
      const ay = ra2.top - containerRect.top + ra2.height / 2 + scrollTop;
      const bx = rb.left - containerRect.left + rb.width / 2;
      const by2 = rb.top - containerRect.top + rb.height / 2 + scrollTop;

      const cy = (ay + by2) / 2;
      const d = `M ${ax} ${ay} C ${ax} ${cy}, ${bx} ${cy}, ${bx} ${by2}`;
      paths.push({
        d,
        color: a.color,
        opacity: Math.max(0.3, Math.min(1, (a.score + b.score) / 2)),
      });
    }
  }
  rhymeWebPaths.value = paths;
}

watch([showRhymeWeb, engineRhymeWordMap], async () => {
  if (!showRhymeWeb.value) {
    rhymeWebPaths.value = [];
    return;
  }
  await nextTick();
  rebuildRhymeWeb();
});

let ro: ResizeObserver | null = null;
onMounted(() => {
  ro = new ResizeObserver(() => {
    if (showWeb.value) void nextTick().then(rebuildWeb);
    if (showRhymeWeb.value) void nextTick().then(rebuildRhymeWeb);
  });
  if (gridContainer.value) ro.observe(gridContainer.value);
});
onBeforeUnmount(() => {
  ro?.disconnect();
});

// ── SVG Export ───────────────────────────────────────────────────────────────

function exportSvg(): void {
  const rawText = visualizerInput.value.rawText;
  const hash = textHash(rawText);
  const analyzerVersion = analysis.value?.analyzer?.version ?? '';
  const svg = generateVisualizationSvg(
    visualizerDocument.value.lines,
    isLineConfirmed,
    tokenStyleMap.value,
    '',
    analyzerVersion,
  );
  downloadSvg(svg, `phonetic-${hash}.svg`);
}
defineExpose({ exportSvg });
</script>

<style scoped lang="scss">
// ── sizing ────────────────────────────────────────────────────────────────────
//
// $cell-w  — every syllable cell is EXACTLY this wide, across ALL lines.
// This makes the grid align like a spreadsheet: column N of line 1 is the
// same horizontal position as column N of line 2.
//
$cell-w: 52px; // fixed cell width  (left/right sides)
$cell-h: 38px; // fixed cell height (top/bottom sides — taller than wide)
$border-col: #000000;
$cell-bg: transparent;
$stressed-bg: rgba(0, 0, 0, 0.3);
$stressed-fg: #ffffff;
$text-dim: rgba(0, 0, 0, 0.3);
$text-faint: rgba(0, 0, 0, 0.18);
$vowel-col: #b8860b; // dark goldenrod — readable on white
$consonant-col: rgba(0, 0, 0, 0.75);

// ── root ────────────────────────────────────────────────────────────────────────────────
.pp-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 10px 14px 10px;
  box-sizing: border-box;
  overflow: hidden; // scrolling is handled by pp-grid-wrap
  position: relative; // anchor for demo badge
}

// ── Demo badge ───────────────────────────────────────────────────────────────
.pp-demo-badge {
  position: absolute;
  bottom: 8px;
  right: 10px;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(180, 30, 30, 0.5);
  padding: 2px 6px;
  border: 1px solid rgba(180, 30, 30, 0.25);
  border-radius: 3px;
  user-select: none;
  background: rgba(255, 255, 255, 0.85);
  z-index: 20;
  cursor: help;
}

.pp-demo-tooltip {
  max-width: 320px;
  padding: 10px 12px;
  background: #1e2330;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.65);

  &__title {
    font-size: 0.85rem;
    font-weight: 700;
    color: #ffd54f;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
  }

  &__body {
    font-size: 0.78rem;
    line-height: 1.5;
    color: #c9d1d9;
    white-space: normal;
  }
}

// ── grid wrapper (scrollable) ────────────────────────────────────────────────
.pp-grid-wrap {
  position: relative; // SVG is absolutely positioned inside this
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

// ── web SVG overlay ───────────────────────────────────────────────────────────
.pp-web-svg {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  overflow: visible;
  z-index: 10;
}

// ── rhyme web SVG overlay (below phoneme web, above bars) ────────────────────
.pp-rhyme-web-svg {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  overflow: visible;
  z-index: 9;
}

// ── compact global metric chip (HTML overlay, not part of SVG export) ──────
.pp-global-metric {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 12;
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  padding: 3px 8px;
  border: 1px solid transparent;
  border-radius: 999px;
  pointer-events: none;
  user-select: none;

  &__label {
    font-size: 0.56rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(0, 0, 0, 0.65);
    font-weight: 700;
  }

  &__value {
    font-size: 0.82rem;
    font-weight: 900;
    color: rgba(0, 0, 0, 0.86);
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
}

// ── empty ─────────────────────────────────────────────────────────────────────
.pp-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: rgba(255, 255, 255, 0.2);
  font-size: 0.82rem;
  text-align: center;
}

// ── lines list ────────────────────────────────────────────────────────────────
.pp-lines {
  display: flex;
  flex-direction: column;
  gap: 5px;

  &--right {
    align-items: flex-end;

    .pp-row {
      flex-direction: row-reverse;
    }
  }
}

.pp-blank-row {
  height: 12px;
}

// ── row ───────────────────────────────────────────────────────────────────────
.pp-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;

  &--pending {
    opacity: 0.18;
  }

  &--active {
    background: rgba(255, 255, 255, 0.04);
    border-radius: 3px;
  }

  &__num,
  &__syl,
  &__cv,
  &__rhythm {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    font-size: 0.78rem;
    font-weight: 700;
    font-family: inherit;
    font-variant-numeric: tabular-nums;
    color: #fff;
    user-select: none;
    background: $border-col;
  }

  &__num {
    border-radius: 4px;
  }

  &__syl {
    border-radius: 50%;
  }

  &__cv {
    clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
  }

  &__rhythm {
    width: 84px;
    padding: 0 10px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.14);
    font-size: 0.66rem;
    letter-spacing: 0.02em;
  }

  &__hint {
    font-size: 0.72rem;
    color: rgba(255, 255, 255, 0.22);
    letter-spacing: 0.3em;
    user-select: none;
  }
}

// ── cells strip ─────────────────────────────────────────────────────────────
.pp-cells {
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  // collapse shared borders between adjacent syllable cells only;
  // tab cells keep their own dashed border so multiple tabs stay visible
  > .pp-cell:not(.pp-cell--tab) + .pp-cell:not(.pp-cell--tab) {
    border-left: none;
  }
}

// ── syllable cell ─────────────────────────────────────────────────────────────
.pp-cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: $cell-w; // FIXED — same for every cell across every line
  height: $cell-h;
  flex-shrink: 0;
  overflow: visible; // rhyme bar extends -1 px to bridge inter-syllable borders
  box-sizing: border-box;
  background: $cell-bg;
  border: 1px solid $border-col;
  position: relative; // rhyme bars are absolute children

  // ── rhyme bar: thin colored strip at the bottom of the cell ───────────────
  &__rhyme-bar {
    position: absolute;
    left: 0;
    right: -1px; // extends 1 px to bridge the collapsed inter-syllable border
    bottom: 0;
    height: 4px;
    pointer-events: none;
    z-index: 3;

    &--word-last {
      right: 0; // don’t bridge word boundaries — the 3 px gap is informative
    }
    // color and opacity are set inline via engineRhymeBarStyle()
  }

  // ── rhyme label bubble: opaque circle centered on the bar (sibling element) ─
  &__rhyme-dot {
    position: absolute;
    left: 50%;
    bottom: 2px; // bar center = 2 px from cell bottom (bar h=4 at bottom:0)
    transform: translate(-50%, 50%); // centers 13 px circle on that point
    width: 13px;
    height: 13px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 7px;
    font-weight: 900;
    font-family: sans-serif;
    color: #000;
    z-index: 5;
    pointer-events: none;
    line-height: 1;
    user-select: none;
  }

  &__pause-mark {
    position: absolute;
    top: 2px;
    bottom: 2px;
    right: -2px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.22);
    pointer-events: none;
  }

  // TAB indent cell — same dimensions as syllable cell, visually empty
  &--tab {
    border: 1px dashed rgba(0, 0, 0, 0.18);
    background: rgba(0, 0, 0, 0.04);
  }

  // word boundary — right border 3× bolder than inter-syllable borders
  &--word-last {
    border-right: 3px solid $border-col;
  }

  // ── stressed → 30% black dimming ─────────────────────────────────────────
  &--stressed {
    background: $stressed-bg;
  }

  // ── token row ──────────────────────────────────────────────────────────────
  &__tokens {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  &__token {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto; // natural content size — no forced filling
    padding: 0 3px; // horizontal breathing room for the color label
    min-width: 1.1em; // never narrower than one character
    // height is driven by the inline TokenVisual.height (% of parent __tokens)
    // when no style is applied fall back to 'auto' via the style binding
    height: auto;
    line-height: 1.1;
    font-family: 'Noto Serif', 'Georgia', serif;
    font-size: 0.72rem; // small enough that 3–4 tokens fit in $cell-w
    white-space: nowrap;
    overflow: hidden;

    &--vowel {
      color: rgba(0, 0, 0, 0.9);
    }
    &--consonant {
      color: rgba(0, 0, 0, 0.9);
    }
  }
}
</style>
