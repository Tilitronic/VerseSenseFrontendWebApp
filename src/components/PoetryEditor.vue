<template>
  <div class="poetry-editor" :class="{ 'poetry-editor--all': appStore.toolbarMode === 'all' }">
    <!-- ── CM editor pane ─────────────────────────────────────── -->
    <div class="pe-pane pe-pane--editor" :style="editorPaneStyle">
      <div class="poetry-editor__cm-wrap" @contextmenu.prevent="onContextMenu">
        <codemirror
          v-model="text"
          :extensions="extensions"
          :autofocus="true"
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

    <!-- ── Editor context menu ────────────────────────────────── -->
    <EditorContextMenu
      :visible="contextMenuVisible"
      :word="contextMenuWord"
      :x="contextMenuX"
      :y="contextMenuY"
      @close="contextMenuVisible = false"
      @copy="handleCopy"
      @cut="handleCut"
      @paste="handlePaste"
      @transform="handleTransform"
    />
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
import { EditorState, Compartment } from '@codemirror/state';
import { history, defaultKeymap, historyKeymap } from '@codemirror/commands';
import { indentOnInput } from '@codemirror/language';
import { keymap, lineNumbers } from '@codemirror/view';
import { lintGutter } from '@codemirror/lint';
import { usePoetryStore } from 'src/stores/poetry';
import { useAppStore } from 'src/stores/app';
import { EDITOR_FONT_FAMILY } from 'src/constants/fonts';
import { ltLinter } from 'src/services/lt/ltLinter';
import {
  poetryEditorExtension,
  setStressStatusEffect,
  type StressLineStatus,
} from './poetryEditorExtension';
import ActiveLineToolbar from './ActiveLineToolbar.vue';
import EditorContextMenu from './EditorContextMenu.vue';
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
  // When native browser spellcheck is toggled off via "Орфо", suppress the
  // browser's red squiggles. spellcheck="true" is always kept on the content
  // div so grammar extensions (LanguageTool) can still detect the field.
  // ::spelling-error is supported in Firefox; Chrome ignores it (minor UX cost
  // vs. silently breaking LT extension detection if we set spellcheck="false").
  '&.cm-native-spell-off .cm-content::spelling-error': {
    textDecoration: 'none',
    color: 'inherit',
  },
  // ── Lint / LanguageTool tooltip ───────────────────────────────────────────
  // CM6 inserts these directly into the editor DOM; they need explicit theming
  // because Quasar's dark-mode resets don't reach them.
  '.cm-tooltip': {
    zIndex: '9999',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.10)',
    boxShadow: '0 6px 24px rgba(0,0,0,0.65)',
    background: '#1e2330',
    color: '#c9d1d9',
    fontFamily: 'inherit',
    overflow: 'hidden',
    maxWidth: '360px',
  },
  '.cm-tooltip.cm-tooltip-lint': {
    padding: '0',
  },
  '.cm-diagnostic': {
    padding: '7px 10px 5px',
    fontSize: '0.8rem',
    lineHeight: '1.45',
    borderLeft: '3px solid transparent',
  },
  '.cm-diagnostic + .cm-diagnostic': {
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  '.cm-diagnostic-error': { borderLeftColor: '#e57373' },
  '.cm-diagnostic-warning': { borderLeftColor: '#ffb74d' },
  '.cm-diagnostic-info': { borderLeftColor: '#64b5f6' },
  '.cm-diagnosticAction': {
    display: 'inline-block',
    margin: '3px 3px 1px 0',
    padding: '1px 8px',
    fontSize: '0.75rem',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: '4px',
    color: '#c9d1d9',
    cursor: 'pointer',
    lineHeight: '1.6',
    verticalAlign: 'middle',
    fontFamily: 'inherit',
  },
  '.cm-diagnosticAction:hover': {
    background: 'rgba(255,255,255,0.16)',
  },
  // Gutter marker
  '.cm-lint-marker': { cursor: 'help' },
  // Align the lint gutter column to match the stress-dot gutter geometry
  '.cm-gutter-lint': { width: '16px' },
  '.cm-gutter-lint .cm-gutterElement': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 !important',
    lineHeight: '1.9',
  },
  '.cm-gutter-lint .cm-activeLineGutter': { background: 'transparent !important' },
  // Scale the marker icon down to match the 7 px stress dot
  '.cm-lint-marker img, .cm-lint-marker svg': {
    width: '7px',
    height: '7px',
    display: 'block',
  },
  // Underline colours
  '.cm-lintRange-error': {
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='3'%3E%3Cpath d='M0 2.5 L2 0.5 L4 2.5 L6 0.5' stroke='%23e57373' fill='none' stroke-width='1.2'/%3E%3C/svg%3E\")",
  },
  '.cm-lintRange-warning': {
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='3'%3E%3Cpath d='M0 2.5 L2 0.5 L4 2.5 L6 0.5' stroke='%23ffb74d' fill='none' stroke-width='1.2'/%3E%3C/svg%3E\")",
  },
});

