<template>
  <div class="pp-root">

    <!-- Empty state -->
    <div v-if="store.allWordTokens.length === 0" class="pp-empty">
      <q-icon name="music_note" size="2.5rem" color="grey-7" />
      <p>Confirm each line to see its phonetic grid.</p>
    </div>

    <!-- Line-by-line grid + optional SVG overlay -->
    <div v-else ref="gridContainer" class="pp-grid-wrap">

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
          :x1="seg.x1" :y1="seg.y1"
          :x2="seg.x2" :y2="seg.y2"
          :stroke="seg.color"
          :stroke-width="seg.width"
          :stroke-opacity="seg.opacity"
          stroke-linecap="round"
        />
      </svg>

      <div class="pp-lines">
        <template v-for="(line, lineIdx) in store.document.lines" :key="line.id">

          <!-- Empty line → blank row -->
          <div v-if="wordTokensInLine(line).length === 0" class="pp-blank-row" />

          <!-- Unconfirmed line → dim placeholder -->
          <div
            v-else-if="!store.isLineConfirmed(line.id)"
            :ref="(el) => setRowRef(lineIdx, el)"
            class="pp-row pp-row--pending"
            :class="{ 'pp-row--active': store.activeLineIndex === lineIdx }"
          >
            <span class="pp-row__num">{{ lineIdx + 1 }}</span>
            <span class="pp-row__hint">·  ·  ·</span>
          </div>

          <!-- Confirmed line → syllable cell row -->
          <div
            v-else
            :ref="(el) => setRowRef(lineIdx, el)"
            class="pp-row"
            :class="{ 'pp-row--active': store.activeLineIndex === lineIdx }"
          >
            <span class="pp-row__num">{{ lineIdx + 1 }}</span>

            <div class="pp-cells">
              <template v-for="tok in line.tokens" :key="tok.id">

                <!-- Word → syllable cells (spacing tokens ignored — strict grid) -->
                <template v-if="tok.kind === 'WORD'">
                  <template
                    v-for="(syl, si) in transcribedWord(tok).syllables"
                    :key="si"
                  >
                    <div
                      class="pp-cell"
                      :class="{
                        'pp-cell--stressed':  syl.stressed,
                        'pp-cell--word-last': si === transcribedWord(tok).syllables.length - 1,
                      }"
                    >
                      <div class="pp-cell__tokens">
                        <span
                          v-for="(token, ti) in syl.ipaTokens"
                          :key="ti"
                          :ref="(el) => setTokenRef(`${tok.id}:${si}:${ti}`, el)"
                          class="pp-cell__token"
                          :class="isVowelToken(token) ? 'pp-cell__token--vowel' : 'pp-cell__token--consonant'"
                          :style="tokenColorMap.get(`${tok.id}:${si}:${ti}`)
                            ? { background: tokenColorMap.get(`${tok.id}:${si}:${ti}`), borderRadius: '2px', padding: '1px 2px' }
                            : undefined"
                        >{{ token }}</span>
                      </div>
                    </div>
                  </template>
                </template>

              </template>
            </div>
          </div>

        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { watch, computed, ref, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { usePoetryStore } from 'src/stores/poetry';
import type { ILine, IToken, IWordToken } from 'src/model/Token';
import { transcribeWord, type TranscribedWord } from 'src/services/phonetic/wordTranscription';
import { analyzeSoundPatterns } from 'src/services/phonetic/soundPatternAnalyzer';
import { ipaTokenColor } from 'src/services/phonetic/ipaColorMap';

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

function transcribedWord(tok: IToken): TranscribedWord {
  if (tok.kind !== 'WORD') return { surface: '', language: 'ua', syllables: [] };
  return transcribeWord(tok);
}

const IPA_VOWEL_CHARS = new Set([
  'a','e','i','o','u',
  'æ','ɛ','ɪ','ɒ','ʌ','ɑ','ɔ','ə','ɜ','ʊ',
  'iː','uː','aː','eː','oː','ɑː','ɔː','ɜː',
  'eɪ','aɪ','ɔɪ','aʊ','oʊ','ɪə','eə','ʊə',
  'ɔ̃','ɛ̃','ã','õ','ũ',
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
    for (const tok of line.tokens) {
      if (tok.kind !== 'WORD') continue;
      const tw = transcribeWord(tok as IWordToken);
      for (let si = 0; si < tw.syllables.length; si++) {
        const syl = tw.syllables[si]!;
        for (let ti = 0; ti < syl.ipaTokens.length; ti++) {
          result.push({
            token:     syl.ipaTokens[ti]!,
            flatIdx,
            renderKey: `${tok.id}:${si}:${ti}`,
          });
          flatIdx++;
        }
      }
    }
  }
  return result;
});

const soundAnalysis = computed(() =>
  analyzeSoundPatterns(indexedTokens.value.map((t) => t.token)),
);

const tokenColorMap = computed<Map<string, string>>(() => {
  const map = new Map<string, string>();
  const { opacityByIndex } = soundAnalysis.value;
  for (const { token, flatIdx, renderKey } of indexedTokens.value) {
    const opacity = opacityByIndex.get(flatIdx);
    if (opacity === undefined) continue;
    const color = ipaTokenColor(token, opacity);
    if (color) map.set(renderKey, color);
  }
  return map;
});

// ── Clustering web ───────────────────────────────────────────────────────────
const showWeb       = defineModel<boolean>('showWeb', { default: false });
const gridContainer = ref<HTMLElement | null>(null);

/** renderKey → span element (set by :ref callbacks in template) */
const tokenElems = new Map<string, Element>();
function setTokenRef(key: string, el: unknown) {
  if (el instanceof Element) tokenElems.set(key, el);
  else tokenElems.delete(key);
}

