# VerseSense — Full Implementation Plan

## Overview

We are rebuilding the editor from a raw textarea into a **structured token-based editor** with per-word phonetic metadata (language, stress), paired with a **canvas-based phonetic visualization**.

The system has 5 architectural layers and 10 implementation phases.

---

## Architecture Layers

```
Layer 1 — Document Model         src/model/
Layer 2 — Phonetic Engines       src/services/poetryEngines/
Layer 3 — Enrichment Pipeline    src/services/enrichment/
Layer 4 — Pinia Stores           src/stores/
Layer 5 — UI Components          src/components/editor/ + visualizer/
```

---

## Phase 1 — Universal Phoneme Registry

**Goal:** Define a single source of truth for all IPA phonemes used by UA, PL, and EN engines. Each phoneme is a typed object with full feature vectors. The registry exposes a `getSimilarity(a, b)` function used by the visualizer.

**Files to create:**
```
src/services/poetryEngines/shared/phonemes/
  IPhoneme.ts             — interfaces and enums for all phoneme features
  PhonemeRegistry.ts      — master dictionary: IPA symbol → IPhoneme object
  similarity.ts           — getSimilarity(a, b): 0.0–1.0 weighted distance
```

**Detailed spec:**

### `IPhoneme.ts`

Enums:
- `PhonemeType`: `VOWEL | CONSONANT`
- `ConsonantPlace`: `BILABIAL | LABIODENTAL | DENTAL | ALVEOLAR | POSTALVEOLAR | RETROFLEX | PALATAL | VELAR | UVULAR | GLOTTAL`
- `ConsonantManner`: `PLOSIVE | NASAL | TRILL | TAP | FRICATIVE | LATERAL_FRICATIVE | APPROXIMANT | LATERAL_APPROXIMANT | AFFRICATE`
- `Voicing`: `VOICED | VOICELESS`
- `VowelHeight`: `CLOSE | NEAR_CLOSE | CLOSE_MID | MID | OPEN_MID | NEAR_OPEN | OPEN`
- `VowelBackness`: `FRONT | CENTRAL | BACK`
- `Roundness`: `ROUNDED | UNROUNDED`

Interfaces:
```ts
interface IPhonemeBase {
  symbol: string;       // IPA symbol (e.g. 'p', 'ɑ')
  type: PhonemeType;
  languages: Language[]; // which engines use this phoneme
}

interface IConsonant extends IPhonemeBase {
  type: PhonemeType.CONSONANT;
  place: ConsonantPlace;
  manner: ConsonantManner;
  voicing: Voicing;
  palatalized?: boolean;  // for UA/PL soft consonants
}

interface IVowel extends IPhonemeBase {
  type: PhonemeType.VOWEL;
  height: VowelHeight;
  backness: VowelBackness;
  roundness: Roundness;
}

type IPhoneme = IConsonant | IVowel;
```

### `PhonemeRegistry.ts`

A `Map<string, IPhoneme>` keyed by IPA symbol. Must include:

**Ukrainian consonants** (~32): б, п, в, ф, м, д, т, з, с, н, л, р, ж, ш, ч, щ, й, к, г, ґ, х, ц, дз, дж + palatalized variants

**Polish-specific additions** (~5): ś, ź, ć, ń, ł, rz/ż unification

**English additions** (~8): θ, ð, ŋ, æ, ʌ, ɪ, ʊ, ə, ɜ, ɔ

**Shared vowels** (~10): a, e, i, o, u, ɑ, ɛ, ɔ, ʊ, ɪ, ə, etc.

### `similarity.ts`

Feature weight tables:
```ts
const CONSONANT_WEIGHTS = {
  place:       0.35,
  manner:      0.35,
  voicing:     0.20,
  palatalized: 0.10,
};

const VOWEL_WEIGHTS = {
  height:    0.50,
  backness:  0.35,
  roundness: 0.15,
};
```

Logic:
- Same type (both consonant or both vowel): compute weighted feature overlap → 0.0–1.0
- Different types (consonant vs vowel): always return 0.0
- Same symbol: always return 1.0

**Depends on:** nothing (pure data layer)

---

## Phase 2 — Document Model

**Goal:** Define typed classes/interfaces representing a parsed poem as a tree of tokens.

**Files to create:**
```
src/model/
  Language.ts             — 'ua' | 'pl' | 'en-us' | 'en-gb' union + metadata
  Token.ts                — union type: WordToken | TypoToken
  WordToken.ts            — word with language, stressIndex, syllables, id
  TypoToken.ts            — kind: NEWLINE | TAB | GAP
  Line.ts                 — array of tokens (never starts/ends with GAP)
  PoetryDocument.ts       — array of Lines + flat token index
```

