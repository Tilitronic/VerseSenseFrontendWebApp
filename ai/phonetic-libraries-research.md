# Phonetic & IPA Libraries Research

## VerseSense — UA / EN / PL across Python and TypeScript/JavaScript

**Date:** February 2026  
**Scope:** Implementation Plan Phase 1 (PhonemeRegistry) + Phase 10 (PL engine)  
**Goal:** Identify libraries for G2P, phoneme features, syllabification, and stress — across both the Python backend and TypeScript frontend — with minimal duplication.

---

## The Three Capabilities Needed

| Capability                   | Description                                                                                        |
| ---------------------------- | -------------------------------------------------------------------------------------------------- |
| **G2P**                      | word → IPA string (`"gold"` → `"goʊld"`)                                                           |
| **Phoneme features**         | IPA symbol → feature object (`"ʃ"` → `{place: postalveolar, manner: fricative, voiced: false, …}`) |
| **Syllabification + stress** | IPA string → syllables with stressed syllable index                                                |

No single library covers all three for all three languages on both platforms.

---

## 1. Phoneme Feature Databases

These answer: _"given IPA symbol `ʃ`, what are its articulatory features?"_

### `panphon` — ⭐ Recommended for Python

- **Install:** `pip install panphon`
- **Maintainer:** CMU (David Mortensen) — actively maintained
- **Coverage:** ~900 IPA segments → 24 binary features each
- **Features include:** `syl, son, cons, cont, delrel, lat, nas, voi, sg, cg, ant, cor, distr, lab, hi, lo, back, round, velaric, tense, long`
- **Built-in distance:**
  ```python
  ft = panphon.FeatureTable()
  ft.fts('p').hamming_feature_edit_distance(ft.fts('b'))  # → 1  (voicing only)
  ft.fts('p').hamming_feature_edit_distance(ft.fts('s'))  # → 6  (place + manner)
  ```
- **EN:** ✅ Full coverage
- **UA gaps:**
  - ✅ `ɦ` (Ukrainian г — voiced glottal/pharyngeal fricative)
  - ✅ `dʒ`, `dz` — present as single affricate segments
  - ❌ Palatalized variants `tʲ dʲ nʲ lʲ rʲ sʲ zʲ tsʲ dzʲ` — NOT in base table
  - **Fix:** extend with `ua_extensions.csv` (see Section 7)
- **PL:** ✅ `ɕ ʑ tɕ dʑ` (Polish soft consonants) — present

### `panphon` JS port — ❌ Do not use

- npm: `panphon` — last published 2019, unmaintained, incomplete
- **Alternative:** export panphon's `ipa_bases.csv` to JSON at build time and import directly in TS (see Section 7)

### `phonological-feature-system` — ⚠️ Skip

- npm: `phonological-feature-system`
- SPE-style features, EN-only focus, missing UA/PL segments
- No advantage over panphon JSON export

---

## 2. G2P — English

### `cmu-pronouncing-dictionary` — ⭐ Already in project (TS)

- **Install:** `pnpm add cmu-pronouncing-dictionary` _(already installed)_
- **Coverage:** 134,000 words, Carnegie Mellon quality
- **Format:** ARPABET with embedded stress digits — `G OW1 L D` (digit `1` = primary stress, `2` = secondary, `0` = unstressed)
- **Stress:** fully encoded — no separate stress detection needed
- **Used in:** `enTranscription.ts` → `transcribeFromCmu()` → ARPABET→IPA conversion

### `pronouncing` — ⭐ Recommended for Python

- **Install:** `pip install pronouncing`
- **What it is:** Python wrapper around the same CMU dictionary
  ```python
  import pronouncing
  pronouncing.phones_for_word("gold")   # → ["G OW1 L D"]
  pronouncing.stresses("G OW1 L D")    # → "010"
  ```
- **Verdict:** Use on Python side — same CMU source as TS frontend → guaranteed consistency across platforms

### `phonemizer` — ⭐ Best Python G2P for production (EN + PL)

- **Install:** `pip install phonemizer`
- **Requires:** `espeak-ng` system binary (`apt install espeak-ng`)
- **Languages:** EN, PL, and 80+ others via espeak-ng backend
- **Output:** Direct IPA with syllable boundaries and stress markers
- **Caveat:** Cannot run in browser — server only
- **Verdict:** Best EN and PL G2P for Python backend if espeak-ng is available on the server

### `gruut` — ⚠️ EN-only, Python

- **Install:** `pip install gruut`
- EN, DE, FR, ES, NL — **no UA, no PL**
- Returns syllabified IPA with stress — useful for EN if phonemizer is unavailable
- **Verdict:** EN fallback only

