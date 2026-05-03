<template>
  <div class="pp-root">
    <!-- Empty state -->
    <div v-if="store.allWordTokens.length === 0" class="pp-empty">
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

        <div class="pp-lines" :class="{ 'pp-lines--right': alignRight }">
          <template v-for="(line, lineIdx) in store.document.lines" :key="line.id">
            <!-- Empty line (no tokens at all) → blank row -->
            <div v-if="line.tokens.length === 0" class="pp-blank-row" />

            <!-- TAB-only line with no words → compact blank row (indented empty line) -->
            <div
              v-else-if="wordTokensInLine(line).length === 0 && !store.isLineConfirmed(line.id)"
              class="pp-blank-row"
            />

            <!-- Unconfirmed line that has words → dim placeholder -->
            <div
              v-else-if="!store.isLineConfirmed(line.id)"
              :ref="(el) => setRowRef(lineIdx, el)"
              class="pp-row pp-row--pending"
              :class="{ 'pp-row--active': store.activeLineIndex === lineIdx }"
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
              :class="{ 'pp-row--active': store.activeLineIndex === lineIdx }"
            >
              <span v-if="showNumBadge" class="pp-row__num">{{ lineIdx + 1 }}</span>
              <span v-if="showSylBadge" class="pp-row__syl">{{ lineSyllableCount(line) }}</span>
              <span v-if="showCvBadge" class="pp-row__cv">{{ lineCvRatio(line) }}</span>
              <div
                class="pp-row__interactive"
                :class="{
                  'pp-row__interactive--guide-active': manualMode && hoveredLeftLineId === line.id,
                }"
              >
                <button
                  v-if="manualMode"
                  class="pp-handle pp-handle--left"
                  title="Drag: left/right = row shift, up/down = move words between rows"
                  @mouseenter="hoveredLeftLineId = line.id"
                  @mouseleave="hoveredLeftLineId = null"
                  @pointerdown="onLeftHandlePointerDown($event, line, lineIdx)"
                />

                <div class="pp-cells" :style="cellsStyle(line)">
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
                        'pp-cell--module-hot':
                          manualMode &&
                          hoveredLeftLineId === line.id &&
                          isEdgeModuleCell(line, item.motifWordId),
                        'pp-cell--guide-up':
                          manualMode &&
                          hoveredLeftLineId === line.id &&
                          isFirstWordFirstCell(line, itemIdx, item.motifWordId),
                        'pp-cell--guide-down':
                          manualMode &&
                          hoveredLeftLineId === line.id &&
                          isLastWordLastCell(line, itemIdx, item.motifWordId),
                      }"
                    >
                      <div class="pp-cell__tokens">
                        <span
                          v-for="(token, ti) in item.ipaTokens"
                          :key="ti"
                          :ref="
                            (el) =>
                              setTokenRef(
                                item.renderKeys?.[ti] ?? `${line.id}:${itemIdx}:${ti}`,
                                el,
                              )
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
                      <template v-if="showRhymes && item.motifWordId && item.ipaTokens">
                        <div
                          v-for="(motif, mi) in sylMotifs(
                            item.motifWordId,
                            item.motifSyllableIndex ?? -1,
                            item.ipaTokens.length,
                          )"
                          :key="motif.id"
                          class="pp-cell__rhyme-bar"
                          :class="`pp-cell__rhyme-bar--${motif.tier}`"
                          :style="rhymeBarStyle(motif, mi)"
                          :title="`[${motif.tier}] ${motif.canonicalTokens.join('')}`"
                        />
                      </template>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </template>

    <!-- Demo badge — always-visible notice in the bottom-right corner -->
    <button
      v-if="manualMode"
      class="pp-reset-dot"
      :style="{ '--pp-reset-progress': String(resetGestureProgress) }"
      title="Hold and draw a circle to reset manual shifts and re-enable tab binding"
      @pointerdown="onResetDotPointerDown"
    />

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
import { analyzeSoundPatterns } from 'src/services/phonetic/soundPatternAnalyzer';
import { ipaTokenColor, ipaTokenStyle, type TokenVisual } from 'src/services/phonetic/ipaColorMap';
import { analyzeRhymes } from 'src/services/phonetic/rhyme/rhymeAnalyzer';
import type { PhonemeMotif, RhymeAnalysis } from 'src/services/phonetic/rhyme/types';
import { generateVisualizationSvg, downloadSvg, textHash } from 'src/composables/useSvgExport';
import { buildVisualizationLineItems } from 'src/services/phonetic/visualizationLine';