**Detailed spec:**

### `Language.ts`
```ts
type Language = 'ua' | 'pl' | 'en-us' | 'en-gb';
const DEFAULT_LANGUAGE: Language = 'ua';
```

### `Token.ts`
```ts
type TokenKind = 'WORD' | 'NEWLINE' | 'TAB' | 'GAP';

interface IToken {
  id: string;   // uuid
  kind: TokenKind;
}
```

### `WordToken.ts`
```ts
interface IWordToken extends IToken {
  kind: 'WORD';
  text: string;             // original text as typed
  language: Language;
  stressIndex: number | null;  // index of stressed SYLLABLE (not letter), null = unknown
  // computed after phonetization:
  syllables: ISyllable[] | null;
}
```

### `TypoToken.ts`
```ts
interface ITypoToken extends IToken {
  kind: 'NEWLINE' | 'TAB' | 'GAP';
}
```

### `Line.ts`
```ts
interface ILine {
  id: string;
  tokens: IToken[];  // WordToken | GAP | TAB — never NEWLINE (that's the line separator)
  lineIndex: number;
}
```

### `PoetryDocument.ts`
```ts
interface IPoetryDocument {
  lines: ILine[];
  tokenIndex: Map<string, IToken>;  // id → token for O(1) lookup
}
```

**Depends on:** Phase 1 (for `ISyllable` which uses `IPhoneme`)

---

## Phase 3 — Document Parser

**Goal:** Convert raw `string` (from localStorage / user input) into a `IPoetryDocument`.

**Files to create:**
```
src/model/DocumentParser.ts
```

**Parsing rules (critical):**
1. Split on `\n` → raw lines
2. For each raw line:
   - Detect leading `\t` characters → emit `TAB` tokens (one per tab), then strip them
   - Strip trailing spaces from the line
   - Split remaining by `/\s+/` → word strings + `GAP` tokens between them
   - Strip leading spaces from first word (not tabs — already handled)
3. Each word string → `WordToken` with `language = DEFAULT`, `stressIndex = null`
4. Lines are separated by `NEWLINE` tokens in the flat stream, but stored as separate `ILine` objects
5. Empty lines → `ILine` with zero tokens (renders as blank row)

**Also create:**
```
src/model/DocumentSerializer.ts   — IPoetryDocument → raw string (for save/copy)
```

**Depends on:** Phase 2

---

## Phase 4 — Refactor UA Phonetic Engine

**Goal:** Adapt the existing UA `Phonetizer` + `Sylabizer` + `Word` to implement a common `IPhoneticEngine` interface. Replace their internal `Phoneme` type with `IPhoneme` from the registry.

**Files to create/modify:**
```
src/services/poetryEngines/shared/IPhoneticEngine.ts   — new interface
src/services/poetryEngines/ua/uaPhoneticEngine.ts      — refactor to implement interface
src/services/poetryEngines/ua/Phonetizer.ts            — map output to IPhoneme from registry
src/services/poetryEngines/ua/Sylabizer.ts             — fix broken syllabization logic
```

**`IPhoneticEngine` interface:**
```ts
interface IPhoneticEngine {
  language: Language;
  // Takes a word string + optional stress syllable index
  // Returns array of syllables with IPhoneme arrays
  phonetize(word: string, stressIndex: number | null): ISyllable[];
}
```

**UA engine refactor notes:**
- `Phonetizer.ts` already has phoneme feature data — map symbols to `PhonemeRegistry` entries
- `Sylabizer.ts` has a **critical bug**: the loop returns early inside the `for` on line ~67 — this needs a full rewrite of the syllabization loop
- `Word.ts` validation logic is good, keep it but decouple from UA-only characters

**Depends on:** Phase 1, 2

---

## Phase 5 — Pinia Poetry Store

**Goal:** Central reactive state for the document, phonetization, and per-word user metadata.

**Files to create:**
```
src/stores/poetry.ts
```

**State:**
```ts
{
  rawText: string,                    // persisted to localStorage
  document: IPoetryDocument | null,   // parsed token tree
  defaultLanguage: Language,          // global default for new words
}
```

**Actions:**
```ts
setRawText(text: string): void         // re-parses document
setWordLanguage(id: string, lang: Language): void
setWordStress(id: string, syllableIdx: number | null): void
getWordSyllables(id: string): ISyllable[]   // runs engine on demand / cached
```

**Getters:**
```ts
allTokens: IToken[]          // flat list
wordTokens: IWordToken[]     // filtered
phonetizedWords: Map<string, ISyllable[]>   // id → syllables
```

