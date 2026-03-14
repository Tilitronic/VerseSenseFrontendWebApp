<template>
  <div class="wcm" @mouseenter="$emit('mouseenter')" @mouseleave="$emit('mouseleave')">
    <!-- ── Step 1: Language picker ── -->
    <template v-if="step === 'language'">
      <div class="wcm__header">Language</div>
      <div class="wcm__lang-grid">
        <button
          v-for="lang in LANGUAGES"
          :key="lang"
          class="wcm__lang-btn"
          :class="{ 'wcm__lang-btn--active': token.language === lang }"
          @click="onPickLanguage(lang)"
        >
          <span class="wcm__lang-flag">{{ LANGUAGE_META[lang].flag }}</span>
          <span class="wcm__lang-label">{{ LANGUAGE_META[lang].label }}</span>
        </button>
      </div>
      <div class="wcm__divider" />
      <button class="wcm__action-btn" @click="step = 'stress'">Set stress →</button>
      <button
        v-if="hasOverride"
        class="wcm__action-btn wcm__action-btn--reset"
        @click="$emit('clear-language')"
      >
        Reset to document language
      </button>
    </template>

    <!-- ── Step 2: Stress picker ── -->
    <template v-else-if="step === 'stress'">
      <div class="wcm__header">
        <button class="wcm__back-btn" @click="step = 'language'">←</button>
        Stress syllable
      </div>

      <div v-if="syllables.length === 0" class="wcm__no-syllables">
        No syllable data for this word.
      </div>
      <div v-else class="wcm__syllable-row">
        <button
          v-for="(syl, idx) in syllables"
          :key="idx"
          class="wcm__syl-btn"
          :class="{ 'wcm__syl-btn--active': token.stressIndex === idx }"
          @click="onPickStress(idx)"
        >
          {{ syl.phonetic || `s${idx + 1}` }}
        </button>
        <button
          class="wcm__syl-btn wcm__syl-btn--clear"
          :class="{ 'wcm__syl-btn--active': token.stressIndex === null }"
          @click="onPickStress(null)"
        >
          ✕
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { LANGUAGES, LANGUAGE_META, type Language } from 'src/model/Language';
import type { IWordToken } from 'src/model/Token';
import { usePoetryStore } from 'src/stores/poetry';

const props = defineProps<{
  token: IWordToken;
  hasOverride?: boolean;
}>();

const emit = defineEmits<{
  (e: 'set-language', lang: Language): void;
  (e: 'clear-language'): void;
  (e: 'set-stress', syllableIdx: number | null): void;
  (e: 'close'): void;
  (e: 'mouseenter'): void;
  (e: 'mouseleave'): void;
}>();

const store = usePoetryStore();
const step = ref<'language' | 'stress'>('language');

const syllables = computed(() => store.getSyllables(props.token.id));

function onPickLanguage(lang: Language) {
  emit('set-language', lang);
  emit('close');
}

function onPickStress(idx: number | null) {
  emit('set-stress', idx);
  emit('close');
}
</script>

<style scoped lang="scss">
.wcm {
  position: absolute;
  top: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  min-width: 180px;
  background: #1e1e2e;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  padding: 6px 0;
  user-select: none;

  &__header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.4);
    padding: 4px 12px 6px;
  }

  &__back-btn {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.55);
    cursor: pointer;
    padding: 0 4px;
    font-size: 1rem;
    line-height: 1;

    &:hover {
      color: #fff;
    }
  }

  &__lang-grid {
    display: flex;
    flex-direction: column;
  }

  &__lang-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    text-align: left;
    font-size: 0.88rem;
    transition: background 0.1s;

    &:hover {
      background: rgba(255, 255, 255, 0.06);
    }
    &--active {
      background: rgba(100, 180, 255, 0.15);
      color: #fff;
    }
  }

  &__lang-flag {
    font-size: 1.1rem;
  }
  &__lang-label {
    font-size: 0.82rem;
  }

  &__divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
    margin: 4px 0;
  }

  &__action-btn {
    display: block;
    width: 100%;
    padding: 6px 14px;
    background: none;
    border: none;
    color: rgba(100, 180, 255, 0.9);
    cursor: pointer;
    text-align: left;
    font-size: 0.82rem;
    transition: background 0.1s;

    &:hover {
      background: rgba(255, 255, 255, 0.06);
    }
    &--reset {
      color: rgba(255, 120, 120, 0.8);
    }
  }

  &__syllable-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 6px 12px 8px;
  }

  &__syl-btn {
    padding: 4px 10px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    font-size: 0.9rem;
    font-family: 'Noto Serif', serif;
    transition:
      background 0.1s,
      border-color 0.1s;

    &:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    &--active {
      background: rgba(100, 180, 255, 0.25);
      border-color: rgba(100, 180, 255, 0.5);
      color: #fff;
    }
    &--clear {
      border-color: rgba(255, 100, 100, 0.25);
      color: rgba(255, 100, 100, 0.6);
      &:hover {
        background: rgba(255, 100, 100, 0.1);
      }
    }
  }

  &__no-syllables {
    padding: 6px 14px;
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.35);
    font-style: italic;
  }
}
</style>
