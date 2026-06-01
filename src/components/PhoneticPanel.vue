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
              <span v-if="hasAnyRhythm" class="pp-row__rhythm pp-row__rhythm--hidden" />
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
                v-if="hasAnyRhythm"
                class="pp-row__rhythm"
                :class="{ 'pp-row__rhythm--hidden': !lineRhythmLabel(lineIdx) }"
                :title="lineRhythmTitle(lineIdx)"
              >{{ lineRhythmLabel(lineIdx) }}</span>
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
                  <!-- Horizontal triangles (left/right) — move with cells -->
                  <div
                    v-if="manualMode && hoveredLeftLineId === line.id && canShiftLeft(line)"
                    class="pp-triangle pp-triangle--left"
                  />
                  <div
                    v-if="manualMode && hoveredLeftLineId === line.id && canShiftRight()"
                    class="pp-triangle pp-triangle--right"
                  />

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
                      <div
                        v-if="showRhymes && item.motifWordId"
                        class="pp-cell__rhyme-bar"
                        :class="{ 'pp-cell__rhyme-bar--word-last': item.wordLast }"
                        :style="engineRhymeBarStyle(item.motifWordId)"
                        :title="engineRhymeTitle(item.motifWordId)"
                      />
                      <!-- Label bubble: sibling of bar so it is NOT affected by bar's CSS opacity -->
                      <div
                        v-if="showRhymes && item.motifWordId && isRhymeLabelCell(line, itemIdx, item.motifWordId)"
                        :ref="(el) => setRhymeDotRef(item.motifWordId, el)"
                        class="pp-cell__rhyme-dot"
                        :style="engineRhymeDotStyle(item.motifWordId)"
                      >{{ rhymeLabel(item.motifWordId) }}</div>
                      <div
                        v-if="item.wordLast && item.motifWordId"
                        class="pp-cell__pause-mark"
                        :style="pauseMarkStyle(item.motifWordId)"
                        :title="pauseMarkTitle(item.motifWordId)"
                      />
                    </div>
                  </template>
                </div>

                <!-- Vertical triangle for moving up (top, positioned on first word center) -->
                <div
                  v-if="manualMode && hoveredLeftLineId === line.id && canMoveUp(lineIdx)"
                  class="pp-row__vertical-triangle pp-row__vertical-triangle--top"
                  :style="{ left: topTriangleLeftOffset(line) }"
                >
                  <div class="pp-triangle pp-triangle--top" />
                </div>

                <!-- Vertical triangle for moving down (bottom, positioned on last word center) -->
                <div
                  v-if="manualMode && hoveredLeftLineId === line.id && canMoveDown(lineIdx)"
                  class="pp-row__vertical-triangle pp-row__vertical-triangle--bottom"
                  :style="{ left: bottomTriangleLeftOffset(line) }"
                >
                  <div class="pp-triangle pp-triangle--bottom" />
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
import { ipaTokenColor, ipaTokenStyle, type TokenVisual } from 'src/services/phonetic/ipaColorMap';
import { generateVisualizationSvg, downloadSvg, textHash } from 'src/composables/useSvgExport';
import { buildVisualizationLineItems } from 'src/services/phonetic/visualizationLine';
import type { EchoAnnotation, StreamAnalysisResult } from 'src/services/phonetic/analysisTypes';
import type {
  EditorVisualizerChannel,
  PhoneticVisualizerInput,
} from 'src/components/visualizer/phoneticVisualizerContract';
import { analyzeRhymes } from 'src/services/phonetic/rhyme/rhymeAnalyzer';
import type { MotifTier, RhymeAnalysis } from 'src/services/phonetic/rhyme/types';

const props = defineProps<{
  input?: PhoneticVisualizerInput;
  editorChannel?: EditorVisualizerChannel;
}>();

const showWeb = defineModel<boolean>('showWeb', { default: false });
const alignRight = defineModel<boolean>('alignRight', { default: false });
const bindTabs = defineModel<boolean>('bindTabs', { default: true });
const manualMode = defineModel<boolean>('manualMode', { default: false });
const showRhymes = defineModel<boolean>('showRhymes', { default: false });
const showRhymeWeb = defineModel<boolean>('showRhymeWeb', { default: false });
const showSounds = defineModel<boolean>('showSounds', { default: true });
const alliterationThreshold = defineModel<number>('alliterationThreshold', { default: 0.35 });
const showNumBadge = defineModel<boolean>('showNumBadge', { default: true });
const showSylBadge = defineModel<boolean>('showSylBadge', { default: true });
const showCvBadge = defineModel<boolean>('showCvBadge', { default: true });

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