/**
 * Tab key behaviour:
 * - Collapsed cursor at column 0 → insert literal \t at line start
 * - Selection spanning one or more lines → prepend \t to the start of every
 *   line that is at least partially covered by any selection range
 * - Anything else (cursor mid-line, no selection) → not handled (falls through)
 *
 * Shift-Tab: remove one leading \t from every touched line (same coverage rule).
 */
const insertLiteralTab = {
  key: 'Tab',
  run(view: EditorView): boolean {
    const { state } = view;

    // Collect unique line numbers touched by any selection range.
    // For a collapsed cursor this is just the cursor's line.
    // For a spanning selection it covers every line from anchor to head.
    const lineNums = new Set<number>();
    for (const r of state.selection.ranges) {
      const fromLine = state.doc.lineAt(r.from).number;
      const toLine = state.doc.lineAt(r.to).number;
      for (let n = fromLine; n <= toLine; n++) lineNums.add(n);
    }

    // Prepend \t to the start of every touched line
    const changes = [...lineNums].map((n) => {
      const line = state.doc.line(n);
      return { from: line.from, to: line.from, insert: '\t' };
    });
    view.dispatch(state.update({ changes, scrollIntoView: true, userEvent: 'input' }));
    return true; // always consume Tab — never fall through to defaultKeymap
  },
  shift(view: EditorView): boolean {
    const { state } = view;

    // Collect unique line numbers touched by any selection range
    const lineNums = new Set<number>();
    for (const r of state.selection.ranges) {
      const fromLine = state.doc.lineAt(r.from).number;
      const toLine = state.doc.lineAt(r.to).number;
      for (let n = fromLine; n <= toLine; n++) lineNums.add(n);
    }

    // Remove one leading \t from every touched line that has one
    const changes: { from: number; to: number; insert: string }[] = [];
    for (const n of lineNums) {
      const line = state.doc.line(n);
      if (line.text.startsWith('\t')) {
        changes.push({ from: line.from, to: line.from + 1, insert: '' });
      }
    }
    if (changes.length === 0) return true; // consume Shift-Tab even if nothing to remove
    view.dispatch(state.update({ changes, scrollIntoView: true, userEvent: 'delete' }));
    return true;
  },
};