**Depends on:** Phase 2, 3, 4

---

## Phase 6 — WordChip + Context Menu Components

**Goal:** The core interactive unit. A `WordChip` renders one word inline and on hover shows a floating menu for language + stress selection.

**Files to create:**
```
src/components/editor/
  WordChip.vue          — renders a word token, emits hover/click
  WordContextMenu.vue   — floating panel below the word
  StressPicker.vue      — shows syllables as buttons, highlights stressed one
  LanguagePicker.vue    — 4 language buttons with flag emoji
```

### `WordChip.vue`
- Renders `token.text` in a `<span>`
- On `mouseenter` → show `WordContextMenu` as an absolutely-positioned overlay
- On `mouseleave` (with delay) + click-outside → hide menu
- Visual states: default / has-language / has-stress / fully-annotated
- Color coding: language badge color shown as a small dot under the word

### `WordContextMenu.vue`
- Step 1: Language selection (`LanguagePicker`)
- Step 2: After language selected → show `StressPicker` with syllables from store
- Emits: `update:language`, `update:stress`
- Uses `q-menu` or custom absolutely-positioned `<div>` with `z-index`

### `StressPicker.vue`
- Receives `syllables: ISyllable[]`
- Renders each syllable as a button showing its text
- Highlighted button = current stress
- Click → emit stressed index

**Depends on:** Phase 4, 5

---

## Phase 7 — Poetry Editor (Replace Textarea)

**Goal:** Replace `<q-input type="textarea">` in `MainPage.vue` with the token-based editor.

**Files to create/modify:**
```
src/components/editor/
  PoetryEditor.vue      — root editor: renders EditorLine per line
  EditorLine.vue        — renders tokens in a line (WordChip | TabCell | GapCell)
  TabCell.vue           — renders an indentation cell (empty box)
  GapCell.vue           — renders a 2px vertical gap between words
src/pages/MainPage.vue  — swap textarea for <PoetryEditor>
```

### `PoetryEditor.vue`
- Receives document from store
- Renders `<EditorLine v-for="line in document.lines" />`
- Has a hidden `<textarea>` overlay (or contenteditable fallback) for raw text input
- Strategy: show a raw textarea when focused/empty, switch to token view when blurred + has content

### `EditorLine.vue`
- `v-for` over `line.tokens`
- `WordChip` for WORD tokens
- `TabCell` for TAB tokens (fixed-width empty box)
- `GapCell` for GAP tokens

**Depends on:** Phase 5, 6

---

## Phase 8 — Enrichment Pipeline

**Goal:** After all words are phonetized, run analysis passes to compute rhyme groups, similarity scores, and grid coordinates for the canvas.

**Files to create:**
```
src/services/enrichment/
  EnrichmentPipeline.ts       — orchestrates all passes
  RhymeGroupMapper.ts         — groups line-final syllable "tails" by phonetic similarity
  SimilarityScorer.ts         — scores each word's tail vs its rhyme group anchor
  CoordinateMapper.ts         — assigns (col, row) grid positions to every token
  PhonemeIndex.ts             — flat map: IPA symbol → token IDs containing it
  EnrichedDocument.ts         — output type: IPoetryDocument + enrichment metadata
```

### `RhymeGroupMapper`
- Looks at the last syllable of the last word on each line
- Compares phoneme "tails" (vowel + following consonants) using `getSimilarity`
- Groups lines with similarity > threshold (configurable, default 0.65) into rhyme groups
- Assigns a `rhymeGroupId` (integer) and a `rhymeGroupHue` (degrees 0–360) to each

### `CoordinateMapper`
- Iterates all tokens in document order
- `TAB` → advance col by `TAB_WIDTH` (e.g. 4)
- `GAP` → advance col by 1 (thin gap cell)
- `WORD` → each syllable gets its own cell: col advances by syllable count
- `NEWLINE` → col = 0, row++
- Output: `Map<syllableId, {col, row}>`

### `PhonemeIndex`
- Flat: `Map<ipaSymbol, Set<syllableId>>`
- Used by canvas web-drawing: "give me all syllable positions containing /r/"

**Depends on:** Phase 1, 2, 5

---

## Phase 9 — Canvas Visualizer

**Goal:** High-DPI canvas panel on the right rendering the enriched document as a phonetic grid with rhyme coloring, stress markers, and spider-web phoneme connections.

