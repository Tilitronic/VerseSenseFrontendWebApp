<template>
  <div class="poetry-editor" :class="{ 'poetry-editor--all': appStore.toolbarMode === 'all' }">
    <!-- ── CM editor pane ─────────────────────────────────────── -->
    <div class="pe-pane pe-pane--editor" :style="editorPaneStyle">
      <div class="poetry-editor__cm-wrap">
        <codemirror
          v-model="text"
          :extensions="extensions"
          :autofocus="true"
          :indent-with-tab="true"
          :tab-size="1"
          class="poetry-editor__cm"
          @change="onChange"
          @ready="onReady"
        />
      </div>
      <!-- 'active' mode: toolbar docks below the editor -->
      <ActiveLineToolbar v-if="appStore.toolbarMode === 'active'" mode="active" />
    </div>

    <!-- ── Drag divider (only in 'all' mode when row settings visible) ── -->
    <div
      v-if="appStore.toolbarMode === 'all' && showRowSettings"
      class="pe-divider"
      @pointerdown="onDividerPointerDown"
    />

    <!-- ── Row settings pane ──────────────────────────────────── -->
    <div
      v-if="appStore.toolbarMode === 'all' && showRowSettings"
      class="pe-pane pe-pane--settings"
      :style="settingsPaneStyle"
    >
      <ActiveLineToolbar mode="all" :cm-scroll-top="cmScrollTop" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, watch, computed, onUnmounted } from 'vue';
import { Codemirror } from 'vue-codemirror';
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
} from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { history, defaultKeymap, historyKeymap, indentWithTab } from '@codemirror/commands';
import { indentOnInput } from '@codemirror/language';
import { keymap, lineNumbers } from '@codemirror/view';
import { usePoetryStore } from 'src/stores/poetry';
import { useAppStore } from 'src/stores/app';
import { EDITOR_FONT_FAMILY } from 'src/constants/fonts';
import {
  poetryEditorExtension,
  setStressStatusEffect,
  type StressLineStatus,
} from './poetryEditorExtension';
import ActiveLineToolbar from './ActiveLineToolbar.vue';
import type { IWordToken } from 'src/model/Token';

const poetryStore = usePoetryStore();
const appStore = useAppStore();

const { showRowSettings = true } = defineProps<{
  showRowSettings?: boolean;
}>();

// Local copy — prevents re-driving the editor on every keystroke
const text = ref(poetryStore.rawText);

// CodeMirror EditorView instance — shallowRef prevents Vue from deep-proxying it
const cmView = shallowRef<EditorView | null>(null);

// CM scroller scroll position — mirrored to the toolbar in 'all' mode
const cmScrollTop = ref(0);

/** CM update listener extension that tracks cursor line */
const activeLineTracker = EditorView.updateListener.of((update) => {
  if (update.selectionSet || update.docChanged) {
    const head = update.state.selection.main.head;
    const lineNo = update.state.doc.lineAt(head).number; // 1-based
    poetryStore.setActiveLineIndex(lineNo - 1);
  }
});

// Sync out: editor → store (debounced by CM's own change batching)
function onChange(val: string) {
  poetryStore.setRawText(val);
}

let _scrollCleanup: (() => void) | null = null;

function onReady(payload: { view: EditorView; state: unknown; container: unknown }) {
  cmView.value = payload.view;
  pushStressStatus(payload.view);

  // Mirror CM scroll position into cmScrollTop so the toolbar can sync
  const scroller = payload.view.scrollDOM;
  const onScroll = () => {
    cmScrollTop.value = scroller.scrollTop;
  };
  scroller.addEventListener('scroll', onScroll, { passive: true });
  _scrollCleanup = () => scroller.removeEventListener('scroll', onScroll);
}

onUnmounted(() => {
  _scrollCleanup?.();
});

/** Compute per-line stress status from the store and push it into CM */
function pushStressStatus(view: EditorView) {
  const doc = poetryStore.document;
  const statusMap = poetryStore.wordStressStatus;
  const statuses: StressLineStatus[] = doc.lines.map((line) => {
    const words = line.tokens.filter((t): t is IWordToken => t.kind === 'WORD');
    if (words.length === 0) return 'none';
    const setCount = words.filter((w) => statusMap.get(w.id) !== 'unset').length;
    if (setCount === 0) return 'none';
    if (setCount < words.length) return 'partial';
    // All stresses are set — check language confirmation
    return poetryStore.isLineConfirmed(line.id) ? 'all' : 'unconfirmed';
  });
  view.dispatch({ effects: setStressStatusEffect.of(statuses) });
}

// Re-push whenever store data changes (document rebuilt, stress updated, or language confirmed)
watch(
  () => [poetryStore.wordStressStatus, poetryStore.confirmedWords] as const,
  () => {
    if (cmView.value) pushStressStatus(cmView.value);
  },
  { deep: false },
);

// Sync in: if store changes from outside (e.g. Clear button), push back
watch(
  () => poetryStore.rawText,
  (val) => {
    if (val !== text.value) text.value = val;
  },
);

// ── Resizable split ──────────────────────────────────────────────────────────
// editorPct: percentage width of the editor pane (0–100); settings gets the rest.
// Default 50/50. Stored in px during drag, normalised to % on pointerup.
const editorPct = ref(50);

