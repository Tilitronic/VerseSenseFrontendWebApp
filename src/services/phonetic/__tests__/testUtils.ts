// Простий мок для тестів: повертає IPoetryDocument з двома рядками
import type { IPoetryDocument } from 'src/model/Token';

export function getTestPoemDocument(text: string): IPoetryDocument {
  const lines = text.trim().split('\n').map((line, idx) => ({
    id: `l${idx}`,
    tokens: line.split(/\s+/).map((word, widx) => ({
      kind: 'WORD',
      id: `w${idx}_${widx}`,
      text: word,
    })),
  }));
  return { lines } as IPoetryDocument;
}