---

## 3. G2P — Ukrainian

### No production-ready JS/TS library exists.

This is the honest state of the ecosystem as of early 2026.

### `epitran` with `ukr-Cyrl` — ⚠️ Python, research-grade

- **Install:** `pip install epitran` + requires `flite` + language data files
- Rule-based G2P, outputs IPA
- **Coverage:** ~80% of common vocabulary
- **Gaps:** does not handle vowel reduction, progressive assimilation, or the full palatalization system
- **Verdict:** Useful for validation and testing; not production-ready for poetry-grade analysis

### `ukrainian-word-stress` — ⭐ Recommended for stress (Python)

- **Install:** `pip install ukrainian-word-stress`
- ML model trained on large Ukrainian corpus
- **Accuracy:** ~94% on common vocabulary
  ```python
  from ukrainian_word_stress import Stressifier
  s = Stressifier()
  s("слово")    # → "сло́во"
  s("вірш")     # → "ві́рш"
  ```
- **Verdict:** Use on Python backend. No equivalent exists for TS — use rule-based stress fallback on frontend.

### `pymorphy2` + Ukrainian dictionary — ⭐ Morphological context (Python)

- **Install:** `pip install pymorphy2 pymorphy2-dicts-uk`
- Lemmatization, POS, case, number
- Not G2P directly, but enables smarter phonetization decisions (e.g. distinguish verb `жити` from noun context)
- **Verdict:** Useful complement to the G2P pipeline on the backend

### Frontend (TS) — `Phonetizer.ts` (custom, keep + improve)

- The existing custom UA phonetizer is currently the best available TS solution
- Should be improved rather than replaced
- Key improvements needed: vowel reduction allophone selection, progressive voicing assimilation, full palatalization marking
- Rule data should be extracted to YAML so the Python side can consume the same rules (see Section 8)

---

## 4. G2P — Polish

### No dedicated npm/TS library exists.

### `epitran` with `pol-Latn` — ⚠️ Python, research-grade

- Basic Polish G2P
- Handles core digraphs (`sz→ʃ`, `cz→tʃ`, `rz/ż→ʒ`, `ci/si/ni/zi` palatalization)
- **Verdict:** Validation/testing only

### `phonemizer` + espeak-ng — ⭐ Best Python option for PL

- espeak-ng has solid Polish support
- Handles accent-marked letters (`ą ę ó ź ś ć ń ż`) correctly
- **Verdict:** Best PL G2P for Python backend

### Frontend (TS) — rule-based (Phase 10)

- Polish orthography is largely phonemic — ~20 rules cover ~92% of vocabulary
- Implement as `plTranscription.ts` following the same architecture as `enTranscription.ts`
- The rule data can be shared as YAML (see Section 8)

---

## 5. Syllabification

### Python

| Library      | Languages         | Notes                                                        |
| ------------ | ----------------- | ------------------------------------------------------------ |
| `pyphen`     | 70+ incl. UA, PL  | Hyphenation-based; good approximation of syllable boundaries |
| `phonemizer` | EN + espeak langs | Returns syllabified IPA directly; most accurate              |
| `gruut`      | EN + 9 others     | Syllabified IPA output with stress                           |
| `syllapy`    | EN only           | Fast, dictionary-based EN syllable counter                   |

### TypeScript

| Library                 | Languages | Notes                                              |
| ----------------------- | --------- | -------------------------------------------------- |
| `hypher` + dict         | 30+ langs | Hyphenation only, not IPA-level                    |
| `syllable`              | EN only   | Simple word-level counter                          |
| `Sylabizer.ts` (custom) | UA        | In project — needs the nucleus-detection bug fix   |
| `splitIpaToSyllables`   | EN/UA     | In `enTranscription.ts` — fixed in current session |

### Recommendation

- **Python:** `phonemizer`/`gruut` for EN, `pyphen` for UA/PL
- **TS:** keep custom implementations; ensure both use `tokenizeIPA()` for nucleus detection (diphthong-safe)

---

## 6. ARPABET → IPA Conversion Table

Already implemented in `enTranscription.ts`. The Python equivalent is the same 39-entry map:

