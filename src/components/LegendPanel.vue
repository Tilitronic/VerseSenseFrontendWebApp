<template>
  <div class="lp-root">
    <h2 class="lp-title">Legend</h2>
    <p class="lp-subtitle">Drawn directly from the phonetic engine — always in sync.</p>

    <!-- ── Consonant palette ──────────────────────────────────────────────── -->
    <section class="lp-section">
      <h3 class="lp-section__title">Sound groups (consonants)</h3>
      <div class="lp-grid">
        <div v-for="g in PSYCHO_GROUP_INFO" :key="g.id" class="lp-item">
          <span class="lp-swatch lp-swatch--consonant" :style="{ background: g.cssColor }" />
          <span class="lp-item__body">
            <span class="lp-item__label">{{ g.labelEn }}</span>
            <span class="lp-item__desc">{{ g.descriptionEn }}</span>
            <span class="lp-item__ex">{{ g.examplesIpa.join(' ') }}</span>
          </span>
        </div>
      </div>
    </section>

    <!-- ── Vowel palette ──────────────────────────────────────────────────── -->
    <section class="lp-section">
      <h3 class="lp-section__title">Vowels</h3>
      <div class="lp-grid">
        <div v-for="g in VOWEL_GROUP_INFO" :key="g.labelEn" class="lp-item">
          <span class="lp-swatch lp-swatch--vowel" :style="{ background: g.cssColor }" />
          <span class="lp-item__body">
            <span class="lp-item__label">{{ g.labelEn }}</span>
            <span class="lp-item__desc">{{ g.descriptionEn }}</span>
            <span class="lp-item__ex">{{ g.examplesIpa.join(' ') }}</span>
          </span>
        </div>
      </div>
    </section>

    <!-- ── Ribbon shape key ───────────────────────────────────────────────── -->
    <section class="lp-section">
      <h3 class="lp-section__title">Ribbon shape (manner of articulation)</h3>
      <div class="lp-shapes">
        <div v-for="s in SHAPE_EXAMPLES" :key="s.label" class="lp-shape-item">
          <div class="lp-cell-ex">
            <div class="lp-ribbon" :style="{ borderRadius: s.radius, height: s.height }" />
          </div>
          <span class="lp-shape-item__label">{{ s.label }}</span>
        </div>
      </div>
    </section>

    <!-- ── Cell type key ─────────────────────────────────────────────────── -->
    <section class="lp-section">
      <h3 class="lp-section__title">Cell types</h3>
      <div class="lp-cells-row">
        <div v-for="c in CELL_EXAMPLES" :key="c.label" class="lp-celltype">
          <div
            class="lp-cell-ex"
            :class="{
              'lp-cell-ex--stressed': c.stressed,
              'lp-cell-ex--tab': c.tab,
              'lp-cell-ex--word-last': c.wordLast,
            }"
          />
          <span class="lp-celltype__label">{{ c.label }}</span>
        </div>
      </div>
    </section>

    <!-- ── Row badges ────────────────────────────────────────────────────── -->
    <section class="lp-section">
      <h3 class="lp-section__title">Row badges</h3>
      <div class="lp-badges-row">
        <div class="lp-badge-item">
          <span class="lp-badge lp-badge--sq">3</span>
          <span class="lp-badge-item__label">Row number</span>
        </div>
        <div class="lp-badge-item">
          <span class="lp-badge lp-badge--ci">7</span>
          <span class="lp-badge-item__label">Syllable count</span>
        </div>
        <div class="lp-badge-item">
          <span class="lp-badge lp-badge--tr">2</span>
          <span class="lp-badge-item__label">C:V ratio</span>
        </div>
      </div>
      <p class="lp-note" style="margin-top: 8px">
        C:V ratio = consonants ÷ vowels in the line. A value of 2 means two consonants per vowel.
        ∞ indicates a line with no vowels.
      </p>
    </section>

    <!-- ── Pattern opacity ───────────────────────────────────────────────── -->
    <section class="lp-section">
      <h3 class="lp-section__title">Sound pattern highlighting</h3>
      <p class="lp-note">
        Ribbon colour saturation reflects how densely a sound repeats in the text: the brighter the
        colour, the closer together its other occurrences. Only sounds appearing ≥&thinsp;3 times
        are highlighted.
      </p>
      <div class="lp-opacity-ex">
        <div v-for="step in OPACITY_STEPS" :key="step.label" class="lp-opacity-item">
          <div class="lp-op-swatch" :style="{ background: `rgba(105,175,52,${step.alpha})` }" />
          <span class="lp-opacity-item__label">{{ step.label }}</span>
        </div>
        <span class="lp-opacity-arrow">→ more frequent</span>
      </div>
    </section>

    <!-- ── Demo notice ───────────────────────────────────────────────────── -->
    <div class="lp-demo-notice">
      <span class="lp-demo-notice__badge">Demo</span>
      <span class="lp-demo-notice__text">
        This is a demo version and may contain inaccuracies in transcription, syllabification, and
        pattern analysis. Results should not be used as academic sources.
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PSYCHO_GROUP_INFO, VOWEL_GROUP_INFO } from 'src/services/phonetic/ipaColorMap';

const SHAPE_EXAMPLES = [
  { label: 'Stops (p, b, t, d, k)', radius: '2px', height: '76%' },
  { label: 'Affricates (ts, tʃ, dʒ)', radius: '4px', height: '70%' },
  { label: 'Fricatives (s, ʃ, f, x)', radius: '8px', height: '64%' },
  { label: 'Sonorants / nasals (l, r, m, n)', radius: '999px', height: '80%' },
] as const;