**Files to create:**
```
src/components/visualizer/
  PhoneticCanvas.vue        — Vue wrapper: canvas element + resize observer
  CanvasRenderer.ts         — pure class, no Vue deps, all drawing logic
  VisualizerControls.vue    — sliders + phoneme toggles
  useCanvasResize.ts        — composable: watches container size, updates canvas resolution
```

### Drawing layers (bottom to top):
1. **Background** — fill `#121212`
2. **Web layer** — `quadraticCurveTo` arcs between cells sharing a selected phoneme
   - Stroke: gradient, bright center (glow effect), color = phoneme group color
   - Drawn *before* cells so it appears behind them
3. **Cell layer** — one cell per syllable
   - Fill: `HSL(rhymeGroupHue, similarity × 100%, 45%)`
   - Border: `2px solid yellow` if stressed, else `1px solid rgba(255,255,255,0.15)`
   - Text: IPA symbol of nucleus vowel, white, small font
4. **Overlay layer** — stress `ˈ` marker above cell, similarity% badge

### `VisualizerControls.vue`
- Cell size: slider 20–80px
- Gap width: slider 2–16px
- Similarity threshold: slider 0.0–1.0 (filters rhyme grouping)
- Phoneme toggle list: checkboxes for each IPA symbol present in document
  - Checking a phoneme activates its web

**Depends on:** Phase 8

---

## Phase 10 — Polish (PL) and English (EN) Engine Stubs

**Goal:** Add minimal but functional phonetic engines for PL and EN so the UI doesn't break when user selects those languages.

**Files to create:**
```
src/services/poetryEngines/pl/
  plPhoneticEngine.ts     — rule-based: Polish grapheme-to-phoneme (simplified)

src/services/poetryEngines/en/
  enPhoneticEngine.ts     — CMU pronunciation dict lookup (top ~10k words) + rule fallback
  cmu-top10k.ts           — static dict: word → IPA string
```

**PL engine notes:**
- Polish spelling is highly phonemic — rules cover ~90% of words
- Key rules: sz→ʃ, cz→tʃ, rz/ż→ʒ, dź→dʑ, ś→ɕ, ń→ɲ, ó→u, etc.
- Stress: always penultimate syllable (with rare exceptions, treat as always penultimate)

**EN engine notes:**
- English spelling is irregular — rule-based alone is ~60% accurate
- Strategy: CMU dict for common words + simple fallback rules for unknowns
- Stress: use CMU dict markers

**Depends on:** Phase 1, 4

---

## Dependency Graph

```
Phase 1 (Phoneme Registry)
  └── Phase 2 (Document Model)
        └── Phase 3 (Parser)
              └── Phase 5 (Store)
                    ├── Phase 6 (WordChip + Menu)
                    │     └── Phase 7 (Editor)
                    └── Phase 8 (Enrichment Pipeline)
                          └── Phase 9 (Canvas)
Phase 4 (UA Engine Refactor) ──┤ (feeds Phase 5 + 8)
Phase 10 (PL/EN Stubs) ────────┘
```

---

## File Creation Summary

| Phase | New Files | Modified Files |
|-------|-----------|---------------|
| 1 | `shared/phonemes/IPhoneme.ts`, `PhonemeRegistry.ts`, `similarity.ts` | — |
| 2 | `model/Language.ts`, `Token.ts`, `WordToken.ts`, `TypoToken.ts`, `Line.ts`, `PoetryDocument.ts` | — |
| 3 | `model/DocumentParser.ts`, `DocumentSerializer.ts` | — |
| 4 | `shared/IPhoneticEngine.ts` | `ua/Phonetizer.ts`, `ua/Sylabizer.ts`, `ua/uaPhoneticEngine.ts` |
| 5 | `stores/poetry.ts` | — |
| 6 | `components/editor/WordChip.vue`, `WordContextMenu.vue`, `StressPicker.vue`, `LanguagePicker.vue` | — |
| 7 | `components/editor/PoetryEditor.vue`, `EditorLine.vue`, `TabCell.vue`, `GapCell.vue` | `pages/MainPage.vue` |
| 8 | `services/enrichment/EnrichmentPipeline.ts`, `RhymeGroupMapper.ts`, `SimilarityScorer.ts`, `CoordinateMapper.ts`, `PhonemeIndex.ts`, `EnrichedDocument.ts` | — |
| 9 | `components/visualizer/PhoneticCanvas.vue`, `CanvasRenderer.ts`, `VisualizerControls.vue`, `useCanvasResize.ts` | `pages/MainPage.vue` |
| 10 | `services/poetryEngines/pl/plPhoneticEngine.ts`, `en/enPhoneticEngine.ts`, `en/cmu-top10k.ts` | — |

**Total: ~35 new files, ~4 modified files**
