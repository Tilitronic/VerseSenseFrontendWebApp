import type { IPoetryDocument } from 'src/model/Token';
import type { StreamAnalysisResult } from 'src/services/phonetic/analysisTypes';

export interface PhoneticVisualizerInput {
  document: IPoetryDocument;
  allWordTokenCount: number;
  activeLineIndex: number | null;
  rawText: string;
  analysisResult: StreamAnalysisResult | null;
  isLineConfirmed: (lineId: string) => boolean;
}

export interface EditorVisualizerChannel {
  setRawText: (text: string) => void;
}