const CELL_EXAMPLES = [
  { label: 'Unstressed syllable', stressed: false, tab: false, wordLast: false },
  { label: 'Stressed syllable', stressed: true, tab: false, wordLast: false },
  { label: 'Last syllable of word', stressed: false, tab: false, wordLast: true },
  { label: 'Indent (tab)', stressed: false, tab: true, wordLast: false },
] as const;

const OPACITY_STEPS = [
  { label: 'rare', alpha: 0.12 },
  { label: '', alpha: 0.28 },
  { label: '', alpha: 0.5 },
  { label: '', alpha: 0.72 },
  { label: 'dense', alpha: 1.0 },
] as const;
</script>

<style scoped lang="scss">
$bg: #f4f4f6;
$card: #ffffff;
$border: rgba(0, 0, 0, 0.1);
$text: #1a1a2e;
$sub: #555;
$cell-w: 44px;
$cell-h: 32px;
$border-col: #000;

.lp-root {
  background: $bg;
  color: $text;
  font-family: system-ui, 'Helvetica Neue', Arial, sans-serif;
  padding: 24px 28px 32px;
  max-width: 860px;
  margin: 0 auto;
  box-sizing: border-box;
}

.lp-title {
  margin: 0 0 4px;
  font-size: 1.4rem;
  font-weight: 700;
  color: #1a1a2e;
}

.lp-subtitle {
  margin: 0 0 24px;
  font-size: 0.8rem;
  color: $sub;
}

.lp-section {
  margin-bottom: 28px;

  &__title {
    margin: 0 0 12px;
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: $sub;
    border-bottom: 1px solid $border;
    padding-bottom: 6px;
  }
}

// ── Colour grid ───────────────────────────────────────────────────────────────

.lp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px 12px;
}

.lp-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.lp-swatch {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  margin-top: 2px;
  border-radius: 3px;

  &--vowel {
    border-radius: 50% 50% 3px 3px;
  }
}

.lp-item__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.lp-item__label {
  font-size: 0.82rem;
  font-weight: 600;
  color: $text;
  line-height: 1.3;
}

.lp-item__desc {
  font-size: 0.72rem;
  color: $sub;
  line-height: 1.3;
}

.lp-item__ex {
  font-family: 'Georgia', 'Noto Serif', serif;
  font-size: 0.78rem;
  color: #888;
  letter-spacing: 0.1em;
}

// ── Ribbon shapes ─────────────────────────────────────────────────────────────

.lp-shapes {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: flex-end;
}

.lp-shape-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;

  &__label {
    font-size: 0.7rem;
    color: $sub;
    text-align: center;
    max-width: 110px;
  }
}

// ── Cell examples ─────────────────────────────────────────────────────────────

.lp-cell-ex {
  width: $cell-w;
  height: $cell-h;
  border: 1px solid $border-col;
  background: $card;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &--stressed {
    background: #c8c8c8;
  }

  &--tab {
    background: rgba(0, 0, 0, 0.02);
    border-style: dashed;
    border-color: rgba(0, 0, 0, 0.3);
  }

  &--word-last {
    border-right: 3px solid $border-col;
  }
}

// Ribbon shown inside shape examples
.lp-ribbon {
  position: relative;
  background: rgba(0, 0, 0, 0.22);
  width: calc(100% - 8px);
  transition: none;
}

.lp-cells-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px 24px;
}

.lp-celltype {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;

  &__label {
    font-size: 0.7rem;
    color: $sub;
    text-align: center;
    max-width: 120px;
  }
}

// ── Opacity ramp ──────────────────────────────────────────────────────────────

.lp-opacity-ex {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.lp-opacity-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;

  &__label {
    font-size: 0.65rem;
    color: $sub;
    min-width: 36px;
    text-align: center;
  }
}

.lp-op-swatch {
  width: 32px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.lp-opacity-arrow {
  font-size: 0.72rem;
  color: $sub;
  margin-left: 4px;
}

// ── Row badges ────────────────────────────────────────────────────────────────

.lp-badges-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px 24px;
  margin-bottom: 6px;
}

.lp-badge-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;

  &__label {
    font-size: 0.7rem;
    color: $sub;
    text-align: center;
  }
}

.lp-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  font-size: 0.78rem;
  font-weight: 700;
  color: #fff;
  background: $border-col;

  &--sq {
    border-radius: 4px;
  }

  &--ci {
    border-radius: 50%;
  }

  &--tr {
    clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
  }
}

// ── Note ──────────────────────────────────────────────────────────────────────

.lp-note {
  margin: 0;
  font-size: 0.8rem;
  color: $sub;
  line-height: 1.55;
}

// ── Demo notice ───────────────────────────────────────────────────────────────

.lp-demo-notice {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 8px;
  padding: 12px 14px;
  background: rgba(180, 30, 30, 0.05);
  border: 1px solid rgba(180, 30, 30, 0.2);
  border-radius: 6px;

  &__badge {
    flex-shrink: 0;
    font-size: 0.6rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(180, 30, 30, 0.8);
    border: 1px solid rgba(180, 30, 30, 0.35);
    border-radius: 3px;
    padding: 2px 5px;
    margin-top: 1px;
  }

  &__text {
    font-size: 0.78rem;
    color: rgba(100, 0, 0, 0.7);
    line-height: 1.5;
  }
}
</style>
