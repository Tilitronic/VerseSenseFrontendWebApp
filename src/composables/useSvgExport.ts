/**
 * useSvgExport.ts
 *
 * Generates a compact standalone SVG of the phonetic visualization grid.
 *
 * No title/header/footer — only the syllable grid with row numbers, syllable
 * counts and C/V ratios (matching what is visible in the UI), plus a small
 * version watermark in the bottom-right corner.
 *
 * Filename encodes a FNV-1a hash of the raw poem text so every unique poem
 * produces a unique filename.
 */

import type { ILine, IWordToken } from 'src/model/Token';
import { ipaTokenStyle } from 'src/services/phonetic/ipaColorMap';
import type { TokenVisual } from 'src/services/phonetic/ipaColorMap';
import { buildVisualizationLineItems } from 'src/services/phonetic/visualizationLine';

// ── Layout constants ──────────────────────────────────────────────────────────

const CW = 52; // cell width (px)
const CH = 38; // cell height (px)
const NW = 26; // row-number column width (px)
const BW = 22; // syl-count badge width (px)
const CVW = 28; // C/V ratio badge width (px)
const LEFT_MARGIN = NW + BW + CVW; // total left margin
const RG = 5; // vertical gap between rows (px)
const BLANK_H = 12; // blank-row height (px)
const PAD = 12; // outer SVG padding (px)

const FONT_UI = "system-ui, 'Helvetica Neue', Arial, sans-serif";
const FONT_IPA = "'Georgia', 'Noto Serif', serif";

// ── Text hash (FNV-1a 32-bit, base-36, 7 chars) ─────────────────────────────

export function textHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  }
  return h.toString(36).padStart(7, '0').slice(0, 7);
}

// ── XML escaping ──────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const VOWEL_RE = /[æɛɪɒʌɑɔəɜʊaeiouаеєиіїоуюя]/i;
function isVowelTok(tok: string): boolean {
  return VOWEL_RE.test(tok[0] ?? '');
}

// ── Row data model ────────────────────────────────────────────────────────────

interface SylCell {
  type: 'syl';
  stressed: boolean;
  wordLast: boolean;
  ipaTokens: string[];
  /** render-key for each IPA token: "{wordId}:{sylIdx}:{tokIdx}" */
  tokenKeys: string[];
}
interface TabCell {
  type: 'tab';
}
type Cell = SylCell | TabCell;

interface GridRow {
  lineIdx: number;
  kind: 'blank' | 'pending' | 'content';
  cells: Cell[];
  /** Number of syllable cells (countsAsSyllable) for content rows */
  sylCount: number;
  /** C/V ratio string e.g. "1.5" */
  cvRatio: string;
}

// ── Build rows ────────────────────────────────────────────────────────────────

function computeCvRatio(cells: Cell[]): string {
  let vowels = 0;
  let consonants = 0;
  for (const cell of cells) {
    if (cell.type !== 'syl') continue;
    for (const tok of cell.ipaTokens) {
      if (isVowelTok(tok)) vowels++;
      else consonants++;
    }
  }
  if (vowels === 0) return consonants > 0 ? '∞' : '–';
  const r = consonants / vowels;
  return r % 1 === 0 ? String(r) : r.toFixed(1);
}

function buildRows(lines: ILine[], isLineConfirmed: (id: string) => boolean): GridRow[] {
  const rows: GridRow[] = [];

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]!;
    const wordTokens = line.tokens.filter((t): t is IWordToken => t.kind === 'WORD');

    if (line.tokens.length === 0 || (wordTokens.length === 0 && !isLineConfirmed(line.id))) {
      rows.push({ lineIdx: li, kind: 'blank', cells: [], sylCount: 0, cvRatio: '–' });
      continue;
    }

    if (!isLineConfirmed(line.id)) {
      rows.push({ lineIdx: li, kind: 'pending', cells: [], sylCount: 0, cvRatio: '–' });
      continue;
    }

    const cells: Cell[] = [];
    let sylCount = 0;
    for (const item of buildVisualizationLineItems(line)) {
      if (item.type === 'tab') {
        cells.push({ type: 'tab' });
        continue;
      }
      if (item.countsAsSyllable) sylCount++;
      cells.push({
        type: 'syl',
        stressed: item.stressed ?? false,
        wordLast: item.wordLast ?? false,
        ipaTokens: item.ipaTokens ?? [],
        tokenKeys: item.renderKeys ?? [],
      });
    }
    const cvRatio = computeCvRatio(cells);
    rows.push({ lineIdx: li, kind: 'content', cells, sylCount, cvRatio });
  }

  return rows;
}