const baseExtensions = [
  lineNumbers(),
  drawSelection(),
  highlightActiveLine(),
  highlightActiveLineGutter(),
  history(),
  indentOnInput(),
  keymap.of([insertLiteralTab, ...defaultKeymap, ...historyKeymap]),
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

// ── Compartments for hot-swappable settings ───────────────────────────────────
const spellcheckCompartment = new Compartment();
const langCompartment = new Compartment();
const ltCompartment = new Compartment();
const lintGutterCompartment = new Compartment();

/**
 * The LanguageTool browser extension (and any other grammar extension) detects
 * editable fields by checking for `spellcheck="true"` + a `lang` attribute.
 * If we set `spellcheck="false"`, the extension silently skips the field.
 *
 * Solution: `spellcheck` is ALWAYS "true" so the extension always finds the
 * editor. When the user turns off "Орфо", we instead add a CSS class
 * `.cm-native-spell-off` to the editor root and suppress `::spelling-error`
 * pseudo-element styling (works in Firefox; Chrome ignores the pseudo-element
 * but the underlines are minor noise compared to losing LT extension support).
 */
function spellcheckExt(enabled: boolean) {
  return [
    EditorView.contentAttributes.of({ spellcheck: 'true' }),
    EditorView.editorAttributes.of(enabled ? {} : { class: 'cm-native-spell-off' }),
  ];
}

/** Map app Language → BCP-47 tag for the `lang` attribute. */
const LANG_BCP47: Record<string, string> = {
  ua: 'uk',
  pl: 'pl',
  'en-us': 'en',
  'en-gb': 'en-GB',
};

function langExt(language: string) {
  const tag = LANG_BCP47[language] ?? 'uk';
  return EditorView.contentAttributes.of({ lang: tag });
}

function ltExt(enabled: boolean) {
  return enabled ? ltLinter(poetryStore.documentLanguage) : [];
}

function lintGutterExt(enabled: boolean) {
  return enabled ? lintGutter() : [];
}

const extensions = [
  ...baseExtensions,
  spellcheckCompartment.of(spellcheckExt(appStore.spellcheckEnabled)),
  langCompartment.of(langExt(poetryStore.documentLanguage)),
  ltCompartment.of(ltExt(appStore.ltEnabled)),
  lintGutterCompartment.of(lintGutterExt(appStore.ltEnabled)),
];

// Reconfigure compartments reactively
watch(
  () => appStore.spellcheckEnabled,
  (val) => {
    cmView.value?.dispatch({
      effects: spellcheckCompartment.reconfigure(spellcheckExt(val)),
    });
  },
);

watch(
  () => appStore.ltEnabled,
  (val) => {
    cmView.value?.dispatch({
      effects: [
        ltCompartment.reconfigure(ltExt(val)),
        lintGutterCompartment.reconfigure(lintGutterExt(val)),
      ],
    });
  },
);

// If document language changes while LT is on, reconfigure with updated lang
watch(
  () => poetryStore.documentLanguage,
  (lang) => {
    const effects = [langCompartment.reconfigure(langExt(lang))];
    if (appStore.ltEnabled) effects.push(ltCompartment.reconfigure(ltExt(true)));
    cmView.value?.dispatch({ effects });
  },
);

// ── Context menu ──────────────────────────────────────────────────────────────
const contextMenuVisible = ref(false);
const contextMenuWord = ref<string | null>(null);
const contextMenuWordRange = ref<{ from: number; to: number } | null>(null);
const contextMenuX = ref(0);
const contextMenuY = ref(0);

/** Extract the word (including apostrophes) at a CM document position. */
function extractWordAtPos(
  view: EditorView,
  pos: number,
): { text: string; from: number; to: number } | null {
  const line = view.state.doc.lineAt(pos);
  const offset = pos - line.from;
  const txt = line.text;
  const isWordChar = (ch: string) => /[\p{L}'ʼ\u2019]/u.test(ch);
  let start = offset;
  let end = offset;
  while (start > 0 && isWordChar(txt[start - 1]!)) start--;
  while (end < txt.length && isWordChar(txt[end]!)) end++;
  if (start === end || !/\p{L}/u.test(txt.slice(start, end))) return null;
  return { text: txt.slice(start, end), from: line.from + start, to: line.from + end };
}

function onContextMenu(e: MouseEvent) {
  const view = cmView.value;
  if (!view) return;
  contextMenuX.value = e.clientX;
  contextMenuY.value = e.clientY;
  const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
  if (pos !== null) {
    const result = extractWordAtPos(view, pos);
    contextMenuWord.value = result?.text ?? null;
    contextMenuWordRange.value = result ? { from: result.from, to: result.to } : null;
  } else {
    contextMenuWord.value = null;
    contextMenuWordRange.value = null;
  }
  contextMenuVisible.value = true;
}

async function handleCopy() {
  const view = cmView.value;
  if (!view) return;
  const sel = view.state.selection.main;
  const text =
    sel.from !== sel.to ? view.state.sliceDoc(sel.from, sel.to) : (contextMenuWord.value ?? '');
  if (text) await navigator.clipboard.writeText(text);
}

function handleCut() {
  const view = cmView.value;
  const range = contextMenuWordRange.value;
  const word = contextMenuWord.value;
  if (!view || !range || !word) return;
  void navigator.clipboard.writeText(word);
  view.dispatch({ changes: { from: range.from, to: range.to, insert: '' } });
}

async function handlePaste() {
  const view = cmView.value;
  if (!view) return;
  try {
    const text = await navigator.clipboard.readText();
    const { from, to } = view.state.selection.main;
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
    });
    view.focus();
  } catch {
    // clipboard permission denied — ignore
  }
}

function handleTransform(kind: 'capitalize' | 'lowercase' | 'uppercase') {
  const view = cmView.value;
  const range = contextMenuWordRange.value;
  const word = contextMenuWord.value;
  if (!view || !range || !word) return;
  let result: string;
  if (kind === 'capitalize') result = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  else if (kind === 'lowercase') result = word.toLowerCase();
  else result = word.toUpperCase();
  view.dispatch({ changes: { from: range.from, to: range.to, insert: result } });
}
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
