/**
 * Boot file: uaWasm
 *
 * Starts WASM initialisation for ua-word-stress-wasm and the Luscinia ONNX
 * ML predictor as early as possible.
 *
 * The WASM binary embeds the full dictionary (~3 M word forms) and resolves
 * stress, IPA transcription, and syllabification without any external files.
 * Luscinia handles OOV words not found in the dictionary.
 *
 * Both are accessed reactively via useUaStress().
 */

import { boot } from 'quasar/wrappers';
import { initUaStress } from 'src/composables/useUaStress';
import { LusciniaPredictor } from 'src/services/stress/lusciniaPredictor';

export default boot(() => {
  // Fire-and-forget: loading errors are captured in the composable's `error` ref.
  void initUaStress(new LusciniaPredictor());
});
