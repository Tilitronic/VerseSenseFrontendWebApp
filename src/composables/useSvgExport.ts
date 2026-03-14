/**
 * useSvgExport.ts
 *
 * Generates a standalone SVG of the phonetic visualization grid.
 *
 * Includes:
 *  - Syllable grid with row numbers and sound-pattern colour highlights
 *  - Legend (умовні позначення): psychoacoustic groups, vowels, cell types
 *  - Demo-version header + footer notice
 */

import type { ILine, IWordToken } from 'src/model/Token';
import { transcribeWord } from 'src/services/phonetic/wordTranscription';
import {
  ipaTokenStyle,
  PSYCHO_GROUP_INFO,
  VOWEL_GROUP_INFO,
} from 'src/services/phonetic/ipaColorMap';
import type { TokenVisual } from 'src/services/phonetic/ipaColorMap';

// ── Layout constants ──────────────────────────────────────────────────────────

const CW = 52;       // cell width (px)
const CH = 38;       // cell height (px)
const NW = 26;       // row-number column width (px)
const RG = 5;        // vertical gap between rows (px)
const BLANK_H = 12;  // blank-row height (px)
const PAD = 22;      // outer SVG padding (px)
// When legend is included the cell-type row needs 4×150 = 600px available
const LEGEND_MIN_SVG_W = 644;

const HEADER_H = 58;       // height of title/subtitle area
const LEGEND_GAP = 28;     // gap between grid and legend

const FONT_UI  = "system-ui, 'Helvetica Neue', Arial, sans-serif";
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

function isPunct(text: string): boolean {
  return !/[\p{L}]/u.test(text);
}

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
interface TabCell { type: 'tab' }
type Cell = SylCell | TabCell;

interface GridRow {
  lineIdx: number;
  kind: 'blank' | 'pending' | 'content';
  cells: Cell[];
}

// ── Build rows ────────────────────────────────────────────────────────────────

function buildRows(
  lines: ILine[],
  isLineConfirmed: (id: string) => boolean,
): GridRow[] {
  const rows: GridRow[] = [];

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]!;
    const wordTokens = line.tokens.filter(
      (t): t is IWordToken => t.kind === 'WORD' && !isPunct(t.text),
    );

    if (line.tokens.length === 0 || (wordTokens.length === 0 && !isLineConfirmed(line.id))) {
      rows.push({ lineIdx: li, kind: 'blank', cells: [] });
      continue;
    }

    if (!isLineConfirmed(line.id)) {
      rows.push({ lineIdx: li, kind: 'pending', cells: [] });
      continue;
    }

    const cells: Cell[] = [];
    for (const tok of line.tokens) {
      if (tok.kind === 'TAB') {
        cells.push({ type: 'tab' });
        continue;
      }
      if (tok.kind !== 'WORD' || isPunct(tok.text)) continue;

      const tw = transcribeWord(tok);
      for (let si = 0; si < tw.syllables.length; si++) {
        const syl = tw.syllables[si]!;
        cells.push({
          type: 'syl',
          stressed: syl.stressed,
          wordLast: si === tw.syllables.length - 1,
          ipaTokens: syl.ipaTokens,
          tokenKeys: syl.ipaTokens.map((_, ti) => `${tok.id}:${si}:${ti}`),
        });
      }
    }
    rows.push({ lineIdx: li, kind: 'content', cells });
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
  x: number; y: number; w: number; h: number; rx: number;
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
    const key    = tokenKeys[i]!;
    const visual = styleMap.get(key) ?? ipaTokenStyle(symbol, 0.22);

    const rw = tokW[i]! * scale;
    const hFrac = visual ? parseFloat(visual.height) / 100 : 0.62;
    const rh = Math.max(8, CH * hFrac);
    const ry = cellY + (CH - rh) / 2;

    const rxStr = visual?.borderRadius.split(' ')[0] ?? '4px';
    const corner = Math.min(parseFloat(rxStr), rh / 2, rw / 2);

    const color = visual?.background ??
      (isVowelTok(symbol) ? 'hsla(28,64%,58%,0.25)' : 'rgba(0,0,0,0.1)');

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

  const bg = cell.stressed ? '#c8c8c8' : '#ffffff';
  const parts: string[] = [];

  // Cell body
  parts.push(
    `<rect x="${x}" y="${y}" width="${CW}" height="${CH}" ` +
    `fill="${bg}" stroke="#000" stroke-width="1"/>`,
  );

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
      `font-family="${FONT_IPA}" font-size="9" fill="rgba(0,0,0,0.82)" ` +
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
): string {
  if (row.kind === 'blank') return '';

  const midY = (y + rowH(row) / 2).toFixed(1);
  const parts: string[] = [];

  // Row number
  parts.push(
    `<text x="${NW - 4}" y="${midY}" ` +
    `font-family="${FONT_UI}" font-size="9" fill="rgba(0,0,0,0.28)" ` +
    `text-anchor="end" dominant-baseline="central">${row.lineIdx + 1}</text>`,
  );

  if (row.kind === 'pending') {
    parts.push(
      `<text x="${NW + 6}" y="${midY}" ` +
      `font-family="${FONT_UI}" font-size="11" fill="rgba(0,0,0,0.12)" ` +
      `dominant-baseline="central">· · ·</text>`,
    );
    return parts.join('');
  }

  // Content: syllable cells
  let cx = NW;
  for (const cell of row.cells) {
    parts.push(renderSvgCell(cell, cx, y, styleMap));
    cx += CW;
  }

  return parts.join('');
}

