// Configuration for your app
// https://v2.quasar.dev/quasar-cli-vite/quasar-config-file

import { defineConfig } from '#q-app/wrappers';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

// Absolute path to the pre-compressed ONNX model — sourced from the linked ua-stress-ml package.
const LUSCINIA_MODEL_PATH = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  'node_modules/ua-stress-ml/data/P3_0017_full.onnx.gz',
);
const LUSCINIA_ROUTE = '/models/luscinia.onnx.gz';

/**
 * Vite plugin: serve the Luscinia ONNX model during dev and emit it as a build asset.
 * The model is gzip-compressed; the browser decompresses it via DecompressionStream
 * in LusciniaPredictor before passing the raw ONNX bytes to onnxruntime-web.
 *
 * The stress trie (ua-word-stress) is handled via a `?url` import in useStressTrie.ts;
 * Vite copies the file to the dist/assets folder automatically during build.
 */
function lusciniaModelPlugin(): Plugin {
  return {
    name: 'luscinia-model',
    configureServer(server) {
      // SharedArrayBuffer (required by onnxruntime-web threaded WASM) is only
      // available when the page is cross-origin isolated. Set COOP+COEP on every
      // dev-server response via a middleware that runs before Vite's own handlers.
      // (devServer.headers in quasar.config is a less reliable path for this.)
      server.middlewares.use((_req, res, next) => {
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
        next();
      });

      // Serve the ONNX model from node_modules.
      server.middlewares.use(LUSCINIA_ROUTE, (_req, res) => {
        try {
          res.setHeader('Content-Type', 'application/octet-stream');
          res.end(readFileSync(LUSCINIA_MODEL_PATH));
        } catch (err) {
          res.statusCode = 404;
          res.end(`[luscinia-model] model not found: ${LUSCINIA_MODEL_PATH}`);
          console.warn('[luscinia-model] model file not found — build it first:', err);
        }
      });
    },
    // Build: emit the ONNX model as a static asset under models/.
    generateBundle() {
      try {
        this.emitFile({
          type: 'asset',
          fileName: 'models/luscinia.onnx.gz',
          source: readFileSync(LUSCINIA_MODEL_PATH),
        });
      } catch (err) {
        this.warn(
          `[luscinia-model] model file not found — ML prediction disabled in build: ${String(err)}`,
        );
      }
    },
  };
}

