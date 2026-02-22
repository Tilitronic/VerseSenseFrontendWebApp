This is a sophisticated architectural challenge. We are moving from a simple "text display" to a **Phonetic Relationship Engine**. By treating phonemes as classes with inherited properties, we can treat the poem as a biological-like structure where "DNA" (phonetic features) determines the "Phenotype" (colors and connections).

Since you are using **Quasar (Vue 3)**, we will integrate a **Canvas-based Renderer** into the main layout.

---

## 1. Project Architecture: "The Phonos Engine"

The system is divided into three layers:

### A. The Data Model (Phonetic Taxonomy)

We define a hierarchy where similarity is calculated based on shared features (e.g., "p" and "b" share the same place and manner, differing only in voicing).

* **Class `Phoneme**`:
* `symbol` (IPA string)
* `type` (Vowel / Consonant)
* `features`: (Voicing, Place of Articulation, Manner of Articulation for consonants; Height, Backness, Roundness for vowels).
* `getSimilarity(otherPhoneme)`: Returns 0.0–1.0.


* **Class `Syllable**`:
* `phonemes`: Array of `Phoneme` objects.
* `isStressed`: Boolean.
* `text`: Original text (e.g., "Дуп").
* `wordId`: UUID to identify word boundaries.


* **Class `TypoSymbol**`:
* `kind`: `NEWLINE` | `TAB` | `WORD_GAP`.



### B. The Logic Engine (Enrichment Processor)

Before rendering, a processor iterates through the `Sequence` to:

1. **Map Rhyme Groups**: Identify syllables at the end of lines, compare their phonetic "tails," and assign a `rhymeGroupId`.
2. **Calculate Similarity Scores**: For each `rhymeGroupId`, calculate the % of phonetic match to the "parent" rhyme.
3. **Coordinate Mapping**: Convert `Newline`, `Tab`, and `Syllable` objects into a fixed  grid coordinate system.

### C. The Visual Layer (Quasar + p5.js/Canvas)

A Vue component (`PhoneticCanvas.vue`) that receives the processed objects and draws them.

---

## 2. Technical Specification for Implementation

### I. Phonetic Feature Matrix (The Logic)

To calculate the  or  similarity you mentioned, we use a weighted feature set.

**Example: Consonant Similarity Logic**

```javascript
// Feature weights
const weights = { place: 0.4, manner: 0.4, voicing: 0.2 };

// Comparison: 'p' (voiceless bilabial plosive) vs 'b' (voiced bilabial plosive)
// Result: 1.0 (place) + 1.0 (manner) + 0.0 (voicing) = 0.8 Similarity.

```

### II. Syllable & Symbol Classes

```javascript
class Symbol {
  constructor(type) { this.type = type; }
}

class Syllable extends Symbol {
  constructor(text, ipa, isStressed, wordId) {
    super('SYLLABLE');
    this.text = text;
    this.phonemes = this.parseIPA(ipa); // Returns array of Phoneme objects
    this.isStressed = isStressed;
    this.wordId = wordId;
    this.rhymeId = null; 
    this.similarityScore = 1.0;
  }
}

class TypoSymbol extends Symbol {
  constructor(kind) {
    super('TYPO');
    this.kind = kind; // 'NL', 'TAB', 'GAP'
  }
}

```

### III. The Rendering Logic (The "Web")

To create the **"spider-web"** effect without overwhelming the UI:

1. **Filter**: The user selects a phoneme (e.g., the sound **/r/**).
2. **Scan**: The engine finds all `Syllable` objects containing that phoneme.
3. **Connect**: Draw a `quadraticCurveTo` between the center of cell  and cell .
4. **Visual**: Use a gradient stroke that is brighter in the middle of the line to simulate a "glowing thread."

---

## 3. Quasar Integration Plan

### Left Panel: Configuration & Input

* **Editor**: A JSON/YAML editor where you define the sequence of symbols.
* **Controls**: Sliders for `CellSize`, `GapWidth`, and `SimilarityThreshold`.
* **Phoneme Toggles**: A checklist of all phonemes present in the poem. Toggling "s" draws the web for all "s" sounds.

### Right Panel: The Visualization (The "Engine")

* **Canvas Component**: A high-DPI canvas.
* **Draw Loop**:
* **Background**: Dark matte (#121212).
* **Typo Logic**: If `TypoSymbol === 'GAP'`, draw a 2px vertical black line between cells.
* **Rhyme Logic**:
* `Fill = HSL(rhymeGroupHue, similarity * 100%, 50%)`.
* `Border = isStressed ? Yellow : Transparent`.


* **Layering**: Lines (webs) are drawn *underneath* the text but *above* the cell background for depth.



---

## 4. Next Step for the AI Assistant

To start coding this, you need the **"Phoneme Property Map"**. This is a dictionary of every IPA sound in your poem (English, Ukrainian, Polish) with its linguistic features.

**Would you like me to generate the JSON Property Map for the phonemes present in your poem so you can plug it into your Syllable class?** (I will include the voicing, place, and manner for the specific sounds like *p, b, t, d, ʐ, ɲ, etc.*)