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
import type { IWordToken, IGapToken, ITabToken, IHyphenToken, IToken, ILine, IPoetryDocument } from './Token';
import type { Language } from './Language';
import { DEFAULT_LANGUAGE } from './Language';

export function parseDocument(
  rawText: string,
  defaultLanguage: Language = DEFAULT_LANGUAGE,
): IPoetryDocument {
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

    // 4. Split on whitespace runs → chunks, then split each chunk on hyphens
    // e.g. "Pegging-потяг" → WORD("Pegging") HYPHEN WORD("потяг")
    // Chunks with no letter characters (e.g. "—", ";") are skipped entirely.
    const HAS_LETTER = /\p{L}/u;
    const chunks = trimmedLine.split(/\s+/).filter((w) => w.length > 0);

    let wordEmitted = false; // tracks whether any WORD has been emitted (for GAP placement)
    chunks.forEach((chunk) => {
      // Skip purely punctuation / symbol chunks (no letter content)
      if (!HAS_LETTER.test(chunk)) return;

      // GAP between word-bearing chunks
      if (wordEmitted) {
        tokens.push(addToken<IGapToken>({ id: makeId(), kind: 'GAP' }));
      }

      // Split the chunk on hyphens, keeping non-empty parts with letter content
      // A leading/trailing hyphen (e.g. "-word" or "word-") is kept as-is
      // to avoid creating empty WORD tokens.
      const parts = chunk.split('-').filter((p) => p.length > 0 && HAS_LETTER.test(p));

      if (parts.length === 0) return; // chunk was all hyphens / punctuation

      if (parts.length <= 1) {
        // No hyphen — emit single WORD
        tokens.push(addToken<IWordToken>({
          id: makeId(), kind: 'WORD',
          text: chunk, language: defaultLanguage, stressIndex: null,
        }));
        wordEmitted = true;
      } else {
        // Multiple parts — emit WORD HYPHEN WORD HYPHEN …
        parts.forEach((part, partIdx) => {
          if (partIdx > 0) {
            tokens.push(addToken<IHyphenToken>({ id: makeId(), kind: 'HYPHEN' }));
          }
          tokens.push(addToken<IWordToken>({
            id: makeId(), kind: 'WORD',
            text: part, language: defaultLanguage, stressIndex: null,
          }));
        });
        wordEmitted = true;
      }
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
          return tok.text;
        })
        .join(''),
    )
    .join('\n');
}