const showWeb = defineModel<boolean>('showWeb', { default: false });
const alignRight = defineModel<boolean>('alignRight', { default: false });
const bindTabs = defineModel<boolean>('bindTabs', { default: true });
const manualMode = defineModel<boolean>('manualMode', { default: false });
const showRhymes = defineModel<boolean>('showRhymes', { default: false });
const showSounds = defineModel<boolean>('showSounds', { default: true });
const showNumBadge = defineModel<boolean>('showNumBadge', { default: true });
const showSylBadge = defineModel<boolean>('showSylBadge', { default: true });
const showCvBadge = defineModel<boolean>('showCvBadge', { default: true });

const store = usePoetryStore();

// ── Scroll sync ──────────────────────────────────────────────────────────────
const rowRefs = new Map<number, Element>();
function setRowRef(lineIdx: number, el: unknown) {
  if (el instanceof Element) rowRefs.set(lineIdx, el);
  else rowRefs.delete(lineIdx);
}

watch(
  () => store.activeLineIndex,
  (idx) => {
    if (idx === null) return;
    const el = rowRefs.get(idx);
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  },
);

function wordTokensInLine(line: ILine): IWordToken[] {
  return line.tokens.filter((t): t is IWordToken => t.kind === 'WORD');
}

// ── Manual grid mode ────────────────────────────────────────────────────────
const CELL_STEP_PX = 52;
const ROW_STEP_PX = 34;

const rowManualShift = ref<Map<string, number>>(new Map());
const hoveredLeftLineId = ref<string | null>(null);

function wordEdgeIds(line: ILine): { first: string | null; last: string | null } {
  const words = wordTokensInLine(line);
  return {
    first: words[0]?.id ?? null,
    last: words[words.length - 1]?.id ?? null,
  };
}

function isEdgeModuleCell(line: ILine, wordId: string | undefined): boolean {
  if (!wordId) return false;
  const edges = wordEdgeIds(line);
  return wordId === edges.first || wordId === edges.last;
}

function isFirstWordFirstCell(line: ILine, itemIdx: number, wordId: string | undefined): boolean {
  const firstId = wordEdgeIds(line).first;
  if (!wordId || !firstId || wordId !== firstId) return false;
  const items = visualizationItems(line);
  for (let i = 0; i < itemIdx; i++) {
    const prev = items[i];
    if (prev?.type === 'cell' && prev.motifWordId === wordId) return false;
  }
  return true;
}

function isLastWordLastCell(line: ILine, itemIdx: number, wordId: string | undefined): boolean {
  const lastId = wordEdgeIds(line).last;
  if (!wordId || !lastId || wordId !== lastId) return false;
  const items = visualizationItems(line);
  for (let i = itemIdx + 1; i < items.length; i++) {
    const next = items[i];
    if (next?.type === 'cell' && next.motifWordId === wordId) return false;
  }
  return true;
}

function currentShift(lineId: string): number {
  return rowManualShift.value.get(lineId) ?? 0;
}

function setShift(lineId: string, next: number) {
  const map = new Map(rowManualShift.value);
  if (next <= 0) map.delete(lineId);
  else map.set(lineId, next);
  rowManualShift.value = map;
}