const editorPaneStyle = computed(() =>
  appStore.toolbarMode === 'all' && showRowSettings
    ? { width: `${editorPct.value}%` }
    : { flex: '1 1 0' },
);

const settingsPaneStyle = computed(() => ({
  width: `${100 - editorPct.value}%`,
}));

let dragStartX = 0;
let dragStartPct = 0;
let containerWidth = 0;

function onDividerPointerDown(e: PointerEvent) {
  e.preventDefault();
  dragStartX = e.clientX;
  dragStartPct = editorPct.value;
  const el = (e.currentTarget as HTMLElement).parentElement;
  containerWidth = el ? el.clientWidth : window.innerWidth;
  window.addEventListener('pointermove', onDividerPointerMove);
  window.addEventListener('pointerup', onDividerPointerUp);
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
}

function onDividerPointerMove(e: PointerEvent) {
  const delta = e.clientX - dragStartX;
  const deltaPct = (delta / containerWidth) * 100;
  editorPct.value = Math.min(80, Math.max(20, dragStartPct + deltaPct));
}

function onDividerPointerUp() {
  window.removeEventListener('pointermove', onDividerPointerMove);
  window.removeEventListener('pointerup', onDividerPointerUp);
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
}

// Static font theme — JetBrains Mono applied once at editor creation
const fontTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontFamily: EDITOR_FONT_FAMILY,
    fontSize: '1rem',
  },
  '.cm-content': {
    fontFamily: 'inherit',
    lineHeight: '1.9',
    padding: '16px 20px',
    caretColor: '#c9d1d9',
  },
  '.cm-line': { padding: '0' },
  '.cm-gutters': {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.18)',
    padding: '0',
  },
  /* Line-number cells: flex-center to match the stress dot column */
  '.cm-lineNumbers .cm-gutterElement': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: '0 4px 0 0 !important',
    lineHeight: '1.9',
  },
  '.cm-activeLineGutter': { background: 'rgba(255,255,255,0.04)' },
  /* Stress gutter must never get the active-line tint */
  '.cm-stress-gutter .cm-activeLineGutter': { background: 'transparent !important' },
  '.cm-activeLine': { background: 'rgba(255,255,255,0.04)' },
  // Tab / newline special chars
  '.cm-specialChar': { color: 'rgba(255,255,255,0.22)' },
  // Cursor
  '.cm-cursor': { borderLeftColor: '#c9d1d9' },
  // Selection
  '.cm-selectionBackground': { background: 'rgba(100,180,255,0.18) !important' },
  '&.cm-focused .cm-selectionBackground': { background: 'rgba(100,180,255,0.25) !important' },
});

const baseExtensions = [
  lineNumbers(),
  drawSelection(),
  highlightActiveLine(),
  highlightActiveLineGutter(),
  history(),
  indentOnInput(),
  keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
  EditorState.tabSize.of(1),
  EditorView.lineWrapping,
  // Prevent consecutive spaces (LaTeX/Markdown convention)
  EditorState.transactionFilter.of((tr) => {
    if (!tr.docChanged) return tr;
    // Only inspect pure insertions that are exactly a single space
    let insertsSpace = false;
    tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
      if (fromA === toA && inserted.toString() === ' ') insertsSpace = true;
    });
    if (!insertsSpace) return tr;
    // Check what sits immediately before the insertion point
    let blocked = false;
    tr.changes.iterChanges((fromA) => {
      const charBefore = fromA > 0 ? tr.startState.doc.sliceString(fromA - 1, fromA) : '';
      if (charBefore === ' ' || charBefore === '\t') blocked = true;
    });
    return blocked ? [] : tr;
  }),
  activeLineTracker,
  ...poetryEditorExtension(),
  fontTheme,
];

const extensions = baseExtensions;
</script>

<style scoped lang="scss">
.poetry-editor {
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  // In 'all' mode root becomes a row
  &--all {
    flex-direction: row;
  }
}

// ── Generic pane ─────────────────────────────────────────────────────────────
.pe-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  overflow: hidden;

  &--editor {
    // When not in split mode flex fills remaining space (set via style binding)
    flex-shrink: 0;
  }

  &--settings {
    flex-shrink: 0;
    overflow-x: auto; // horizontal scroll if content is wider
    overflow-y: hidden;
  }
}

// ── Drag divider ─────────────────────────────────────────────────────────────
.pe-divider {
  flex-shrink: 0;
  width: 4px;
  cursor: col-resize;
  background: rgba(255, 255, 255, 0.07);
  transition: background 0.12s;
  align-self: stretch;
  z-index: 5;

  &:hover {
    background: rgba(100, 180, 255, 0.35);
  }
}

// ── CM wrap ───────────────────────────────────────────────────────────────────
.poetry-editor__cm-wrap {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}

.poetry-editor__cm {
  width: 100%;
  height: 100%;
}

// CodeMirror fills its container
:deep(.cm-editor) {
  width: 100%;
  height: 100%;
  outline: none;
  background: transparent;
}

:deep(.cm-scroller) {
  overflow-y: auto;
  overflow-x: auto; // horizontal scroll enabled
}
</style>
