/**
 * poetryEditorExtension.ts
 *
 * CodeMirror 6 extension that enforces "poetry document" editing rules:
 *
 * VISUAL:
 *   - Leading tabs on a line → rendered as a visible "→" glyph
 *   - End of every non-empty line → rendered as a visible "↵" glyph
 *   - Inter-word spaces → rendered as a mid-dot "·" glyph
 *
 * EDITING:
 *   - Paste (Ctrl+V): intercepted at DOM level — text is normalized
 *     (each line trailing-trimmed) before insertion
 *   - Cut (Ctrl+X): intercepted at DOM level — copies only the plain
 *     text of the selection (no inert glyph chars), then deletes it
 *   - Trailing whitespace: auto-trimmed via transactionFilter on every change
 */

import {
  ViewPlugin,
  Decoration,
  WidgetType,
  EditorView,
  GutterMarker,
  gutter,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';
import {
  RangeSetBuilder,
  EditorState,
  EditorSelection,
  StateEffect,
  StateField,
  type Extension,
} from '@codemirror/state';

// ─── Glyph widgets ────────────────────────────────────────────────────────────

class NewlineWidget extends WidgetType {
  toDOM() {
    const span = document.createElement('span');
    span.className = 'cm-poetry-nl';
    span.textContent = '↵';
    span.setAttribute('aria-hidden', 'true');
    span.setAttribute('contenteditable', 'false');
    return span;
  }
  override ignoreEvent() {
    return true;
  }
  override get estimatedHeight() {
    return -1;
  }
}

class TabWidget extends WidgetType {
  toDOM() {
    const span = document.createElement('span');
    span.className = 'cm-poetry-tab';
    span.textContent = '\u2192'; // →
    span.setAttribute('aria-hidden', 'true');
    span.setAttribute('contenteditable', 'false');
    return span;
  }
  override ignoreEvent() {
    return true;
  }
  // Tell CM this widget is inline
  override get estimatedHeight() {
    return -1;
  }
}

class SpaceWidget extends WidgetType {
  toDOM() {
    const span = document.createElement('span');
    span.className = 'cm-poetry-space';
    span.textContent = '\u00b7'; // ·
    span.setAttribute('aria-hidden', 'true');
    span.setAttribute('contenteditable', 'false');
    return span;
  }
  override ignoreEvent() {
    return true;
  }
  override get estimatedHeight() {
    return -1;
  }
}

// Singleton widgets (no state → reusable)
const nlWidget = new NewlineWidget();
const tabWidget = new TabWidget();
const spaceWidget = new SpaceWidget();

// ─── Decoration builder ───────────────────────────────────────────────────────

/**
 * Returns a DecorationSet that:
 *  - replaces each leading \t with a TabWidget
 *  - replaces each inter-word / trailing space with a SpaceWidget + atomic mark
 *  - inserts a NewlineWidget BEFORE each \n (so it appears at line end)
 */
function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const text = line.text;
    const lineFrom = line.from;

    // 1. Leading tabs → TabWidget replacements
    let leadingTabEnd = 0;
    while (leadingTabEnd < text.length && text[leadingTabEnd] === '\t') {
      leadingTabEnd++;
    }
    for (let t = 0; t < leadingTabEnd; t++) {
      builder.add(lineFrom + t, lineFrom + t + 1, Decoration.replace({ widget: tabWidget }));
    }

    // 2. Inter-word / trailing whitespace → distinct glyph per character type
    //    space → · (mid-dot, word separator)
    //    tab   → → (arrow, indentation — rare after leading, but render distinctly)
    const afterLeading = text.slice(leadingTabEnd);
    let pos = 0;
    while (pos < afterLeading.length) {
      const ch = afterLeading[pos];
      if (ch === ' ' || ch === '\t') {
        const absPos = lineFrom + leadingTabEnd + pos;
        const widget = ch === '\t' ? tabWidget : spaceWidget;
        builder.add(absPos, absPos + 1, Decoration.replace({ widget }));
      }
      pos++;
    }

    // 3. Newline glyph inserted at line end (before the actual \n)
    if (i < doc.lines) {
      builder.add(line.to, line.to, Decoration.widget({ widget: nlWidget, side: 1 }));
    }
  }

  return builder.finish();
}