function cellsStyle(line: ILine): Record<string, string> | undefined {
  if (!manualMode.value) return undefined;
  const steps = currentShift(line.id);
  if (steps === 0) return undefined;
  return {
    transform: `translateX(${steps * CELL_STEP_PX}px)`,
  };
}

let dragLineId: string | null = null;
let dragStartX = 0;
let dragStartY = 0;
let dragStartShift = 0;
let dragLineIdx: number | null = null;
let dragAxisLock: 'x' | 'y' | null = null;
const AXIS_LOCK_THRESHOLD_PX = 6;

const resetGestureProgress = ref(0);
let resetCenterX = 0;
let resetCenterY = 0;
let resetActive = false;
let resetAccumAbs = 0;
let resetLastAngle: number | null = null;
let resetDone = false;
const RESET_MIN_RADIUS_PX = 10;
const RESET_REQUIRED_ARC = Math.PI * 2.15;

function onLeftHandlePointerDown(e: PointerEvent, line: ILine, lineIdx: number) {
  if (!manualMode.value) return;
  e.preventDefault();
  // As soon as manual dragging starts, detach visual tab coupling.
  bindTabs.value = false;
  // Pressing the handle immediately activates highlight for this row.
  hoveredLeftLineId.value = line.id;
  dragLineId = line.id;
  dragLineIdx = lineIdx;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragStartShift = currentShift(line.id);
  dragAxisLock = null;
  window.addEventListener('pointermove', onLeftHandlePointerMove);
  window.addEventListener('pointerup', onLeftHandlePointerUp);
  document.body.style.cursor = 'all-scroll';
  document.body.style.userSelect = 'none';
}

function onLeftHandlePointerMove(e: PointerEvent) {
  if (!dragLineId || dragLineIdx === null) return;

  // First meaningful movement locks the whole interaction session to one axis.
  const absDx = Math.abs(e.clientX - dragStartX);
  const absDy = Math.abs(e.clientY - dragStartY);
  if (!dragAxisLock && (absDx >= AXIS_LOCK_THRESHOLD_PX || absDy >= AXIS_LOCK_THRESHOLD_PX)) {
    dragAxisLock = absDx >= absDy ? 'x' : 'y';
    document.body.style.cursor = dragAxisLock === 'x' ? 'ew-resize' : 'ns-resize';
  }

  if (!dragAxisLock) return;

  if (dragAxisLock === 'x') {
    // Horizontal step movement of the full row block.
    const delta = e.clientX - dragStartX;
    const stepDelta = Math.round(delta / CELL_STEP_PX);
    const next = Math.max(0, dragStartShift + stepDelta);
    setShift(dragLineId, next);
    return;
  }

  // Vertical movement: one boundary crossing => one-row move.
  // This prevents accidental jumps across multiple rows.
  const deltaY = e.clientY - dragStartY;

  if (deltaY >= ROW_STEP_PX) {
    moveLastWordDown(dragLineIdx);
    dragLineIdx += 1;
    hoveredLeftLineId.value = store.document.lines[dragLineIdx]?.id ?? null;
    dragStartY += ROW_STEP_PX;
  } else if (deltaY <= -ROW_STEP_PX) {
    moveFirstWordUp(dragLineIdx);
    dragLineIdx = Math.max(0, dragLineIdx - 1);
    hoveredLeftLineId.value = store.document.lines[dragLineIdx]?.id ?? null;
    dragStartY -= ROW_STEP_PX;
  }
}

function onLeftHandlePointerUp() {
  dragLineId = null;
  dragLineIdx = null;
  dragAxisLock = null;
  window.removeEventListener('pointermove', onLeftHandlePointerMove);
  window.removeEventListener('pointerup', onLeftHandlePointerUp);
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
}

function resetManualLayout() {
  rowManualShift.value = new Map();
  bindTabs.value = false;
  manualMode.value = false;
}

