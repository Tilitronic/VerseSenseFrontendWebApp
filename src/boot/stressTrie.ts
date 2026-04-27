/**
 * Boot file: stressTrie
 *
 * Starts fetching the Ukrainian stress trie AND initialises the Luscinia
 * ONNX ML predictor as early as possible.  The trie resolves the vast
 * majority of words synchronously; Luscinia handles OOV and heteronym cases.
 *
 * Both are accessed reactively via useStressTrie().
 */

import { boot } from 'quasar/wrappers';
import { initStressTrie } from 'src/composables/useStressTrie';
import { LusciniaPredictor } from 'src/services/stress/lusciniaPredictor';

export default boot(() => {
  // Fire-and-forget: loading errors are captured in the composable's `error` ref.
  void initStressTrie(new LusciniaPredictor());
});