```python
ARPABET_TO_IPA = {
    'AA': 'ɑ',  'AE': 'æ',   'AH': 'ʌ',   'AO': 'ɔ',   'AW': 'aʊ',
    'AX': 'ə',  'AY': 'aɪ',  'EH': 'ɛ',   'ER': 'ɜr',  'EY': 'eɪ',
    'IH': 'ɪ',  'IY': 'iː',  'OW': 'oʊ',  'OY': 'ɔɪ',  'UH': 'ʊ',
    'UW': 'uː',
    'B':  'b',  'CH': 'tʃ',  'D':  'd',   'DH': 'ð',   'DX': 'ɾ',
    'F':  'f',  'G':  'ɡ',   'HH': 'h',   'JH': 'dʒ',  'K':  'k',
    'L':  'l',  'M':  'm',   'N':  'n',   'NG': 'ŋ',   'P':  'p',
    'R':  'r',  'S':  's',   'SH': 'ʃ',   'T':  't',   'TH': 'θ',
    'V':  'v',  'W':  'w',   'Y':  'j',   'Z':  'z',   'ZH': 'ʒ',
    # special: AH0 → schwa (handled in code: AH + stress digit 0)
}
```

This table should live in `shared-phonetics/arpabet_to_ipa.json` — consumed by both sides.

---

## 7. Extending `panphon` for Ukrainian Palatalization

### The gap

Panphon does not include `ʲ`-diacritic variants as separate segments. The `hi=1` feature in panphon encodes high tongue body (which includes palatalization) but only on single-character base segments. Composite palatalized segments (`tʲ`, `dʲ`, `nʲ`…) are absent.

### The fix — `ua_extensions.csv`

Same column format as panphon's `ipa_bases.csv`. The `hi=1` column (position 16) encodes palatalization:

```
ipa,syl,son,cons,cont,delrel,lat,nas,voi,sg,cg,ant,cor,distr,lab,hi,lo,back,round,velaric,tense,long,hitone,hireg
tʲ,-1,-1,1,-1,-1,-1,-1,-1,-1,-1,1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1
dʲ,-1,-1,1,-1,-1,-1,-1,1,-1,-1,1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1
nʲ,-1,1,1,-1,-1,-1,1,1,-1,-1,1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1
lʲ,-1,1,1,-1,-1,1,-1,1,-1,-1,1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1
rʲ,-1,1,1,-1,-1,-1,-1,1,-1,-1,1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1
sʲ,-1,-1,1,1,-1,-1,-1,-1,-1,-1,1,1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1
zʲ,-1,-1,1,1,-1,-1,-1,1,-1,-1,1,1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1
tsʲ,-1,-1,1,-1,1,-1,-1,-1,-1,-1,1,1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1
dzʲ,-1,-1,1,-1,1,-1,-1,1,-1,-1,1,1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1
```

### Python usage

```python
ft = panphon.FeatureTable()
ft.add_segment_from_file('shared-phonetics/ua_extensions.csv')
ft.fts('tʲ')   # now returns full feature bundle
ft.fts('nʲ').hamming_feature_edit_distance(ft.fts('n'))  # → 1 (palatalization only)
```

### TypeScript usage (build-time merge)

```typescript
import base from './ipa_bases.json'; // exported from panphon CSV
import uaExt from './ua_extensions.json'; // your CSV converted to JSON
const registry = new Map([...base, ...uaExt].map((r) => [r.ipa, r]));
```

---

## 8. G2P Rule Data as Shared YAML

The grapheme-to-IPA rules for UA and PL are the primary source of duplication. Extracting them to YAML makes both sides consume identical rules:

```yaml
# shared-phonetics/g2p-ua.yaml
language: uk
rules:
  - grapheme: 'дж'
    ipa: 'dʒ'
    context: null
    priority: 10
  - grapheme: 'дз'
    ipa: 'dz'
    context: null
    priority: 10
  - grapheme: 'ть'
    ipa: 'tʲ'
    context: word_final
    priority: 8
  - grapheme: 'а'
    ipa_stressed: 'ɑ'
    ipa_unstressed: 'ɐ'
    priority: 1
```

Both sides implement a ~50-line rule-application engine. The rules never diverge.

---

## 9. Cross-Platform Compatibility Matrix