// ── Legend ────────────────────────────────────────────────────────────────────

interface RenderResult { svg: string; height: number }

function renderLegend(startX: number, startY: number, availW: number): RenderResult {
  const parts: string[] = [];
  let y = startY;

  // Separator
  parts.push(
    `<line x1="${startX}" y1="${y}" x2="${startX + availW}" y2="${y}" ` +
    `stroke="rgba(0,0,0,0.12)" stroke-width="1"/>`,
  );
  y += 16;

  // Title
  parts.push(
    `<text x="${startX}" y="${y}" font-family="${FONT_UI}" ` +
    `font-size="11" font-weight="700" fill="#333" letter-spacing="0.8">` +
    `УМОВНІ ПОЗНАЧЕННЯ</text>`,
  );
  y += 22;

  // ── Consonant colour groups ───────────────────────────────────────────────
  parts.push(
    `<text x="${startX}" y="${y}" font-family="${FONT_UI}" ` +
    `font-size="8.5" font-weight="600" fill="#555" letter-spacing="0.3">` +
    `ЗВУКОВІ ГРУПИ (приголосні)</text>`,
  );
  y += 16;

  const LEG_COLS = 3;
  const colW = Math.floor(availW / LEG_COLS);
  const SW = 14; // swatch size

  for (let i = 0; i < PSYCHO_GROUP_INFO.length; i++) {
    const g   = PSYCHO_GROUP_INFO[i]!;
    const col = i % LEG_COLS;
    const row = Math.floor(i / LEG_COLS);
    const ix  = startX + col * colW;
    const iy  = y + row * 32;

    parts.push(
      `<rect x="${ix}" y="${iy}" width="${SW}" height="${SW}" ` +
      `fill="${g.cssColor}" rx="3"/>`,
    );
    parts.push(
      `<text x="${ix + SW + 5}" y="${iy + 7}" ` +
      `font-family="${FONT_UI}" font-size="9" font-weight="600" fill="#222" ` +
      `dominant-baseline="central">${esc(g.labelUa)}</text>`,
    );
    parts.push(
      `<text x="${ix + SW + 5}" y="${iy + 7 + 12}" ` +
      `font-family="${FONT_IPA}" font-size="8" fill="#666" ` +
      `dominant-baseline="central">${esc(g.examplesIpa.join(' '))}</text>`,
    );
  }

  y += Math.ceil(PSYCHO_GROUP_INFO.length / LEG_COLS) * 32 + 12;

  // ── Vowel groups ──────────────────────────────────────────────────────────
  parts.push(
    `<text x="${startX}" y="${y}" font-family="${FONT_UI}" ` +
    `font-size="8.5" font-weight="600" fill="#555" letter-spacing="0.3">` +
    `ГОЛОСНІ</text>`,
  );
  y += 16;

  for (let i = 0; i < VOWEL_GROUP_INFO.length; i++) {
    const g  = VOWEL_GROUP_INFO[i]!;
    const ix = startX + i * colW;

    parts.push(
      `<rect x="${ix}" y="${y}" width="${SW}" height="${SW}" ` +
      `fill="${g.cssColor}" rx="7"/>`,
    );
    parts.push(
      `<text x="${ix + SW + 5}" y="${y + 7}" ` +
      `font-family="${FONT_UI}" font-size="9" font-weight="600" fill="#222" ` +
      `dominant-baseline="central">${esc(g.labelUa)}</text>`,
    );
    parts.push(
      `<text x="${ix + SW + 5}" y="${y + 7 + 12}" ` +
      `font-family="${FONT_IPA}" font-size="8" fill="#666" ` +
      `dominant-baseline="central">${esc(g.examplesIpa.join(' '))}</text>`,
    );
  }
  y += 32 + 12;

  // ── Ribbon shape / voicing key ────────────────────────────────────────────
  parts.push(
    `<text x="${startX}" y="${y}" font-family="${FONT_UI}" ` +
    `font-size="8.5" font-weight="600" fill="#555" letter-spacing="0.3">` +
    `ФОРМА СМУЖКИ</text>`,
  );
  y += 16;

  const shapeItems = [
    { rx: 1,  label: 'Зупинні (п,б,т,д,к)',   h: 0.76 },
    { rx: 4,  label: 'Африкати (ц,ч,дж)',      h: 0.70 },
    { rx: 8,  label: 'Фрикативні (с,ш,ф,х)',   h: 0.64 },
    { rx: 12, label: 'Сонорні / носові (л,р,м,н)', h: 0.80 },
  ];
  const SBW = 36; // shape block width
  const SBH = CH;

  for (let i = 0; i < shapeItems.length; i++) {
    const si = shapeItems[i]!;
    const ix = startX + i * (colW * LEG_COLS / shapeItems.length);
    const rh = SBH * si.h;
    const ry = y + (SBH - rh) / 2;

    parts.push(
      `<rect x="${ix}" y="${y}" width="${SBW}" height="${SBH}" ` +
      `fill="none" stroke="rgba(0,0,0,0.12)" stroke-width="1"/>`,
    );
    parts.push(
      `<rect x="${ix + 2}" y="${ry.toFixed(1)}" ` +
      `width="${SBW - 4}" height="${rh.toFixed(1)}" ` +
      `rx="${si.rx}" fill="rgba(0,0,0,0.18)"/>`,
    );
    parts.push(
      `<text x="${ix}" y="${y + SBH + 13}" ` +
      `font-family="${FONT_UI}" font-size="8" fill="#555">${esc(si.label)}</text>`,
    );
  }
  y += SBH + 26;

  // ── Cell type key ─────────────────────────────────────────────────────────
  parts.push(
    `<text x="${startX}" y="${y}" font-family="${FONT_UI}" ` +
    `font-size="8.5" font-weight="600" fill="#555" letter-spacing="0.3">` +
    `ТИПИ КОМІРОК</text>`,
  );
  y += 16;

  const CEW = 34;  // cell example width
  const CEH = 26;  // cell example height
  const STEP = 150;

  const cellItems = [
    { bg: '#fff',             dash: '',     thick: false, label: 'Без наголосу' },
    { bg: '#c8c8c8',          dash: '',     thick: false, label: 'Наголошений склад' },
    { bg: '#fff',             dash: '',     thick: true,  label: 'Останній склад слова' },
    { bg: 'rgba(0,0,0,0.02)', dash: '4 2', thick: false, label: 'Відступ (tab)' },
  ];

  for (let i = 0; i < cellItems.length; i++) {
    const ci = cellItems[i]!;
    const ix = startX + i * STEP;

    parts.push(
      `<rect x="${ix}" y="${y}" width="${CEW}" height="${CEH}" ` +
      `fill="${ci.bg}" stroke="rgba(0,0,0,0.6)" stroke-width="1" ` +
      `${ci.dash ? `stroke-dasharray="${ci.dash}"` : ''}/>`,
    );
    if (ci.thick) {
      parts.push(
        `<line x1="${ix + CEW}" y1="${y}" x2="${ix + CEW}" y2="${y + CEH}" ` +
        `stroke="#000" stroke-width="3"/>`,
      );
    }
    parts.push(
      `<text x="${ix}" y="${y + CEH + 12}" ` +
      `font-family="${FONT_UI}" font-size="8" fill="#555">${esc(ci.label)}</text>`,
    );
  }
  y += CEH + 24;

  // ── Pattern opacity note ──────────────────────────────────────────────────
  parts.push(
    `<text x="${startX}" y="${y}" font-family="${FONT_UI}" ` +
    `font-size="8.5" font-weight="600" fill="#555" letter-spacing="0.3">` +
    `ВИДІЛЕННЯ ЗВУКОВИХ ПАТЕРНІВ</text>`,
  );
  y += 14;
  parts.push(
    `<text x="${startX}" y="${y}" font-family="${FONT_UI}" ` +
    `font-size="8" fill="#666">` +
    `Насиченість кольору — щільність повторень звуку (яскравіше = частіше поруч).</text>`,
  );
  y += 14;
  parts.push(
    `<text x="${startX}" y="${y}" font-family="${FONT_UI}" ` +
    `font-size="8" fill="#666">` +
    `Враховуються лише звуки, що зустрічаються ≥3 разів у тексті.</text>`,
  );
  y += 18;

  return { svg: parts.join('\n'), height: y - startY };
}