interface WebSegment {
  x1: number; y1: number;
  x2: number; y2: number;
  color: string;
  width: number;
  opacity: number;
}

const svgSize     = ref({ w: 0, h: 0 });
const webSegments = ref<WebSegment[]>([]);

function rebuildWeb() {
  const container = gridContainer.value;
  if (!container || !showWeb.value) { webSegments.value = []; return; }

  // Canvas must cover the full scrollable content height
  svgSize.value = { w: container.clientWidth, h: container.scrollHeight };

  const { patterningSounds } = soundAnalysis.value;
  if (patterningSounds.size === 0) { webSegments.value = []; return; }

  const containerRect = container.getBoundingClientRect();
  const scrollTop     = container.scrollTop;

  // Collect scroll-adjusted center point for every patterning token
  const byToken = new Map<string, Array<{ x: number; y: number; flatIdx: number }>>();
  for (const { token, flatIdx, renderKey } of indexedTokens.value) {
    if (!patterningSounds.has(token)) continue;
    const el = tokenElems.get(renderKey);
    if (!el) continue;
    const er = el.getBoundingClientRect();
    const x  = er.left - containerRect.left + er.width  / 2;
    const y  = er.top  - containerRect.top  + er.height / 2 + scrollTop;
    let list = byToken.get(token);
    if (!list) { list = []; byToken.set(token, list); }
    list.push({ x, y, flatIdx });
  }

  const segs: WebSegment[] = [];
  for (const [token, pts] of byToken) {
    for (let k = 0; k + 1 < pts.length; k++) {
      const a       = pts[k]!;
      const b       = pts[k + 1]!;
      const gap     = (b.flatIdx - a.flatIdx) - 1;   // tokens between the pair
      const opacity = Math.max(0.05, Math.exp(-gap / 8));
      const width   = 1 + opacity * 2.5;             // 1 – 3.5 px
      const color   = ipaTokenColor(token, 1) ?? '#000';
      segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, color, width, opacity });
    }
  }
  webSegments.value = segs;
}

watch(
  [showWeb, indexedTokens, soundAnalysis],
  async () => {
    if (!showWeb.value) { webSegments.value = []; return; }
    await nextTick();
    rebuildWeb();
  },
);

let ro: ResizeObserver | null = null;
onMounted(() => {
  ro = new ResizeObserver(() => { if (showWeb.value) void nextTick().then(rebuildWeb); });
  if (gridContainer.value) ro.observe(gridContainer.value);
});
onBeforeUnmount(() => ro?.disconnect());
</script>

<style scoped lang="scss">
// ── sizing ────────────────────────────────────────────────────────────────────
//
// $cell-w  — every syllable cell is EXACTLY this wide, across ALL lines.
// This makes the grid align like a spreadsheet: column N of line 1 is the
// same horizontal position as column N of line 2.
//
$cell-w:       52px;   // fixed cell width  (left/right sides)
$cell-h:       38px;   // fixed cell height (top/bottom sides — taller than wide)
$border-col:   #000000;
$cell-bg:      transparent;
$stressed-bg:  rgba(0, 0, 0, 0.30);
$stressed-fg:  #ffffff;
$text-dim:     rgba(0, 0, 0, 0.30);
$text-faint:   rgba(0, 0, 0, 0.18);
$vowel-col:    #b8860b;        // dark goldenrod — readable on white
$consonant-col: rgba(0, 0, 0, 0.75);

// ── root ────────────────────────────────────────────────────────────────────────────────
.pp-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 10px 14px 10px;
  box-sizing: border-box;
  overflow: hidden;           // scrolling is handled by pp-grid-wrap
}

// ── grid wrapper (scrollable) ────────────────────────────────────────────────
.pp-grid-wrap {
  position: relative;         // SVG is absolutely positioned inside this
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
  color: rgba(255, 255, 255, 0.20);
  font-size: 0.82rem;
  text-align: center;
}

// ── lines list ────────────────────────────────────────────────────────────────
.pp-lines {
  display: flex;
  flex-direction: column;
  gap: 5px;
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

  &__num {
    flex-shrink: 0;
    width: 18px;
    text-align: right;
    font-size: 0.58rem;
    color: rgba(0, 0, 0, 0.35);
    font-variant-numeric: tabular-nums;
    user-select: none;
  }

  &__hint {
    font-size: 0.72rem;
    color: rgba(255, 255, 255, 0.22);
    letter-spacing: 0.30em;
    user-select: none;
  }
}

// ── cells strip ─────────────────────────────────────────────────────────────
.pp-cells {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  // collapse shared borders between adjacent cells
  > .pp-cell + .pp-cell { border-left: none; }
}

// ── syllable cell ─────────────────────────────────────────────────────────────
.pp-cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width:  $cell-w;   // FIXED — same for every cell across every line
  height: $cell-h;
  flex-shrink: 0;
  overflow: hidden;
  box-sizing: border-box;
  background: $cell-bg;
  border: 1px solid $border-col;

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
    flex: 1 1 0;          // grow/shrink equally — all tokens share the cell width
    min-width: 0;
    height: auto;         // shrinks to glyph height so bg ribbon is tight
    line-height: 1.1;
    font-family: 'Noto Serif', 'Georgia', serif;
    font-size: 0.72rem;   // small enough that 3–4 tokens fit in $cell-w
    white-space: nowrap;
    overflow: hidden;

    &--vowel     { color: rgba(0, 0, 0, 0.90); }
    &--consonant { color: rgba(0, 0, 0, 0.90); }
  }
}
</style>

