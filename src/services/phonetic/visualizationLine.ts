import type { ILine, IWordToken } from 'src/model/Token';
import { countVowels } from 'src/services/poetryEngines/shared/wordVowels';
import { tokenizeIPA } from './ipaTokenizer';
import { transcribeWord } from './wordTranscription';

// ── Memoization ───────────────────────────────────────────────────────────────
// Cache transcription results per line fingerprint.
// The fingerprint is stable across document rebuilds for lines whose word
// texts, languages, and stress indices have not changed — because
// rebuildDocument reuses the previous token IDs for unchanged words.

const _vizCache = new Map<string, VisualizationLineItem[]>();
const _VIZ_CACHE_MAX = 400;

function _lineFingerprint(line: ILine): string {
  // Only word tokens affect transcription; other tokens affect layout (TAB → tab cell).
  let fp = '';
  for (const tok of line.tokens) {
    if (tok.kind === 'WORD') {
      fp += `W${tok.id}|${tok.language}|${tok.stressIndex ?? -1};`;
    } else {
      fp += `${tok.kind};`;
    }
  }
  return fp;
}

export interface VisualizationLineItem {
  type: 'tab' | 'cell';
  stressed?: boolean;
  wordLast?: boolean;
  countsAsSyllable?: boolean;
  ipaTokens?: string[];
  renderKeys?: string[];
  motifWordId?: string;
  motifSyllableIndex?: number;
}

interface VisualizationToken {
  symbol: string;
  renderKey: string;
}

const LATIN = /[a-zA-Z\u00C0-\u024F]/;

function isLatinWord(text: string): boolean {
  return LATIN.test(text);
}

function zeroVowelTokens(tok: IWordToken): VisualizationToken[] {
  const transcribed = transcribeWord(tok);
  const ipaTokens = transcribed.syllables.flatMap((syl) => syl.ipaTokens);
  if (ipaTokens.length > 0) {
    return ipaTokens.map((symbol, index) => ({
      symbol,
      renderKey: `${tok.id}:orphan:${index}`,
    }));
  }

  const fallbackTokens = tokenizeIPA(tok.text);
  if (fallbackTokens.length > 0) {
    return fallbackTokens.map((symbol, index) => ({
      symbol,
      renderKey: `${tok.id}:orphan:${index}`,
    }));
  }

  return [{ symbol: tok.text, renderKey: `${tok.id}:orphan:0` }];
}

export function buildVisualizationLineItems(line: ILine): VisualizationLineItem[] {
  const key = _lineFingerprint(line);
  const hit = _vizCache.get(key);
  if (hit) return hit;
  if (_vizCache.size >= _VIZ_CACHE_MAX) _vizCache.clear();
  const result = _computeVisualizationLineItems(line);
  _vizCache.set(key, result);
  return result;
}

function _computeVisualizationLineItems(line: ILine): VisualizationLineItem[] {
  const items: VisualizationLineItem[] = [];
  let pendingPrefix: VisualizationToken[] = [];

  for (const tok of line.tokens) {
    if (tok.kind === 'TAB') {
      items.push({ type: 'tab' });
      continue;
    }
    if (tok.kind !== 'WORD') continue;

    if (countVowels(tok.text, tok.language) === 0) {
      const orphanTokens = zeroVowelTokens(tok);

      // Cross-language clitic rule:
      // if the word is a single grapheme and resolves to a single phoneme,
      // merge it with the NEXT syllable instead of creating its own cell.
      // Example: pl "z chmur" should not add an extra standalone syllable cell for "z".
      const graphemeCount = [...tok.text].length;
      const shouldMergeWithNext = graphemeCount === 1 && orphanTokens.length === 1;
      if (shouldMergeWithNext) {
        pendingPrefix.push(...orphanTokens);
        continue;
      }

      // For the remaining zero-vowel words (non 1-letter/1-phoneme),
      // keep legacy behavior: Cyrillic-like clitics merge, Latin stays standalone.
      // This avoids collapsing full Latin chunks into one visual syllable.
      if (isLatinWord(tok.text)) {
        items.push({
          type: 'cell',
          stressed: false,
          wordLast: true,
          countsAsSyllable: true,
          ipaTokens: orphanTokens.map((token) => token.symbol),
          renderKeys: orphanTokens.map((token) => token.renderKey),
          motifWordId: tok.id,
          motifSyllableIndex: 0,
        });
      } else {
        pendingPrefix.push(...orphanTokens);
      }
      continue;
    }

    const tw = transcribeWord(tok);
    if (tw.syllables.length === 0) continue;

    tw.syllables.forEach((syl, syllableIndex) => {
      const tokens: VisualizationToken[] = syl.ipaTokens.map((symbol, tokenIndex) => ({
        symbol,
        renderKey: `${tok.id}:${syllableIndex}:${tokenIndex}`,
      }));

      if (syllableIndex === 0 && pendingPrefix.length > 0) {
        tokens.unshift(...pendingPrefix);
        pendingPrefix = [];
      }

      items.push({
        type: 'cell',
        stressed: syl.stressed,
        wordLast: syllableIndex === tw.syllables.length - 1,
        countsAsSyllable: true,
        ipaTokens: tokens.map((token) => token.symbol),
        renderKeys: tokens.map((token) => token.renderKey),
        motifWordId: tok.id,
        motifSyllableIndex: syllableIndex,
      });
    });
  }

  if (pendingPrefix.length > 0) {
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      if (item?.type !== 'cell' || !item.ipaTokens || !item.renderKeys) continue;
      item.ipaTokens.push(...pendingPrefix.map((token) => token.symbol));
      item.renderKeys.push(...pendingPrefix.map((token) => token.renderKey));
      pendingPrefix = [];
      break;
    }
  }

  if (pendingPrefix.length > 0) {
    items.push({
      type: 'cell',
      stressed: false,
      wordLast: true,
      countsAsSyllable: false,
      ipaTokens: pendingPrefix.map((token) => token.symbol),
      renderKeys: pendingPrefix.map((token) => token.renderKey),
      motifWordId: '',
      motifSyllableIndex: -1,
    });
  }

  return items;
}