function onResetDotPointerDown(e: PointerEvent) {
  if (!manualMode.value) return;
  const el = e.currentTarget as HTMLElement | null;
  if (!el) return;

  e.preventDefault();
  const rect = el.getBoundingClientRect();
  resetCenterX = rect.left + rect.width / 2;
  resetCenterY = rect.top + rect.height / 2;
  resetActive = true;
  resetDone = false;
  resetAccumAbs = 0;
  resetLastAngle = null;
  resetGestureProgress.value = 0;

  window.addEventListener('pointermove', onResetDotPointerMove);
  window.addEventListener('pointerup', onResetDotPointerUp);
}

function onResetDotPointerMove(e: PointerEvent) {
  if (!resetActive) return;
  const dx = e.clientX - resetCenterX;
  const dy = e.clientY - resetCenterY;
  const radius = Math.hypot(dx, dy);
  if (radius < RESET_MIN_RADIUS_PX) return;

  const angle = Math.atan2(dy, dx);
  if (resetLastAngle === null) {
    resetLastAngle = angle;
    return;
  }

  let delta = angle - resetLastAngle;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  resetAccumAbs += Math.abs(delta);
  resetLastAngle = angle;

  const progress = Math.min(1, resetAccumAbs / RESET_REQUIRED_ARC);
  resetGestureProgress.value = progress;

  if (!resetDone && progress >= 1) {
    resetDone = true;
    resetManualLayout();
  }
}

function onResetDotPointerUp() {
  resetActive = false;
  resetLastAngle = null;
  window.removeEventListener('pointermove', onResetDotPointerMove);
  window.removeEventListener('pointerup', onResetDotPointerUp);
  // Fast visual rewind if circle wasn't completed.
  if (!resetDone) resetGestureProgress.value = 0;
}

function splitWords(lineText: string): { prefix: string; words: string[] } {
  const prefixMatch = lineText.match(/^[\t ]*/);
  const prefix = prefixMatch?.[0] ?? '';
  const body = lineText.slice(prefix.length).trim();
  const words = body.length > 0 ? body.split(/\s+/) : [];
  return { prefix, words };
}

function composeWords(prefix: string, words: string[]): string {
  return words.length > 0 ? `${prefix}${words.join(' ')}` : prefix;
}

function moveFirstWordUp(lineIdx: number) {
  if (lineIdx <= 0) return;
  const lines = store.rawText.split('\n');
  if (lineIdx >= lines.length) return;

  const cur = splitWords(lines[lineIdx] ?? '');
  if (cur.words.length === 0) return;
  const prev = splitWords(lines[lineIdx - 1] ?? '');

  const moved = cur.words.shift();
  if (!moved) return;
  prev.words.push(moved);

  lines[lineIdx - 1] = composeWords(prev.prefix, prev.words);
  lines[lineIdx] = composeWords(cur.prefix, cur.words);
  store.setRawText(lines.join('\n'));
}

function moveLastWordDown(lineIdx: number) {
  const lines = store.rawText.split('\n');
  if (lineIdx < 0 || lineIdx >= lines.length) return;
  if (lineIdx === lines.length - 1) lines.push('');

  const cur = splitWords(lines[lineIdx] ?? '');
  if (cur.words.length === 0) return;
  const next = splitWords(lines[lineIdx + 1] ?? '');

  const moved = cur.words.pop();
  if (!moved) return;
  next.words.unshift(moved);

  lines[lineIdx] = composeWords(cur.prefix, cur.words);
  lines[lineIdx + 1] = composeWords(next.prefix, next.words);
  store.setRawText(lines.join('\n'));
}