function rowH(row: GridRow): number {
  return row.kind === 'blank' ? BLANK_H : CH;
}

function gridHeight(rows: GridRow[]): number {
  return rows.reduce((sum, r) => sum + rowH(r) + RG, 0);
}

function maxCells(rows: GridRow[]): number {
  return rows.reduce((m, r) => Math.max(m, r.cells.length), 0);
}

// ── Token ribbon layout ───────────────────────────────────────────────────────

interface TokRender {
  x: number;
  y: number;
  w: number;
  h: number;
  rx: number;
  color: string;
  symbol: string;
}

function layoutTokens(
  ipaTokens: string[],
  tokenKeys: string[],
  cellX: number,
  cellY: number,
  styleMap: Map<string, TokenVisual>,
): TokRender[] {
  if (ipaTokens.length === 0) return [];

  const n = ipaTokens.length;
  // Estimate each token's display width (IPA chars can be wide)
  const tokW = ipaTokens.map((t) => Math.max(14, Math.min(26, t.length * 7 + 6)));
  const totalW = tokW.reduce((a, b) => a + b, 0);
  const availW = CW - 4;
  const scale = totalW > availW ? availW / totalW : 1;

  let x = cellX + 2 + (availW - totalW * scale) / 2;
  const out: TokRender[] = [];

  for (let i = 0; i < n; i++) {
    const symbol = ipaTokens[i]!;
    const key = tokenKeys[i]!;
    const visual = styleMap.get(key) ?? ipaTokenStyle(symbol, 0.22);

    const rw = tokW[i]! * scale;
    const hFrac = visual ? parseFloat(visual.height) / 100 : 0.62;
    const rh = Math.max(8, CH * hFrac);
    const ry = cellY + (CH - rh) / 2;

    const rxStr = visual?.borderRadius.split(' ')[0] ?? '4px';
    const corner = Math.min(parseFloat(rxStr), rh / 2, rw / 2);

    const color =
      visual?.background ?? (isVowelTok(symbol) ? 'hsla(28,64%,58%,0.25)' : 'rgba(0,0,0,0.1)');

    out.push({ x, y: ry, w: rw, h: rh, rx: corner, color, symbol });
    x += rw;
  }

  return out;
}

// ── SVG cell rendering ────────────────────────────────────────────────────────

function renderSvgCell(
  cell: Cell,
  x: number,
  y: number,
  styleMap: Map<string, TokenVisual>,
): string {
  if (cell.type === 'tab') {
    return (
      `<rect x="${x}" y="${y}" width="${CW}" height="${CH}" ` +
      `fill="rgba(0,0,0,0.02)" stroke="rgba(0,0,0,0.18)" stroke-width="1" stroke-dasharray="4 2"/>`
    );
  }

  const parts: string[] = [];

  // Cell body (always white — stressed adds dot overlay on top)
  parts.push(
    `<rect x="${x}" y="${y}" width="${CW}" height="${CH}" ` +
      `fill="#ffffff" stroke="#000" stroke-width="1"/>`,
  );

  // Dot overlay for stressed syllables
  if (cell.stressed) {
    parts.push(
      `<rect x="${x}" y="${y}" width="${CW}" height="${CH}" fill="url(#sd)"/>`,
    );
  }

  // Word-last thick right border overlay
  if (cell.wordLast) {
    parts.push(
      `<line x1="${x + CW}" y1="${y}" x2="${x + CW}" y2="${y + CH}" ` +
        `stroke="#000" stroke-width="3"/>`,
    );
  }

  // Token ribbons + IPA text
  const toks = layoutTokens(cell.ipaTokens, cell.tokenKeys, x, y, styleMap);
  for (const t of toks) {
    parts.push(
      `<rect x="${t.x.toFixed(1)}" y="${t.y.toFixed(1)}" ` +
        `width="${t.w.toFixed(1)}" height="${t.h.toFixed(1)}" ` +
        `rx="${t.rx.toFixed(1)}" fill="${esc(t.color)}"/>`,
    );
    parts.push(
      `<text x="${(t.x + t.w / 2).toFixed(1)}" y="${(t.y + t.h / 2).toFixed(1)}" ` +
        `font-family="${FONT_IPA}" font-size="9" font-weight="600" fill="rgba(0,0,0,0.85)" ` +
        `text-anchor="middle" dominant-baseline="central">${esc(t.symbol)}</text>`,
    );
  }

  return parts.join('');
}