export default defineConfig((ctx) => {
  return {
    // https://v2.quasar.dev/quasar-cli-vite/prefetch-feature
    // preFetch: true,

    // app boot file (/src/boot)
    // --> boot files are part of "main.js"
    // https://v2.quasar.dev/quasar-cli-vite/boot-files
    boot: ['i18n', 'axios', 'localStoreBoot', 'codemirror', 'stressTrie'],

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-file#css
    css: ['app.scss'],

    // https://github.com/quasarframework/quasar/tree/dev/extras
    extras: [
      // 'ionicons-v4',
      // 'mdi-v7',
      // 'fontawesome-v6',
      // 'eva-icons',
      // 'themify',
      // 'line-awesome',
      // 'roboto-font-latin-ext', // this or either 'roboto-font', NEVER both!

      'roboto-font', // optional, you are not bound to it
      'material-icons', // optional, you are not bound to it
    ],

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/quasar-config-file#build
    build: {
      target: {
        browser: ['es2022', 'firefox115', 'chrome115', 'safari14'],
        node: 'node20',
      },

      typescript: {
        strict: true,
        vueShim: true,
        // extendTsConfig (tsConfig) {}
      },

      vueRouterMode: 'hash', // available values: 'hash', 'history'
      // vueRouterBase,
      // vueDevtools,
      // vueOptionsAPI: false,

      // rebuildCache: true, // rebuilds Vite/linter/etc cache on startup

      // publicPath: '/',
      // analyze: true,
      // env: {},
      // rawDefine: {}
      // ignorePublicFolder: true,
      // minify: false,
      // polyfillModulePreload: true,
      // distDir

      extendViteConf(viteConf) {
        // Allow Vite to import .ctrie.gz/.onnx.gz as static asset URLs.
        const existing = viteConf.assetsInclude
          ? Array.isArray(viteConf.assetsInclude)
            ? viteConf.assetsInclude
            : [viteConf.assetsInclude]
          : [];
        viteConf.assetsInclude = [...existing, '**/*.ctrie.gz', '**/*.onnx.gz', '**/*.onnx'];

        // Exclude heavy packages with binary data files or WASM backends from Vite's
        // dep pre-bundler. Pre-bundling breaks their internal dynamic imports:
        // - ua-stress-ml / ua-word-stress: ?url asset imports for data files
        // - onnxruntime-web: dynamic imports of Emscripten .mjs glue files —
        //   when pre-bundled, Vite transforms the absolute glue URLs with ?import
        //   and corrupts the Emscripten output (NS_ERROR_CORRUPTED_CONTENT).
        viteConf.optimizeDeps ??= {};
        viteConf.optimizeDeps.exclude ??= [];
        viteConf.optimizeDeps.exclude.push('ua-stress-ml', 'ua-word-stress', 'onnxruntime-web');
      },
      // viteVuePluginOptions: {},

      vitePlugins: [
        lusciniaModelPlugin(),
        [
          '@intlify/unplugin-vue-i18n/vite',
          {
            // if you want to use Vue I18n Legacy API, you need to set `compositionOnly: false`
            // compositionOnly: false,

            // if you want to use named tokens in your Vue I18n messages, such as 'Hello {name}',
            // you need to set `runtimeOnly: false`
            // runtimeOnly: false,

            ssr: ctx.modeName === 'ssr',

            // you need to set i18n resource including paths !
            include: [fileURLToPath(new URL('./src/i18n', import.meta.url))],
          },
        ],

        [
          'vite-plugin-checker',
          {
            vueTsc: true,
            eslint: {
              lintCommand: 'eslint -c ./eslint.config.js "./src*/**/*.{ts,js,mjs,cjs,vue}"',
              useFlatConfig: true,
            },
          },
          { server: false },
        ],
      ],
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/quasar-config-file#devserver
    devServer: {
      // https: true,
      open: {
        app: {
          name: 'C:\\Program Files\\Firefox Developer Edition\\firefox.exe',
        },
      },
      // Mirror the Netlify _headers COOP/COEP rules so SharedArrayBuffer is
      // available in dev (required by onnxruntime-web threaded WASM backend).
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-file#framework
    framework: {
      config: {},

      // iconSet: 'material-icons', // Quasar icon set
      // lang: 'en-US', // Quasar language pack

      // For special cases outside of where the auto-import strategy can have an impact
      // (like functional components as one of the examples),
      // you can manually specify Quasar components/directives to be available everywhere:
      //
      // components: [],
      // directives: [],

      // Quasar plugins
      plugins: [],
    },

    // animations: 'all', // --- includes all animations
    // https://v2.quasar.dev/options/animations
    animations: [],

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-file#sourcefiles
    // sourceFiles: {
    //   rootComponent: 'src/App.vue',
    //   router: 'src/router/index',
    //   store: 'src/store/index',
    //   pwaRegisterServiceWorker: 'src-pwa/register-service-worker',
    //   pwaServiceWorker: 'src-pwa/custom-service-worker',
    //   pwaManifestFile: 'src-pwa/manifest.json',
    //   electronMain: 'src-electron/electron-main',
    //   electronPreload: 'src-electron/electron-preload'
    //   bexManifestFile: 'src-bex/manifest.json
    // },

    // https://v2.quasar.dev/quasar-cli-vite/developing-ssr/configuring-ssr
    ssr: {
      prodPort: 3000, // The default port that the production server should use
      // (gets superseded if process.env.PORT is specified at runtime)

      middlewares: [
        'render', // keep this as last one
      ],

      // extendPackageJson (json) {},
      // extendSSRWebserverConf (esbuildConf) {},

      // manualStoreSerialization: true,
      // manualStoreSsrContextInjection: true,
      // manualStoreHydration: true,
      // manualPostHydrationTrigger: true,

      pwa: false,
      // pwaOfflineHtmlFilename: 'offline.html', // do NOT use index.html as name!

      // pwaExtendGenerateSWOptions (cfg) {},
      // pwaExtendInjectManifestOptions (cfg) {}
    },

    // https://v2.quasar.dev/quasar-cli-vite/developing-pwa/configuring-pwa
    pwa: {
      workboxMode: 'GenerateSW', // 'GenerateSW' or 'InjectManifest'
      // swFilename: 'sw.js',
      // manifestFilename: 'manifest.json',
      // extendManifestJson (json) {},
      // useCredentialsForManifestTag: true,
      // injectPwaMetaTags: false,
      // extendPWACustomSWConf (esbuildConf) {},
      // extendGenerateSWOptions (cfg) {},
      // extendInjectManifestOptions (cfg) {}
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-cordova-apps/configuring-cordova
    cordova: {
      // noIosLegacyBuildFlag: true, // uncomment only if you know what you are doing
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-capacitor-apps/configuring-capacitor
    capacitor: {
      hideSplashscreen: true,
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-electron-apps/configuring-electron
    electron: {
      // extendElectronMainConf (esbuildConf) {},
      // extendElectronPreloadConf (esbuildConf) {},

      // extendPackageJson (json) {},

      // Electron preload scripts (if any) from /src-electron, WITHOUT file extension
      preloadScripts: ['electron-preload'],

      // specify the debugging port to use for the Electron app when running in development mode
      inspectPort: 5858,

      bundler: 'packager', // 'packager' or 'builder'

      packager: {
        // https://github.com/electron-userland/electron-packager/blob/master/docs/api.md#options
        // OS X / Mac App Store
        // appBundleId: '',
        // appCategoryType: '',
        // osxSign: '',
        // protocol: 'myapp://path',
        // Windows only
        // win32metadata: { ... }
      },

      builder: {
        // https://www.electron.build/configuration/configuration

        appId: 'versesense',
      },
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-browser-extensions/configuring-bex
    bex: {
      // extendBexScriptsConf (esbuildConf) {},
      // extendBexManifestJson (json) {},

      /**
       * The list of extra scripts (js/ts) not in your bex manifest that you want to
       * compile and use in your browser extension. Maybe dynamic use them?
       *
       * Each entry in the list should be a relative filename to /src-bex/
       *
       * @example [ 'my-script.ts', 'sub-folder/my-other-script.js' ]
       */
      extraScripts: [],
    },
  };
});
