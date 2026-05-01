/**
 * DocumentParser.ts
 *
 * Converts raw poem text into a structured IPoetryDocument.
 *
 * Parsing rules:
 *  - Split on \n → lines
 *  - Leading \t on each line → TAB tokens (preserved as indent cells)
 *  - Trailing spaces stripped from each line
 *  - Leading spaces (not tabs) stripped from each line
 *  - Words separated by spaces → WORD tokens with GAP tokens between them
 *  - Empty lines → ILine with zero tokens
 */

import { makeId } from './Token';
import type {
  IWordToken,
  IGapToken,
  ITabToken,
  IHyphenToken,
  IPunctToken,
  IToken,
  ILine,
  IPoetryDocument,
} from './Token';
import type { Language } from './Language';
import { DEFAULT_LANGUAGE } from './Language';

export function parseDocument(
  rawText: string,
  defaultLanguage: Language = DEFAULT_LANGUAGE,
): IPoetryDocument {
  const WORD_CHAR_RE = /[\p{L}\p{N}]/u;
  const APOSTROPHE_CHAR_RE = /['\u02BC\u2019]/u;

  function isWordChar(ch: string): boolean {
    return WORD_CHAR_RE.test(ch);
  }

  function isApostrophe(ch: string): boolean {
    return APOSTROPHE_CHAR_RE.test(ch);
  }

  function chunkHasWordChars(chunk: string): boolean {
    for (let i = 0; i < chunk.length; i++) {
      if (isWordChar(chunk[i]!)) return true;
    }
    return false;
  }

  function chunkStartsWithWord(chunk: string, index: number): boolean {
    return index < chunk.length && isWordChar(chunk[index]!);
  }

  function tokenizeChunk(chunk: string): IToken[] {
    const out: IToken[] = [];
    let i = 0;

    while (i < chunk.length) {
      const ch = chunk[i]!;

      if (isWordChar(ch)) {
        let j = i + 1;
        while (j < chunk.length) {
          const cur = chunk[j]!;
          if (isWordChar(cur)) {
            j++;
            continue;
          }
          if (isApostrophe(cur) && chunkStartsWithWord(chunk, j + 1)) {
            j += 2;
            while (j < chunk.length && isWordChar(chunk[j]!)) j++;
            continue;
          }
          break;
        }

        out.push(
          addToken<IWordToken>({
            id: makeId(),
            kind: 'WORD',
            text: chunk.slice(i, j),
            language: defaultLanguage,
            stressIndex: null,
          }),
        );
        i = j;
        continue;
      }

      if (
        ch === '-' &&
        out.length > 0 &&
        out[out.length - 1]!.kind === 'WORD' &&
        chunkStartsWithWord(chunk, i + 1)
      ) {
        out.push(addToken<IHyphenToken>({ id: makeId(), kind: 'HYPHEN' }));
        i++;
        continue;
      }

      let j = i + 1;
      while (j < chunk.length) {
        const cur = chunk[j]!;
        if (isWordChar(cur)) break;
        if (
          cur === '-' &&
          out.length > 0 &&
          out[out.length - 1]!.kind === 'WORD' &&
          chunkStartsWithWord(chunk, j + 1)
        ) {
          break;
        }
        j++;
      }
      out.push(addToken<IPunctToken>({ id: makeId(), kind: 'PUNCT', text: chunk.slice(i, j) }));
      i = j;
    }

    return out;
  }

  const tokenIndex = new Map<string, IToken>();

  function addToken<T extends IToken>(tok: T): T {
    tokenIndex.set(tok.id, tok);
    return tok;
  }

  const rawLines = rawText.split('\n');

  const lines: ILine[] = rawLines.map((rawLine): ILine => {
    const lineId = makeId();
    const tokens: IToken[] = [];

    // 1. Strip TRAILING spaces/tabs
    const rightTrimmed = rawLine.replace(/[ \t]+$/, '');

    // 2. Count and strip LEADING tabs (preserved as TAB tokens)
    const leadingTabMatch = rightTrimmed.match(/^(\t+)/);
    const tabCount = leadingTabMatch ? leadingTabMatch[1]!.length : 0;
    const afterTabs = rightTrimmed.slice(tabCount);

    // Emit TAB tokens
    for (let i = 0; i < tabCount; i++) {
      tokens.push(addToken<ITabToken>({ id: makeId(), kind: 'TAB' }));
    }

    // 3. Strip leading spaces (not tabs — already stripped above)
    const trimmedLine = afterTabs.trimStart();

    if (trimmedLine.length === 0) {
      return { id: lineId, tokens };
    }

    // 4. Split on whitespace runs → chunks.
    // Each chunk is tokenized into WORD/HYPHEN/PUNCT preserving punctuation.
    const chunks = trimmedLine.split(/\s+/).filter((w) => w.length > 0);

    let emittedAny = false;
    chunks.forEach((chunk) => {
      if (!chunkHasWordChars(chunk) && chunk.trim().length === 0) return;

      if (emittedAny) {
        tokens.push(addToken<IGapToken>({ id: makeId(), kind: 'GAP' }));
      }

      const chunkTokens = tokenizeChunk(chunk);
      for (const t of chunkTokens) tokens.push(t);
      emittedAny = chunkTokens.length > 0;
    });

    return { id: lineId, tokens };
  });

  return { lines, tokenIndex };
}

/**
 * Serialize a document back to plain text.
 * Tabs are restored; gaps become single spaces.
 */
export function serializeDocument(doc: IPoetryDocument): string {
  return doc.lines
    .map((line) =>
      line.tokens
        .map((tok) => {
          if (tok.kind === 'TAB') return '\t';
          if (tok.kind === 'GAP') return ' ';
          if (tok.kind === 'HYPHEN') return '-';
          if (tok.kind === 'PUNCT') return tok.text;
          return tok.text;
        })
        .join(''),
    )
    .join('\n');
}
