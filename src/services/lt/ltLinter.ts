/**
 * ltLinter.ts
 *
 * CodeMirror 6 linter extension that calls the LanguageTool public API.
 * Returns underlined diagnostics with replacement actions.
 *
 * Public API limits (https://dev.languagetool.org/public-http-api):
 *   - 20 requests / IP / minute
 *   - 75 KB text / IP / minute
 *   - 20 KB text / request
 *   - Up to 30 misspelled-word suggestions per request
 *
 * Attribution: https://languagetool.org (required by the terms of service).
 */

import { linter, type Diagnostic } from '@codemirror/lint';
import type { EditorView } from '@codemirror/view';
import type { Language } from 'src/model/Language';

const LT_ENDPOINT = 'https://api.languagetool.org/v2/check';

/** Maximum text size per request as per LT public API TOS. */
const LT_MAX_BYTES = 20_000;

/** Public API rate limit — export so UI can display it. */
export const LT_MAX_CALLS_PER_MINUTE = 20;
const LT_WINDOW_MS = 60_000;

/**
 * Sliding-window rate limiter.  Tracks timestamps of the last N requests
 * within a rolling 60-second window. `tryAcquire()` registers + returns true
 * when a slot is available; returns false when the window is full.
 */
class SlidingWindowLimiter {
  private readonly ts: number[] = [];
  private readonly max: number;

  constructor(max: number) {
    this.max = max;
  }

  tryAcquire(): boolean {
    const now = Date.now();
    // Evict timestamps older than the window
    while (this.ts.length > 0 && now - this.ts[0]! >= LT_WINDOW_MS) this.ts.shift();
    if (this.ts.length >= this.max) return false;
    this.ts.push(now);
    return true;
  }

  /** How many requests remain in the current window (for display). */
  remaining(): number {
    const now = Date.now();
    while (this.ts.length > 0 && now - this.ts[0]! >= LT_WINDOW_MS) this.ts.shift();
    return Math.max(0, this.max - this.ts.length);
  }
}

const rateLimiter = new SlidingWindowLimiter(LT_MAX_CALLS_PER_MINUTE);

/** Map app Language → LanguageTool language code */
const LT_LANG: Record<Language, string> = {
  ua: 'uk-UA',
  pl: 'pl-PL',
  'en-us': 'en-US',
  'en-gb': 'en-GB',
};

interface LtMatch {
  message: string;
  offset: number;
  length: number;
  rule: { issueType: string };
  replacements: { value: string }[];
}

interface LtResponse {
  matches: LtMatch[];
}

/** Shared AbortController so rapid doc changes cancel the in-flight request. */
let currentAbort: AbortController | null = null;

/**
 * Truncate text to at most LT_MAX_BYTES UTF-8 bytes, breaking on a whitespace
 * boundary so we don't cut a word in half.
 */
function truncateText(text: string): { text: string; truncated: boolean } {
  const enc = new TextEncoder();
  if (enc.encode(text).length <= LT_MAX_BYTES) return { text, truncated: false };

  // Binary-search for the largest character count that fits in LT_MAX_BYTES bytes
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (enc.encode(text.slice(0, mid)).length <= LT_MAX_BYTES) lo = mid;
    else hi = mid - 1;
  }
  // Walk back to the nearest whitespace
  while (lo > 0 && !/\s/.test(text[lo - 1]!)) lo--;
  return { text: text.slice(0, lo), truncated: true };
}

async function queryLt(text: string, lang: string, signal: AbortSignal): Promise<LtMatch[]> {
  // Guard against exceeding the sliding-window rate limit
  if (!rateLimiter.tryAcquire()) {
    console.warn('[LT] rate limit reached — skipping request');
    return [];
  }

  const { text: safeText } = truncateText(text);
  const body = new URLSearchParams({ text: safeText, language: lang });
  const resp = await fetch(LT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal,
  });

  if (resp.status === 429) {
    // Rate-limited — return empty so diagnostics are not cleared
    console.warn('[LT] rate limited (429) — skipping this check');
    return [];
  }
  if (!resp.ok) {
    console.warn(`[LT] API error ${resp.status}`);
    return [];
  }

  const data = (await resp.json()) as LtResponse;
  return data.matches ?? [];
}

function ltSeverity(issueType: string): Diagnostic['severity'] {
  if (issueType === 'misspelling') return 'error';
  if (issueType === 'grammar') return 'warning';
  return 'info';
}

function buildDiagnostics(view: EditorView, matches: LtMatch[]): Diagnostic[] {
  const docLen = view.state.doc.length;
  return matches
    .map((m): Diagnostic | null => {
      const from = m.offset;
      const to = m.offset + m.length;
      if (from < 0 || to > docLen || from >= to) return null;
      const diag: Diagnostic = {
        from,
        to,
        severity: ltSeverity(m.rule.issueType),
        message: m.message,
      };
      if (m.replacements.length > 0) {
        diag.actions = m.replacements.slice(0, 5).map((r) => ({
          name: r.value,
          apply(v: EditorView, f: number, t: number) {
            v.dispatch({ changes: { from: f, to: t, insert: r.value } });
          },
        }));
      }
      return diag;
    })
    .filter((d): d is Diagnostic => d !== null);
}

/**
 * Returns a CM6 linter extension that checks text against LanguageTool.
 * Pass the current document language so LT uses the right grammar rules.
 *
 * Respects public API limits: 3 s debounce keeps requests ≤ 20/min.
 * Text over 20 KB is truncated at a word boundary (API hard limit).
 */
export function ltLinter(language: Language) {
  return linter(
    async (view: EditorView): Promise<Diagnostic[]> => {
      currentAbort?.abort();
      const ctrl = new AbortController();
      currentAbort = ctrl;

      const text = view.state.doc.toString();
      if (!text.trim()) return [];

      try {
        const matches = await queryLt(text, LT_LANG[language], ctrl.signal);
        return buildDiagnostics(view, matches);
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === 'AbortError') return [];
        console.warn('[LT] fetch error:', e);
        return [];
      }
    },
    // 3 s debounce keeps us safely within the 20 req/min public API limit
    // even during continuous editing sessions.
    { delay: 3000 },
  );
}
