import { buildIpaStream, type IpaStream } from 'src/services/phonetic/ipaStreamExport';
import { phoneticEngineBackend } from 'src/services/phonetic/phoneticEngineBackend';
import type { IPoetryDocument } from 'src/model/Token';
import type { StreamAnalysisResult } from './analysisTypes';

/**
 * Bridge between IPA Stream export and phonetic analysis engine.
 * Converts poem → IPA Stream → Engine Analysis → StreamAnalysisResult
 */

export interface AnalysisOptions {
  pendingStressIds?: ReadonlyMap<string, string>;
  confirmedWords?: ReadonlySet<string>;
}

/**
 * Analyze a poetry document using the phonetic analysis engine.
 *
 * @param doc - Poetry document with confirmed lines
 * @param isLineConfirmed - Function to check if a line index is confirmed
 * @param options - Optional context for stress assignment
 * @returns Structured analysis with rhymes, rhythm, pauses, echo annotations
 * @throws If worker backend initialization or analysis fails
 */
export async function analyzePoem(
  doc: IPoetryDocument,
  isLineConfirmed: (lineId: string) => boolean,
  options?: AnalysisOptions
): Promise<StreamAnalysisResult | null> {

  // Step 1: Build IPA Stream from poem
  const stream = buildIpaStream(doc, isLineConfirmed, options);

  // Step 2: Skip empty streams
  if (stream.metadata.totalWordCount === 0) return null;

  // Step 2: Pass to worker-backed analysis engine
  return phoneticEngineBackend.analyze(JSON.stringify(stream));
}

/**
 * Get just the IPA Stream (for debugging or export).
 */
export function getIpaStream(
  doc: IPoetryDocument,
  isLineConfirmed: (lineId: string) => boolean,
  options?: AnalysisOptions
): IpaStream {
  return buildIpaStream(doc, isLineConfirmed, options);
}
