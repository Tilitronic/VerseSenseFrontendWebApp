import type { ILine, IWordToken } from 'src/model/Token';
import { countVowels } from 'src/services/poetryEngines/shared/wordVowels';
import { tokenizeIPA } from './ipaTokenizer';
import { transcribeWord } from './wordTranscription';

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

      // Merge zero-vowel clitics only for Cyrillic-like words (UA behavior).
      // For Latin words (e.g. "co", "to" accidentally tagged as UA), keep a
      // standalone cell so words do not collapse into one visual syllable.
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