function setRawTextFromChannel(nextText: string): void {
  if (props.editorChannel) {
    props.editorChannel.setRawText(nextText);
    return;
  }
  store.setRawText(nextText);
}

// ── Scroll sync ──────────────────────────────────────────────────────────────
const rowRefs = new Map<number, Element>();
function setRowRef(lineIdx: number, el: unknown) {
  if (el instanceof Element) rowRefs.set(lineIdx, el);
  else rowRefs.delete(lineIdx);
}

watch(
  activeLineIndex,
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

// ── Movement predicates ────────────────────────────────────────────────────────

function canShiftLeft(line: ILine): boolean {
  return currentShift(line.id) > 0;
}

function canShiftRight(): boolean {
  // Right shift is always possible (no hard limit)
  return true;
}

function canMoveUp(lineIdx: number): boolean {
  return lineIdx > 0;
}

function canMoveDown(lineIdx: number): boolean {
  return lineIdx < visualizerDocument.value.lines.length - 1;
}

/**
 * Get center position (in cells) of first word module.
 * For 2 syllables: return 0.5 (between them).
 * For 3+ syllables: return middle index.
 */
function getFirstWordModuleCenter(line: ILine): number | null {
  const items = visualizationItems(line);
  const firstWordId = wordEdgeIds(line).first;
  if (!firstWordId) return null;

  const cellIndices: number[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item?.type === 'cell' && item.motifWordId === firstWordId) {
      cellIndices.push(i);
    }
  }

  if (cellIndices.length === 0) return null;
  return cellIndices.length === 2 
    ? cellIndices[0]! + 0.5
    : cellIndices[Math.floor(cellIndices.length / 2)]!;
}

/**
 * Get center position (in cells) of last word module.
 */
function getLastWordModuleCenter(line: ILine): number | null {
  const items = visualizationItems(line);
  const lastWordId = wordEdgeIds(line).last;
  if (!lastWordId) return null;

  const cellIndices: number[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item?.type === 'cell' && item.motifWordId === lastWordId) {
      cellIndices.push(i);
    }
  }

  if (cellIndices.length === 0) return null;
  return cellIndices.length === 2 
    ? cellIndices[0]! + 0.5
    : cellIndices[Math.floor(cellIndices.length / 2)]!;
}

/**
 * Calculate left offset (px) for top vertical triangle (positioned on first word center).
 */
function topTriangleLeftOffset(line: ILine): string {
  const center = getFirstWordModuleCenter(line);
  if (center === null) return '50%';
  const offsetPx = center * CELL_STEP_PX + CELL_STEP_PX / 2;
  return `${offsetPx}px`;
}

/**
 * Calculate left offset (px) for bottom vertical triangle (positioned on last word center).
 */
function bottomTriangleLeftOffset(line: ILine): string {
  const center = getLastWordModuleCenter(line);
  if (center === null) return '50%';
  const offsetPx = center * CELL_STEP_PX + CELL_STEP_PX / 2;
  return `${offsetPx}px`;
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
    hoveredLeftLineId.value = visualizerDocument.value.lines[dragLineIdx]?.id ?? null;
    dragStartY += ROW_STEP_PX;
  } else if (deltaY <= -ROW_STEP_PX) {
    moveFirstWordUp(dragLineIdx);
    dragLineIdx = Math.max(0, dragLineIdx - 1);
    hoveredLeftLineId.value = visualizerDocument.value.lines[dragLineIdx]?.id ?? null;
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
  const lines = visualizerInput.value.rawText.split('\n');
  if (lineIdx >= lines.length) return;

  const cur = splitWords(lines[lineIdx] ?? '');
  if (cur.words.length === 0) return;
  const prev = splitWords(lines[lineIdx - 1] ?? '');

  const moved = cur.words.shift();
  if (!moved) return;
  prev.words.push(moved);

  lines[lineIdx - 1] = composeWords(prev.prefix, prev.words);
  lines[lineIdx] = composeWords(cur.prefix, cur.words);
  setRawTextFromChannel(lines.join('\n'));
}

function moveLastWordDown(lineIdx: number) {
  const lines = visualizerInput.value.rawText.split('\n');
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
  setRawTextFromChannel(lines.join('\n'));
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
    map.set(entry.source.flatIndex, entry);
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
  return `${foot} · ${rhythm.clausula}`;
}