// ── SVG row rendering ─────────────────────────────────────────────────────────

function renderSvgRow(
  row: GridRow,
  y: number,
  styleMap: Map<string, TokenVisual>,
  showNumBadge: boolean,
  showSylBadge: boolean,
  showCvBadge: boolean,
): string {
  if (row.kind === 'blank') return '';

  const midY = y + rowH(row) / 2;
  const parts: string[] = [];

  // Row number badge (rounded square)
  const numSize = 20;
  const numCX = NW / 2;
  if (showNumBadge) {
    const numX = (NW - numSize) / 2;
    const numY = y + (CH - numSize) / 2;
    parts.push(
      `<rect x="${numX.toFixed(1)}" y="${numY.toFixed(1)}" ` +
        `width="${numSize}" height="${numSize}" rx="4" fill="#000"/>`,
    );
  }
  parts.push(
    `<text x="${numCX.toFixed(1)}" y="${midY.toFixed(1)}" ` +
      `font-family="${FONT_UI}" font-size="10" font-weight="700" ` +
      `fill="${showNumBadge ? '#fff' : 'rgba(0,0,0,0.28)'}" ` +
      `text-anchor="middle" dominant-baseline="central">${row.lineIdx + 1}</text>`,
  );

  if (row.kind === 'content') {
    // Syllable count badge (circle)
    const sylCX = NW + BW / 2;
    if (showSylBadge) {
      parts.push(
        `<circle cx="${sylCX.toFixed(1)}" cy="${midY.toFixed(1)}" r="9" fill="#000"/>`,
      );
    }
    parts.push(
      `<text x="${sylCX.toFixed(1)}" y="${midY.toFixed(1)}" ` +
        `font-family="${FONT_UI}" font-size="8" font-weight="700" ` +
        `fill="${showSylBadge ? '#fff' : 'rgba(0,0,0,0.4)'}" ` +
        `text-anchor="middle" dominant-baseline="central">${row.sylCount}</text>`,
    );

    // C/V ratio badge (diamond)
    const cvCX = NW + BW + CVW / 2;
    const cvHalf = 10;
    if (showCvBadge) {
      parts.push(
        `<polygon points="` +
          `${(cvCX).toFixed(1)},${(midY - cvHalf).toFixed(1)} ` +
          `${(cvCX + cvHalf).toFixed(1)},${(midY).toFixed(1)} ` +
          `${(cvCX).toFixed(1)},${(midY + cvHalf).toFixed(1)} ` +
          `${(cvCX - cvHalf).toFixed(1)},${(midY).toFixed(1)}" ` +
          `fill="#000"/>`,
      );
    }
    parts.push(
      `<text x="${cvCX.toFixed(1)}" y="${midY.toFixed(1)}" ` +
        `font-family="${FONT_UI}" font-size="7.5" font-weight="700" ` +
        `fill="${showCvBadge ? '#fff' : 'rgba(0,0,0,0.32)'}" ` +
        `text-anchor="middle" dominant-baseline="central">${esc(row.cvRatio)}</text>`,
    );
  }

  if (row.kind === 'pending') {
    parts.push(
      `<text x="${(LEFT_MARGIN + 6).toFixed(1)}" y="${midY.toFixed(1)}" ` +
        `font-family="${FONT_UI}" font-size="11" fill="rgba(0,0,0,0.12)" ` +
        `dominant-baseline="central">· · ·</text>`,
    );
    return parts.join('');
  }

  // Content: syllable cells
  let cx = LEFT_MARGIN;
  for (const cell of row.cells) {
    parts.push(renderSvgCell(cell, cx, y, styleMap));
    cx += CW;
  }

  return parts.join('');
}

