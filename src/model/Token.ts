/**
 * Token.ts — Document model types
 *
 * A poem is represented as a list of Lines, each containing an ordered
 * sequence of Tokens. Tokens are either Words or typographic separators.
 */
import type { Language } from './Language';

export type TokenKind = 'WORD' | 'GAP' | 'TAB' | 'HYPHEN';

let _idCounter = 0;
export function makeId(): string {
  return `tok_${++_idCounter}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── Word token ────────────────────────────────────────────────────────────────

export interface IWordToken {
  id: string;
  kind: 'WORD';
  text: string;
  /** Language assigned to this word. Starts as document default, user-overridable. */
  language: Language;
  /**
   * Index of the stressed SYLLABLE (0-based), or null = unknown / not set yet.
   * Set by user via the stress picker popup.
   */
  stressIndex: number | null;
}

// ── Typographic tokens ────────────────────────────────────────────────────────

export interface IGapToken {
  id: string;
  kind: 'GAP';
}

export interface ITabToken {
  id: string;
  kind: 'TAB';
}

/** Hyphen connector between two parts of a compound word, e.g. "Pegging-потяг" */
export interface IHyphenToken {
  id: string;
  kind: 'HYPHEN';
}

export type IToken = IWordToken | IGapToken | ITabToken | IHyphenToken;

// ── Line ──────────────────────────────────────────────────────────────────────

export interface ILine {
  id: string;
  /** Ordered tokens on this line. Never contains NEWLINE. */
  tokens: IToken[];
}

// ── Document ──────────────────────────────────────────────────────────────────

export interface IPoetryDocument {
  lines: ILine[];
  /** O(1) lookup: token id → token */
  tokenIndex: Map<string, IToken>;
}
