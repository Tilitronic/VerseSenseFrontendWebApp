# Copilot Workspace Instructions

## After every change — run the full build

Always run `pnpm quasar build` after making changes. The build pipeline runs ESLint and all Vitest tests before producing output. A passing build confirms there are no type errors, lint violations, or broken tests.

```
pnpm quasar build
```

If the build fails, fix all reported errors before considering the task done.

## Project conventions

- Framework: Quasar 2 / Vue 3 / Vite / TypeScript / Pinia
- Package manager: **pnpm**
- Tests: Vitest — run individually with `pnpm vitest run <path>`
- Lint: ESLint with `@typescript-eslint` — errors must be zero before shipping

## Key architecture notes

- Ukrainian stress: `ua-word-stress-wasm` (WASM, ~3M word forms). Wrapper: `src/services/stress/uaWasmService.ts`. Composable: `src/composables/useUaStress.ts`. Boot: `src/boot/uaWasm.ts`.
- Polish stress: `@tilitronic/polish-stress-wasm`. See `/memories/repo/polish-stress-service.md`.
- ML fallback: Luscinia ONNX model (`ua-stress-ml`) for OOV words only.
- WASM objects returned by `serde_wasm_bindgen` use enumerable getter-based properties — always JSON-round-trip before `typeof` checks.
- Runtime field name is `syllableIndex` (the `.d.ts` JSDoc comment erroneously shows `stressIndex`).
- Multiple WASM readings with the **same** `syllableIndex` are grammatical variants (same pronunciation), NOT heteronyms. Only flag as heteronym when unique stress positions differ.