// ─── ViewPlugin ───────────────────────────────────────────────────────────────

export const poetryDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

// ─── Text normalizer ──────────────────────────────────────────────────────────

/**
 * Trims trailing whitespace from every line of an arbitrary string.
 * Used both for paste normalization and for the transaction filter.
 */
function normalizeText(raw: string): string {
  return raw
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n');
}

// ─── Paste / Cut DOM interceptors ─────────────────────────────────────────────

/**
 * Intercepts Ctrl+V (paste) at the DOM level.
 * Reads plain text from clipboard, normalizes it (trim trailing whitespace on
 * every line), then dispatches a clean insertion — completely bypassing CM's
 * own paste handler which does not normalize.
 */
export const poetryClipboardHandlers = EditorView.domEventHandlers({
  paste(event, view) {
    const raw = event.clipboardData?.getData('text/plain');
    if (raw === undefined) return false; // let browser handle it

    event.preventDefault();

    const clean = normalizeText(raw);
    const { state } = view;
    const changes = state.changeByRange((range) => ({
      changes: { from: range.from, to: range.to, insert: clean },
      range: EditorSelection.cursor(range.from + clean.length),
    }));
    view.dispatch(state.update(changes, { scrollIntoView: true, userEvent: 'input.paste' }));
    return true;
  },

  cut(event, view) {
    const { state } = view;
    // Build plain text from selection ranges — use the actual document text,
    // not the DOM (which would include widget glyphs like · and →).
    const parts: string[] = [];
    for (const range of state.selection.ranges) {
      if (!range.empty) parts.push(state.sliceDoc(range.from, range.to));
    }
    if (parts.length === 0) return false;

    const plain = parts.join('\n');
    event.clipboardData?.setData('text/plain', plain);
    event.preventDefault();

    // Delete the selected ranges
    const changes = state.changeByRange((range) =>
      range.empty
        ? { range }
        : {
            changes: { from: range.from, to: range.to, insert: '' },
            range: EditorSelection.cursor(range.from),
          },
    );
    view.dispatch(state.update(changes, { scrollIntoView: true, userEvent: 'delete.cut' }));
    return true;
  },
});

// ─── Transaction filter — double-space prevention ─────────────────────────────

/**
 * After any document change, collapses any run of two or more consecutive
 * spaces on affected lines into a single space.
 * A single trailing space is intentionally allowed so the user can type
 * "word " before the next word without the cursor jumping.
 * Paste is separately normalized by poetryClipboardHandlers (which also
 * trims trailing whitespace from pasted content).
 */
export const poetryTransactionFilter = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged) return tr;

  // Collect lines to scan
  const affectedLines = new Set<number>();
  tr.changes.iterChanges((_fromA, _toA, fromB, toB) => {
    const doc = tr.newDoc;
    const first = doc.lineAt(fromB).number;
    const last = doc.lineAt(toB).number;
    for (let n = Math.max(1, first - 1); n <= Math.min(doc.lines, last + 1); n++) {
      affectedLines.add(n);
    }
  });

  const fixes: { from: number; to: number }[] = [];
  for (const n of affectedLines) {
    const line = tr.newDoc.line(n);
    const re = / {2,}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line.text)) !== null) {
      // Collapse N spaces → 1 space: delete all but the first character of the run
      fixes.push({ from: line.from + m.index + 1, to: line.from + m.index + m[0].length });
    }
  }

  if (fixes.length === 0) return tr;

  fixes.sort((a, b) => a.from - b.from);
  return [
    tr,
    {
      changes: fixes.map(({ from, to }) => ({ from, to, insert: '' })),
      sequential: true,
    },
  ];
});

// ─── Stress-status gutter ─────────────────────────────────────────────────────
//
// A thin column to the right of the line-number gutter.
// Each line shows a coloured dot that encodes the stress coverage of that line:
//
//   ●  green   — every word has stress set AND language confirmed
//   ●  orange  — all stresses set but language not yet confirmed
//   ●  amber   — some words set, some not
//   ○  dim     — no words have stress (or line has no words)
//
// Data is pushed from Vue via a StateEffect so the gutter stays in sync with
// the Pinia store without polling.