watch(
  () => manualMode.value,
  (enabled) => {
    if (enabled) return;
    hoveredLeftLineId.value = null;
    onLeftHandlePointerUp();
  },
);

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
  for (const line of store.document.lines) {
    if (!store.isLineConfirmed(line.id)) continue;
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

const soundAnalysis = computed(() => analyzeSoundPatterns(indexedTokens.value.map((t) => t.token)));

const tokenStyleMap = computed<Map<string, TokenVisual>>(() => {
  const map = new Map<string, TokenVisual>();
  const { opacityByIndex } = soundAnalysis.value;
  for (const { token, flatIdx, renderKey } of indexedTokens.value) {
    const opacity = opacityByIndex.get(flatIdx);
    if (opacity === undefined) continue;
    const visual = ipaTokenStyle(token, opacity);
    if (visual) map.set(renderKey, visual);
  }
  return map;
});

// ── Rhyme analysis ────────────────────────────────────────────────────────────

const rhymeAnalysis = computed<RhymeAnalysis>(() => {
  if (!showRhymes.value) return { motifs: [], cellMotifs: new Map() };
  return analyzeRhymes(store.document, store.isLineConfirmed);
});

/** All motifs that touch any token of this syllable cell. */
function sylMotifs(wordId: string, sylIdx: number, tokenCount: number): PhonemeMotif[] {
  const { cellMotifs, motifs } = rhymeAnalysis.value;
  const seen = new Set<string>();
  for (let ti = 0; ti < tokenCount; ti++) {
    cellMotifs.get(`${wordId}:${sylIdx}:${ti}`)?.forEach((id) => seen.add(id));
  }
  return [...seen].map((id) => motifs.find((m) => m.id === id)!).filter(Boolean);
}

const BAR_H = 5; // px — height of each rhyme bar
const BAR_GAP = 2; // px — gap between stacked bars

/**
 * Inline style for one rhyme bar inside a syllable cell.
 * Bars stack from the bottom upward; each is a thin colored strip
 * in the same visual language as phoneme area shapes.
 */
function rhymeBarStyle(motif: PhonemeMotif, stackIndex: number): Record<string, string> {
  const bottom = stackIndex * (BAR_H + BAR_GAP);
  const radius =
    motif.tier === 'exact' ? '2px 2px 0 0' : motif.tier === 'near' ? '1px 1px 0 0' : '0';
  return {
    background: motif.color,
    height: `${BAR_H}px`,
    bottom: `${bottom}px`,
    borderRadius: radius,
  };
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

function rebuildWeb() {
  const container = gridContainer.value;
  if (!container || !showWeb.value) {
    webSegments.value = [];
    return;
  }

  // Canvas must cover the full scrollable content height
  svgSize.value = { w: container.clientWidth, h: container.scrollHeight };

  const { patterningSounds } = soundAnalysis.value;
  if (patterningSounds.size === 0) {
    webSegments.value = [];
    return;
  }

  const containerRect = container.getBoundingClientRect();
  const scrollTop = container.scrollTop;

  // Collect scroll-adjusted center point for every patterning token
  const byToken = new Map<string, Array<{ x: number; y: number; flatIdx: number }>>();
  for (const { token, flatIdx, renderKey } of indexedTokens.value) {
    if (!patterningSounds.has(token)) continue;
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

watch([showWeb, indexedTokens, soundAnalysis], async () => {
  if (!showWeb.value) {
    webSegments.value = [];
    return;
  }
  await nextTick();
  rebuildWeb();
});

let ro: ResizeObserver | null = null;
onMounted(() => {
  ro = new ResizeObserver(() => {
    if (showWeb.value) void nextTick().then(rebuildWeb);
  });
  if (gridContainer.value) ro.observe(gridContainer.value);
});
onBeforeUnmount(() => {
  ro?.disconnect();
  onLeftHandlePointerUp();
  onResetDotPointerUp();
});

// ── SVG Export ───────────────────────────────────────────────────────────────

function exportSvg(includeLegend = false): void {
  const rawText = store.document.lines
    .flatMap((l) => l.tokens.flatMap((t) => ('text' in t ? [t.text] : [])))
    .join('');
  const hash = textHash(rawText);
  const svg = generateVisualizationSvg(
    store.document.lines,
    store.isLineConfirmed,
    tokenStyleMap.value,
    '',
    includeLegend,
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

.pp-reset-dot {
  --pp-reset-progress: 0;
  position: absolute;
  left: 10px;
  bottom: 8px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1px solid rgba(32, 126, 255, 0.75);
  background: radial-gradient(circle at 35% 35%, #9fd0ff 0%, #2b8dff 50%, #1b64c8 100%);
  box-shadow:
    0 0 0 2px rgba(32, 126, 255, 0.2),
    0 0 12px rgba(32, 126, 255, 0.45);
  cursor: crosshair;
  z-index: 24;

  &::before {
    content: '';
    position: absolute;
    inset: -5px;
    border-radius: 50%;
    background: conic-gradient(
      rgba(32, 126, 255, 0.95) calc(var(--pp-reset-progress) * 360deg),
      rgba(32, 126, 255, 0.12) 0
    );
    -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 0);
    mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 0);
    transition: background 0.08s linear;
    pointer-events: none;
  }
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
  &__cv {
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

  &__hint {
    font-size: 0.72rem;
    color: rgba(255, 255, 255, 0.22);
    letter-spacing: 0.3em;
    user-select: none;
  }
}

.pp-row__interactive {
  display: inline-flex;
  align-items: center;
  gap: 6px;

  &--guide-active .pp-cells {
    box-shadow: 0 0 0 2px rgba(41, 121, 255, 0.25);
    border-radius: 4px;
  }

  &--guide-active .pp-cells::before,
  &--guide-active .pp-cells::after {
    content: '';
    position: absolute;
    top: 50%;
    width: 0;
    height: 0;
    transform: translateY(-50%);
    pointer-events: none;
  }

  &--guide-active .pp-cells::before {
    left: -11px;
    border-top: 6px solid transparent;
    border-bottom: 6px solid transparent;
    border-right: 8px solid rgba(41, 121, 255, 0.9);
  }

  &--guide-active .pp-cells::after {
    right: -11px;
    border-top: 6px solid transparent;
    border-bottom: 6px solid transparent;
    border-left: 8px solid rgba(41, 121, 255, 0.9);
  }
}

.pp-handle {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  border: 1px solid rgba(41, 121, 255, 0.65);
  background: rgba(41, 121, 255, 0.8);
  box-shadow:
    0 0 0 2px rgba(41, 121, 255, 0.15),
    0 0 10px rgba(41, 121, 255, 0.35);
  opacity: 0.22;
  transition:
    opacity 0.12s,
    transform 0.12s,
    box-shadow 0.12s;

  &:hover {
    opacity: 1;
    transform: scale(1.12);
  }

  &--left {
    cursor: all-scroll;
  }
}

// ── cells strip ─────────────────────────────────────────────────────────────
.pp-cells {
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  transition: transform 0.08s steps(1, end);
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
  overflow: hidden;
  box-sizing: border-box;
  background: $cell-bg;
  border: 1px solid $border-col;
  position: relative; // rhyme bars are absolute children

  // ── rhyme bar: thin colored strip at the bottom of the cell ───────────────
  &__rhyme-bar {
    position: absolute;
    left: 2px;
    right: 2px;
    pointer-events: none;
    // height and bottom are set inline via rhymeBarStyle()
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

  &--module-hot {
    box-shadow: inset 0 0 0 2px rgba(41, 121, 255, 0.55);
    background: rgba(41, 121, 255, 0.08);
  }

  &--guide-up::before {
    content: '';
    position: absolute;
    top: 2px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-bottom: 8px solid rgba(41, 121, 255, 0.92);
    pointer-events: none;
  }

  &--guide-down::after {
    content: '';
    position: absolute;
    bottom: 2px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 8px solid rgba(41, 121, 255, 0.92);
    pointer-events: none;
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