// ── Main export function ──────────────────────────────────────────────────────

/**
 * Generates a compact SVG of the phonetic visualization grid.
 *
 * No header or footer — only the grid (row number, syllable count, C/V ratio,
 * syllable cells) with a small version watermark in the bottom-right corner.
 *
 * @param lines             Document lines (from poetry store)
 * @param isLineConfirmed   Per-line confirmation predicate
 * @param tokenStyleMap     Pre-computed token → TokenVisual map (from PhoneticPanel)
 * @param visualizerVersion VerseSense build version string
 * @param analyzerVersion   ipa-poetry-engine version string (from analysisResult.analyzer.version)
 * @param showNumBadge      Whether to render the row-number badge background
 * @param showSylBadge      Whether to render the syllable-count badge background
 * @param showCvBadge       Whether to render the C/V-ratio badge background
 */
export function generateVisualizationSvg(
  lines: ILine[],
  isLineConfirmed: (id: string) => boolean,
  tokenStyleMap: Map<string, TokenVisual>,
  visualizerVersion = '',
  analyzerVersion = '',
  showNumBadge = true,
  showSylBadge = true,
  showCvBadge = true,
): string {
  const rows = buildRows(lines, isLineConfirmed);
  const gh = gridHeight(rows);
  const mc = maxCells(rows);
  const contentW = LEFT_MARGIN + mc * CW;
  const svgW = contentW + PAD * 2;
  const svgH = PAD + gh + PAD + 14; // grid + bottom padding + watermark row

  const gridStartY = PAD;

  const out: string[] = [];

  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
      `width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">`,
  );

  // Stressed-syllable dot pattern
  out.push(
    `<defs>` +
      `<pattern id="sd" width="4" height="8" patternUnits="userSpaceOnUse">` +
        `<rect x="0" y="0" width="3" height="8" fill="rgba(0,0,0,0.245)"/>` +
      `</pattern>` +
    `</defs>`,
  );

  // White background
  out.push(`<rect width="${svgW}" height="${svgH}" fill="#fff"/>`);

  // ── Grid rows ───────────────────────────────────────────────────────────────
  out.push('<g id="phonetic-grid">');
  let y = gridStartY;
  for (const row of rows) {
    out.push(renderSvgRow(row, y, tokenStyleMap, showNumBadge, showSylBadge, showCvBadge));
    y += rowH(row) + RG;
  }
  out.push('</g>');

  // ── Version watermark (bottom-right corner) ─────────────────────────────────
  const watermarkParts: string[] = [];
  if (visualizerVersion) watermarkParts.push(`vs ${visualizerVersion}`);
  if (analyzerVersion) watermarkParts.push(`engine ${analyzerVersion}`);
  const watermark = watermarkParts.join(' · ');

  if (watermark) {
    out.push(
      `<text x="${svgW - PAD}" y="${svgH - 4}" ` +
        `font-family="${FONT_UI}" font-size="7" fill="rgba(0,0,0,0.2)" text-anchor="end">` +
        `${esc(watermark)}</text>`,
    );
  }

  out.push('</svg>');
  return out.join('\n');
}

// ── Browser download helper ───────────────────────────────────────────────────

export function downloadSvg(svgString: string, filename = 'phonetic.svg'): void {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
