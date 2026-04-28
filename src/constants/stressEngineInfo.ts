/**
 * Build-time constants derived from the ua-stress-ml package manifest.
 * We import as raw text to avoid the @intlify/unplugin-vue-i18n plugin
 * intercepting the JSON transform for node_modules files.
 */
import manifestRaw from 'ua-stress-ml/data/manifest.json?raw';

const _manifest = JSON.parse(manifestRaw) as { version: string };

/** Full model identifier as defined in the manifest, e.g. "luscinia-lgbm-str-ua-univ-v1.0" */
export const ML_MODEL_ID: string = _manifest.version;