export type StressLineStatus = 'all' | 'unconfirmed' | 'partial' | 'none';

/** Effect payload: a new per-line status array (index 0 = line 1) */
export const setStressStatusEffect = StateEffect.define<StressLineStatus[]>();

/** StateField that holds the current stress status for each line */
export const stressStatusField = StateField.define<StressLineStatus[]>({
  create: () => [],
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setStressStatusEffect)) return effect.value;
    }
    return value;
  },
});

class StressGutterMarker extends GutterMarker {
  constructor(private status: StressLineStatus) {
    super();
  }
  override toDOM() {
    const span = document.createElement('span');
    span.className = `cm-stress-dot cm-stress-dot--${this.status}`;
    span.setAttribute('aria-hidden', 'true');
    return span;
  }
}

const markerCache: Record<StressLineStatus, StressGutterMarker> = {
  all: new StressGutterMarker('all'),
  unconfirmed: new StressGutterMarker('unconfirmed'),
  partial: new StressGutterMarker('partial'),
  none: new StressGutterMarker('none'),
};

export const stressGutter = gutter({
  class: 'cm-stress-gutter',
  markers(view) {
    const statuses = view.state.field(stressStatusField, false) ?? [];
    const builder = new RangeSetBuilder<GutterMarker>();
    const doc = view.state.doc;
    for (let i = 1; i <= doc.lines; i++) {
      const status: StressLineStatus = statuses[i - 1] ?? 'none';
      builder.add(doc.line(i).from, doc.line(i).from, markerCache[status]);
    }
    return builder.finish();
  },
  initialSpacer: () => markerCache['none'],
});

// ─── CSS (injected via EditorView.baseTheme) ──────────────────────────────────

export const poetryThemeBase = EditorView.baseTheme({
  '.cm-poetry-nl': {
    color: 'rgba(255,255,255,0.20)',
    fontStyle: 'normal',
    userSelect: 'none',
    '-webkit-user-select': 'none',
    pointerEvents: 'none',
    cursor: 'default',
  },
  '.cm-poetry-tab': {
    color: 'rgba(120,180,255,0.45)' /* blue-ish — indentation */,
    userSelect: 'none',
    '-webkit-user-select': 'none',
    pointerEvents: 'none',
    display: 'inline-block',
    width: '1ch' /* exactly one monofont character cell */,
    textAlign: 'center',
  },
  '.cm-poetry-space': {
    color: 'rgba(255,255,255,0.22)' /* grey — word separator */,
    userSelect: 'none',
    '-webkit-user-select': 'none',
    pointerEvents: 'none',
    display: 'inline-block',
    width: '1ch' /* exactly one monofont character cell */,
    textAlign: 'center',
  },
  '.cm-stress-gutter': {
    width: '16px',
  },
  /* Each per-line cell inside the stress gutter */
  '.cm-stress-gutter .cm-gutterElement': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 !important',
    lineHeight: '1.9' /* must match .cm-content lineHeight */,
  },
  /* Kill the active-line highlight that bleeds from highlightActiveLineGutter() */
  '.cm-stress-gutter .cm-activeLineGutter': {
    background: 'transparent !important',
  },
  '.cm-stress-dot': {
    display: 'block',
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    flexShrink: '0',
    transition: 'background 0.2s',
  },
  '.cm-stress-dot--all': { background: 'rgba( 80,220,100,0.75)' },
  '.cm-stress-dot--unconfirmed': { background: 'rgba(255,140, 30,0.80)' },
  '.cm-stress-dot--partial': { background: 'rgba(230,170, 40,0.75)' },
  '.cm-stress-dot--none': { background: 'rgba(255,255,255,0.12)' },
});

// ─── Combined export ──────────────────────────────────────────────────────────

export function poetryEditorExtension(): Extension[] {
  return [
    stressStatusField,
    stressGutter,
    poetryDecorations,
    poetryClipboardHandlers,
    poetryTransactionFilter,
    poetryThemeBase,
  ];
}
