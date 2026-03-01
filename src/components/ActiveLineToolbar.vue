<template>
  <!-- ── 'active' mode: single panel for the cursor line ──────────────── -->
  <transition name="toolbar-slide">
    <div v-if="mode === 'active' && activeLine" class="alt-root" :style="fontStyle">
      <LinePanel :line="activeLine" />
    </div>
  </transition>

  <!-- ── 'all' mode: one panel per document line with words ───────────── -->
  <div v-if="mode === 'all' && allLines.length" ref="allContainer" class="alt-all">
    <template v-for="entry in allLines" :key="entry.line.id">
      <!-- Word line: full panel -->
      <div
        v-if="entry.hasWords"
        :ref="(el) => setLineRef(entry.docIndex, el)"
        class="alt-root"
        :class="{ 'alt-root--active': entry.docIndex === activeLineIndex }"
        :style="fontStyle"
      >
        <LinePanel :line="entry.line" />
      </div>
      <!-- Empty / punctuation-only line: spacer matching CM line height -->
      <div v-else class="alt-spacer" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import LinePanel from './LinePanel.vue';
import { usePoetryStore } from 'src/stores/poetry';
import { EDITOR_FONT_FAMILY } from 'src/constants/fonts';
import type { ILine } from 'src/model/Token';
import type { ToolbarMode } from 'src/stores/localConfig';

const { mode } = defineProps<{
  /** 'active' = cursor line only; 'all' = every line that has words */
  mode: ToolbarMode;
  /** CodeMirror scroller scrollTop — kept for API compat */
  cmScrollTop?: number;
}>();

const store = usePoetryStore();

// Active line index comes from the shared store (written by PoetryEditor)
const activeLineIndex = computed(() => store.activeLineIndex);

// Template ref for the 'all' mode scroll container
const allContainer = ref<HTMLElement | null>(null);

// Map of docIndex → DOM element for word-line rows
const lineRefs = new Map<number, Element>();
function setLineRef(docIndex: number, el: unknown) {
  if (el instanceof Element) lineRefs.set(docIndex, el);
  else lineRefs.delete(docIndex);
}

// Auto-scroll the active line into view when cursor moves
watch(activeLineIndex, (idx) => {
  if (idx === null) return;
  const el = lineRefs.get(idx);
  if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});

const fontStyle = computed(() => ({
  fontFamily: EDITOR_FONT_FAMILY,
}));

// ── Active line (for 'active' mode) ─────────────────────────────────────────

const activeLine = computed<ILine | null>(() => {
  const idx = activeLineIndex.value;
  if (idx === null) return null;
  const line = store.document.lines[idx] ?? null;
  if (!line) return null;
  return line.tokens.some((t) => t.kind === 'WORD') ? line : null;
});

// ── All lines (for 'all' mode) — includes empty lines as spacers ────────────

const allLines = computed<{ line: ILine; docIndex: number; hasWords: boolean }[]>(() =>
  store.document.lines.map((line, docIndex) => ({
    line,
    docIndex,
    hasWords: line.tokens.some((t) => t.kind === 'WORD'),
  })),
);
</script>

<style scoped lang="scss">
// ── Single panel root ─────────────────────────────────────────────────────────

.alt-root {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 20px 8px;
  background: rgba(255, 255, 255, 0.04);
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  overflow-x: auto;
  overflow-y: hidden;
  white-space: nowrap;
  flex-shrink: 0;

  // Active line highlight in 'all' mode
  &--active {
    border-left: 2px solid rgba(100, 180, 255, 0.4);
    background: rgba(100, 180, 255, 0.06);
  }
}

// ── Scroll container for 'all' mode ──────────────────────────────────────────

.alt-all {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  height: 100%;
  width: 100%; // fill whatever the parent pe-pane--settings gives us
  flex-shrink: 0;
  border-left: 1px solid rgba(255, 255, 255, 0.07);
  padding: 16px 0;

  .alt-root {
    border-top: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }
}

// Spacer for empty lines — must match CM line height exactly
// CM: fontSize 1rem, lineHeight 1.9 → height = 1 * 1.9rem
.alt-spacer {
  flex-shrink: 0;
  height: 1.9rem;
  width: 100%;
}

// ── Slide transition (active mode) ───────────────────────────────────────────

.toolbar-slide-enter-active,
.toolbar-slide-leave-active {
  transition:
    max-height 0.18s ease,
    opacity 0.15s ease;
  max-height: 100px;
  overflow: hidden;
}

.toolbar-slide-enter-from,
.toolbar-slide-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>
