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
  // Fire-and-forget: both WASM and CMU dict load concurrently in the
  // background.  The poetry store reacts to their readiness via watches on
  // stressResolver and the cmuDictReady promise — no splash blocking needed.
  void initUaStress(new LusciniaPredictor());
});