function lineRhythmTitle(lineIdx: number): string {
  const ordinal = confirmedLineOrdinal(lineIdx);
  if (ordinal < 0) return '';
  const rhythm = rhythmByEngineLineIndex.value.get(ordinal);
  if (!rhythm) return '';
  return `Period ${rhythm.period}, phase ${rhythm.phase}, confidence ${rhythm.confidence.toFixed(2)}`;
}

/** True when the engine has returned rhythm data for at least one line. */
const hasAnyRhythm = computed(() => rhythmByEngineLineIndex.value.size > 0);

const tokenStyleMap = computed<Map<string, TokenVisual>>(() => {
  const map = new Map<string, TokenVisual>();
  const threshold = Math.max(0.05, Math.min(0.8, alliterationThreshold.value));
  for (const { token, flatIdx, renderKey } of indexedTokens.value) {
    const rawOpacity = echoByFlatIndex.value.get(flatIdx)?.opacity;
    if (rawOpacity === undefined || rawOpacity < threshold) continue;
    const normalised = (rawOpacity - threshold) / Math.max(0.0001, 1 - threshold);
    const visual = ipaTokenStyle(token, Math.max(0.05, Math.min(1, normalised)));
    if (visual) map.set(renderKey, visual);
  }
  return map;
});

// ── Engine-driven annotation layer ───────────────────────────────────────────

function groupHue(group: string): number {
  let hash = 0;
  for (let i = 0; i < group.length; i++) hash = (hash * 31 + group.charCodeAt(i)) >>> 0;
  return hash % 360;
}

// ── Local rhyme analysis (reliable, always available) ─────────────────────────

const TIER_PRIO: Record<MotifTier, number> = { exact: 0, near: 1, structural: 2 };

interface WordRhymeEntry {
  color: string;
  opacity: number;
  tier: MotifTier;
  label: string;
  motifId: string;
}

/** Single analyzeRhymes call shared by the bar map and the rhyme web. */
const localRhymeAnalysis = computed<RhymeAnalysis | null>(() => {
  if (!showRhymes.value && !showRhymeWeb.value) return null;
  return analyzeRhymes(visualizerDocument.value, isLineConfirmed);
});