// ── Main export function ──────────────────────────────────────────────────────

/**
 * Generates a full SVG string of the phonetic visualization.
 *
 * @param lines           Document lines (from poetry store)
 * @param isLineConfirmed Per-line confirmation predicate
 * @param tokenStyleMap   Pre-computed token → TokenVisual map (from PhoneticPanel)
 * @param title           Optional poem title shown in header
 * @param includeLegend   Append the умовні позначення section (default: false)
 */
export function generateVisualizationSvg(
  lines: ILine[],
  isLineConfirmed: (id: string) => boolean,
  tokenStyleMap: Map<string, TokenVisual>,
  title = '',
  includeLegend = false,
): string {
  const rows    = buildRows(lines, isLineConfirmed);
  const gh      = gridHeight(rows);
  const mc      = maxCells(rows);
  const contentW = NW + mc * CW;
  // Width is exactly the widest row + padding; expand only when legend needs it
  const svgW    = includeLegend
    ? Math.max(contentW + PAD * 2, LEGEND_MIN_SVG_W)
    : contentW + PAD * 2;
  const availW  = svgW - PAD * 2;

  const gridStartY = PAD + HEADER_H;
  const legendStartY = gridStartY + gh + (includeLegend ? LEGEND_GAP : 0);

  const { svg: legendSvg, height: legendH } = includeLegend
    ? renderLegend(PAD, legendStartY, availW)
    : { svg: '', height: 0 };

  const footerY = legendStartY + (legendH > 0 ? legendH + 10 : 8);
  const svgH    = footerY + 28 + PAD;

  const out: string[] = [];

  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">`,
  );

  // Background
  out.push(`<rect width="${svgW}" height="${svgH}" fill="#f4f4f6"/>`);

  // Grid area white card
  out.push(
    `<rect x="${PAD - 6}" y="${gridStartY - 6}" ` +
    `width="${contentW + 12}" height="${gh + 12}" fill="#fff" rx="4"/>`,
  );

  // ── Header ─────────────────────────────────────────────────────────────────
  const titleText = title
    ? `VerseSense · ${esc(title)}`
    : 'VerseSense · Phonetic Visualization';

  out.push(
    `<text x="${PAD}" y="${PAD + 18}" ` +
    `font-family="${FONT_UI}" font-size="15" font-weight="700" fill="#1a1a2e">` +
    `${titleText}</text>`,
  );
  out.push(
    `<text x="${PAD}" y="${PAD + 34}" ` +
    `font-family="${FONT_UI}" font-size="8.5" fill="rgba(180,30,30,0.7)">` +
    `⚠ Demo Version — може містити неточності та похибки</text>`,
  );
  out.push(
    `<line x1="${PAD}" y1="${PAD + 46}" x2="${PAD + contentW}" y2="${PAD + 46}" ` +
    `stroke="rgba(0,0,0,0.1)" stroke-width="1"/>`,
  );

  // ── Grid rows ───────────────────────────────────────────────────────────────
  out.push('<g id="phonetic-grid">');
  let y = gridStartY;
  for (const row of rows) {
    out.push(renderSvgRow(row, y, tokenStyleMap));
    y += rowH(row) + RG;
  }
  out.push('</g>');

  // ── Legend (optional) ─────────────────────────────────────────────────────
  if (includeLegend) {
    out.push('<g id="legend">');
    out.push(legendSvg);
    out.push('</g>');
  }

  // ── Footer ──────────────────────────────────────────────────────────────────
  const year = new Date().getFullYear();
  out.push(
    `<text x="${svgW - PAD}" y="${footerY + 14}" ` +
    `font-family="${FONT_UI}" font-size="8" fill="rgba(0,0,0,0.25)" text-anchor="end">` +
    `VerseSense Demo · versesense.app · ${year}</text>`,
  );

  out.push('</svg>');
  return out.join('\n');
}

// ── Browser download helper ───────────────────────────────────────────────────

export function downloadSvg(svgString: string, filename = 'phonetic.svg'): void {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
