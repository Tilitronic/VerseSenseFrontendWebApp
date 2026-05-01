import { describe, it, expect } from 'vitest';
import { parseDocument, serializeDocument } from 'src/model/DocumentParser';

describe('DocumentParser punctuation-aware tokenization', () => {
  it('splits trailing punctuation from words', () => {
    const doc = parseDocument('cześć, tu.');
    const toks = doc.lines[0]?.tokens ?? [];

    expect(toks.map((t) => t.kind)).toEqual(['WORD', 'PUNCT', 'GAP', 'WORD', 'PUNCT']);

    expect(toks[0] && toks[0].kind === 'WORD' ? toks[0].text : '').toBe('cześć');
    expect(toks[1] && toks[1].kind === 'PUNCT' ? toks[1].text : '').toBe(',');
    expect(toks[3] && toks[3].kind === 'WORD' ? toks[3].text : '').toBe('tu');
    expect(toks[4] && toks[4].kind === 'PUNCT' ? toks[4].text : '').toBe('.');
  });

  it('keeps hyphen connectors between words as HYPHEN token', () => {
    const doc = parseDocument('Pegging-потяг');
    const toks = doc.lines[0]?.tokens ?? [];

    expect(toks.map((t) => t.kind)).toEqual(['WORD', 'HYPHEN', 'WORD']);
    expect(toks[0] && toks[0].kind === 'WORD' ? toks[0].text : '').toBe('Pegging');
    expect(toks[2] && toks[2].kind === 'WORD' ? toks[2].text : '').toBe('потяг');
  });

  it('emits punctuation-only chunks as PUNCT tokens', () => {
    const doc = parseDocument('hej ; tam');
    const toks = doc.lines[0]?.tokens ?? [];

    expect(toks.map((t) => t.kind)).toEqual(['WORD', 'GAP', 'PUNCT', 'GAP', 'WORD']);
    expect(toks[2] && toks[2].kind === 'PUNCT' ? toks[2].text : '').toBe(';');
  });

  it('preserves apostrophes inside words', () => {
    const doc = parseDocument("rock'n'roll");
    const toks = doc.lines[0]?.tokens ?? [];

    expect(toks.map((t) => t.kind)).toEqual(['WORD']);
    expect(toks[0] && toks[0].kind === 'WORD' ? toks[0].text : '').toBe("rock'n'roll");
  });

  it('serializes back with punctuation tokens', () => {
    const source = '„mówi”, matematyka.';
    const doc = parseDocument(source);
    expect(serializeDocument(doc)).toBe(source);
  });
});