const localRhymeWordMap = computed<Map<string, WordRhymeEntry>>(() => {
  const ra = localRhymeAnalysis.value;
  if (!ra) return new Map();
  const map = new Map<string, WordRhymeEntry>();
  for (const motif of ra.motifs) {
    for (const span of motif.spans) {
      const existing = map.get(span.wordId);
      if (!existing || TIER_PRIO[motif.tier] < TIER_PRIO[existing.tier]) {
        map.set(span.wordId, {
          color: motif.color,
          opacity: motif.opacity,
          tier: motif.tier,
          label: motif.label,
          motifId: motif.id,
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
  const items = visualizationItems(line);
  const cellIndices: number[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it?.type === 'cell' && it.motifWordId === wordId) cellIndices.push(i);
  }
  if (cellIndices.length === 0) return false;
  return itemIdx === cellIndices[Math.floor(cellIndices.length / 2)]!;
}

function rhymeLabel(wordId: string): string {
  const local = localRhymeWordMap.value.get(wordId);
  if (local) return local.label;
  const ann = analysis.value?.annotations[wordId];
  return ann?.rhymeGroup ?? '';
}

function engineRhymeBarStyle(wordId: string): Record<string, string> {
  // Try local analyzer first (always available, fast); geometry handled by CSS
  const local = localRhymeWordMap.value.get(wordId);
  if (local) {
    return { background: local.color, opacity: String(local.opacity) };
  }
  // Fall back to engine annotations
  const ann = analysis.value?.annotations[wordId];
  if (!ann?.rhymeGroup) return { display: 'none' };
  const hue = groupHue(ann.rhymeGroup);
  const score = ann.rhymeScore ?? 0.4;
  return {
    background: `hsl(${hue} 72% 52%)`,
    opacity: String(Math.max(0.20, Math.min(1, score))),
  };
}

/** Opaque dot style — NOT affected by the bar's CSS opacity since it is a sibling element. */
function engineRhymeDotStyle(wordId: string): Record<string, string> {
  const local = localRhymeWordMap.value.get(wordId);
  if (local) return { background: local.color };
  const ann = analysis.value?.annotations[wordId];
  if (!ann?.rhymeGroup) return { display: 'none' };
  return { background: `hsl(${groupHue(ann.rhymeGroup)}, 72%, 52%)` };
}

function engineRhymeTitle(wordId: string): string {
  const local = localRhymeWordMap.value.get(wordId);
  if (local) return `Rhyme ${local.label} [${local.tier}]`;
  const ann = analysis.value?.annotations[wordId];
  if (!ann?.rhymeGroup) return '';
  const score = ann.rhymeScore === null ? 'n/a' : ann.rhymeScore.toFixed(2);
  return `Rhyme ${ann.rhymeGroup} (score ${score})`;
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

  const ra = localRhymeAnalysis.value;
  if (!ra || ra.motifs.length === 0) {
    rhymeWebPaths.value = [];
    return;
  }

  const containerRect = container.getBoundingClientRect();
  const scrollTop = container.scrollTop;
  const paths: RhymeWebPath[] = [];

  for (const motif of ra.motifs) {
    // Collect one representative point per occurrence (taken from the dot element)
    const byOcc = new Map<number, Element>();
    for (const span of motif.spans) {
      if (!byOcc.has(span.occurrenceIdx)) {
        const el = rhymeDotElems.get(span.wordId);
        if (el) byOcc.set(span.occurrenceIdx, el);
      }
    }
    const occIds = [...byOcc.keys()].sort((a, b) => a - b);
    if (occIds.length < 2) continue;

    for (let k = 0; k + 1 < occIds.length; k++) {
      const elA = byOcc.get(occIds[k]!);
      const elB = byOcc.get(occIds[k + 1]!);
      if (!elA || !elB) continue;

      const ra2 = elA.getBoundingClientRect();
      const rb = elB.getBoundingClientRect();
      const ax = ra2.left - containerRect.left + ra2.width / 2;
      const ay = ra2.top - containerRect.top + ra2.height / 2 + scrollTop;
      const bx = rb.left - containerRect.left + rb.width / 2;
      const by2 = rb.top - containerRect.top + rb.height / 2 + scrollTop;

      // Vertical S-curve with horizontal control points
      const cy = (ay + by2) / 2;
      const d = `M ${ax} ${ay} C ${ax} ${cy}, ${bx} ${cy}, ${bx} ${by2}`;
      paths.push({ d, color: motif.color, opacity: Math.min(1, motif.opacity + 0.25) });
    }
  }
  rhymeWebPaths.value = paths;
}

watch([showRhymeWeb, localRhymeAnalysis], async () => {
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
  onLeftHandlePointerUp();
  onResetDotPointerUp();
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

// ── rhyme web SVG overlay (below phoneme web, above bars) ────────────────────
.pp-rhyme-web-svg {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  overflow: visible;
  z-index: 9;
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

    &--hidden {
      visibility: hidden;
    }
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
  position: relative;

  &--guide-active .pp-cells {
    box-shadow: 0 0 0 2px rgba(41, 121, 255, 0.25);
    border-radius: 4px;
  }
}

.pp-row__vertical-triangle {
  position: absolute;
  width: 0;
  height: 0;
  pointer-events: none;

  &--top {
    top: -12px;
  }

  &--bottom {
    bottom: -12px;
  }
}

.pp-triangle {
  width: 0;
  height: 0;
  pointer-events: none;

  &--left {
    position: absolute;
    top: 50%;
    left: -11px;
    transform: translateY(-50%);
    border-top: 6px solid transparent;
    border-bottom: 6px solid transparent;
    border-right: 8px solid rgba(41, 121, 255, 0.9);
  }

  &--right {
    position: absolute;
    top: 50%;
    right: -11px;
    transform: translateY(-50%);
    border-top: 6px solid transparent;
    border-bottom: 6px solid transparent;
    border-left: 8px solid rgba(41, 121, 255, 0.9);
  }

  &--top {
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-bottom: 8px solid rgba(41, 121, 255, 0.92);
  }

  &--bottom {
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 8px solid rgba(41, 121, 255, 0.92);
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
  overflow: visible; // rhyme bar extends -1 px to bridge inter-syllable borders
  box-sizing: border-box;
  background: $cell-bg;
  border: 1px solid $border-col;
  position: relative; // rhyme bars are absolute children

  // ── rhyme bar: thin colored strip at the bottom of the cell ───────────────
  &__rhyme-bar {
    position: absolute;
    left: 0;
    right: -1px;   // extends 1 px to bridge the collapsed inter-syllable border
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
    bottom: 2px;                    // bar center = 2 px from cell bottom (bar h=4 at bottom:0)
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
    background: rgba(255, 255, 255, 0.92);
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