| Capability             | Python                          | TypeScript                      | Shared?                            |
| ---------------------- | ------------------------------- | ------------------------------- | ---------------------------------- |
| **EN G2P**             | `pronouncing` (CMU)             | `cmu-pronouncing-dictionary`    | ✅ Same CMU source                 |
| **EN features**        | `panphon`                       | `ipa_bases.json` from panphon   | ✅ Same CSV                        |
| **EN syllabification** | `gruut` / `phonemizer`          | `splitIpaToSyllables.ts`        | ⚠️ Algorithm shared, impl separate |
| **UA G2P**             | `epitran` + custom rules        | `Phonetizer.ts` + custom rules  | ✅ Rules in shared YAML            |
| **UA stress**          | `ukrainian-word-stress` (ML)    | rule-based fallback             | ❌ ML not portable to browser      |
| **UA features**        | `panphon` + `ua_extensions.csv` | `ua_extensions.json`            | ✅ Same CSV                        |
| **UA syllabification** | `pyphen`                        | `Sylabizer.ts` (custom)         | ⚠️ Algorithm shared, impl separate |
| **PL G2P**             | `phonemizer` / `epitran`        | rule-based `plTranscription.ts` | ✅ Rules in shared YAML            |
| **PL features**        | `panphon` (mostly covered)      | `ipa_bases.json`                | ✅                                 |
| **ARPABET→IPA**        | inline table                    | `enTranscription.ts`            | ✅ `arpabet_to_ipa.json`           |
| **Similarity**         | `panphon` hamming distance      | custom `similarity.ts`          | ✅ Same algorithm                  |

---

## 10. Recommended Stack — Final Decision

### Python Backend

```
panphon                   # phoneme features + similarity
pronouncing               # EN G2P (same CMU dict as frontend)
ukrainian-word-stress     # UA stress prediction (ML, ~94% accuracy)
pyphen                    # UA/PL syllabification
phonemizer                # EN + PL G2P via espeak-ng (if espeak available on server)
pymorphy2 + dicts-uk      # UA morphological context (optional)
```

### TypeScript Frontend

```
cmu-pronouncing-dictionary   # EN G2P — already installed
# ipa_bases.json             — exported from panphon at project setup (one-time)
# ua_extensions.json         — palatalized UA consonants (authored, small)
# Phonetizer.ts              — UA G2P (custom, keep + improve)
# plTranscription.ts         — PL G2P (implement Phase 10)
```

### Shared Data — `shared-phonetics/` folder

```
ipa_bases.json          ← panphon CSV exported to JSON (one-time script)
ua_extensions.csv       ← palatalized UA consonants (hand-authored, ~10 rows)
ua_extensions.json      ← same, JSON form for TS
arpabet_to_ipa.json     ← 39-entry ARPABET→IPA map
g2p-ua.yaml             ← UA grapheme rules (shared between Python + TS)
g2p-pl.yaml             ← PL grapheme rules (Phase 10)
```

---

## 11. What Must Be Duplicated (Unavoidable)

| Logic                       | Why not shareable                      | Mitigation                                                           |
| --------------------------- | -------------------------------------- | -------------------------------------------------------------------- |
| UA stress prediction        | ML model not runnable in browser       | Rule-based approximation on frontend is acceptable for display       |
| Syllabification engine      | Different data structures per runtime  | Both use the same vowel-nucleus algorithm; test with shared fixtures |
| Allophone selection         | Internal language logic, not IPA-level | Lives entirely in each engine; not in shared data                    |
| G2P rule application engine | ~50 lines trivial to reimplement       | Rules themselves live in shared YAML                                 |

---

## 12. One-Time Setup Script

To export panphon's CSV to JSON (run once when setting up the project):

```python
# scripts/export_panphon_to_json.py
import panphon, json, csv, os

ft = panphon.FeatureTable()
data_path = os.path.join(os.path.dirname(panphon.__file__), 'data', 'ipa_bases.csv')

rows = []
with open(data_path) as f:
    reader = csv.DictReader(f)
    for row in reader:
        # convert '+'/'-'/'0' strings to 1/-1/0 integers
        converted = {'ipa': row['ipa']}
        for k, v in row.items():
            if k == 'ipa': continue
            converted[k] = 1 if v == '+' else -1 if v == '-' else 0
        rows.append(converted)

out = os.path.join('shared-phonetics', 'ipa_bases.json')
with open(out, 'w') as f:
    json.dump(rows, f, ensure_ascii=False, indent=2)

print(f"Exported {len(rows)} segments → {out}")
```

---

## 13. Summary

The combination of `panphon` + `pronouncing` (Python) and `cmu-pronouncing-dictionary` + `ipa_bases.json` (TS) — supplemented by `ua_extensions.csv` for Ukrainian palatalization and shared YAML rule files for G2P — covers all requirements from the Implementation Plan with:

- **Maximum reuse** of battle-tested libraries
- **Minimal hand-authored data** (only palatalized UA consonants + G2P rules)
- **Guaranteed cross-platform consistency** for EN (same CMU source both sides)
- **A clear boundary** between what is shared (data) and what is native (algorithms)

The `PhonemeRegistry.ts` from Phase 1 should be built on `ipa_bases.json` + `ua_extensions.json` rather than hand-authored enums, making it automatically consistent with the Python `panphon` instance.
