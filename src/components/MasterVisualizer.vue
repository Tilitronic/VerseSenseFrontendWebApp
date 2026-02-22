<template>
  <div class="visualizer-container">
    <div class="visualizer-header">
      <h2>🔤 Phonetic Analysis</h2>
    </div>

    <div class="visualizer-content">
      <div v-if="!poemText" class="empty-state">
        <q-icon name="description" size="3rem" color="grey-5" />
        <p>Enter poetry to see analysis</p>
      </div>

      <div v-else class="analysis-panel">
        <!-- Compact Stats Header -->
        <div class="stats-header">
          <div class="stat-mini">
            <span class="label">Lines</span>
            <span class="value">{{ stats.lines }}</span>
          </div>
          <div class="stat-mini">
            <span class="label">Words</span>
            <span class="value">{{ stats.words }}</span>
          </div>
          <div class="stat-mini">
            <span class="label">Chars</span>
            <span class="value">{{ stats.characters }}</span>
          </div>
          <div class="stat-mini">
            <span class="label">Phonemes</span>
            <span class="value">{{ stats.totalPhonemes }}</span>
          </div>
        </div>

        <!-- Compact Transcription Section -->
        <div class="words-list">
          <div v-for="word in wordInstances" :key="word.getText()" class="word-card">
            <div class="word-header">
              <span class="word-text">{{ word.getText() }}</span>
              <div class="word-badges">
                <span
                  class="badge-tiny"
                  :class="{ vowel: word.startsWithVowel(), consonant: !word.startsWithVowel() }"
                >
                  {{ word.startsWithVowel() ? 'V' : 'C' }}
                </span>
                <span
                  class="badge-tiny"
                  :class="{ vowel: word.endsWithVowel(), consonant: !word.endsWithVowel() }"
                >
                  {{ word.endsWithVowel() ? 'V' : 'C' }}
                </span>
                <span class="badge-tiny">{{ word.getSyllableCount() }}</span>
              </div>
            </div>

            <div class="syllables-container">
              <div
                v-for="(syllable, sylIdx) in wordSyllables[word.getText()]"
                :key="`${word.getText()}-syl-${sylIdx}`"
                :class="['syllable-box', { stressed: syllable.stress, open: syllable.isOpen }]"
              >
                <div class="syllable-phonemes">
                  <div
                    v-for="(phoneme, idx) in syllable.phonemes"
                    :key="`${word.getText()}-${sylIdx}-${idx}`"
                    :class="[
                      'phoneme-cell',
                      { vowel: phoneme.phoneticType === 'vowel' },
                      { consonant: phoneme.phoneticType === 'consonant' },
                      { palatalized: phoneme.phoneticType === 'consonant' && phoneme.palatalized },
                    ]"
                    :title="phoneme.description"
                  >
                    <span class="phoneme-sym">{{ phoneme.symbol }}</span>
                    <span
                      v-if="phoneme.phoneticType === 'consonant' && phoneme.palatalized"
                      class="pal-mark"
                      >ʲ</span
                    >
                  </div>
                </div>
                <div class="syllable-info">
                  <span v-if="syllable.stress" class="stress-mark">´</span>
                  <span class="type-badge">{{ syllable.isOpen ? 'O' : 'C' }}</span>
                </div>
              </div>
            </div>

            <div class="word-stats">
              <span>V:{{ countPhonemeType(word.getText(), 'vowel') }}</span>
              <span>C:{{ countPhonemeType(word.getText(), 'consonant') }}</span>
              <span v-if="countPalatalized(word.getText()) > 0" class="pal-count"
                >P:{{ countPalatalized(word.getText()) }}</span
              >
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useUaPhoneticEngine } from 'src/services/poetryEngines/ua/uaPhoneticEngine';
import type { Phoneme } from 'src/services/poetryEngines/ua/Phonetizer';
import type { Syllable } from 'src/services/poetryEngines/ua/Sylabizer';
import { PhoneticTypes } from 'src/services/poetryEngines/ua/Phonetizer';

interface Props {
  poemText: string;
}

const props = defineProps<Props>();

const { wordInstances } = useUaPhoneticEngine({
  poemText: computed(() => props.poemText),
});

const stats = computed(() => {
  const text = props.poemText;
  const phonemeCount = wordInstances.value.reduce((sum, word) => {
    return sum + word.getPhonemes().length;
  }, 0);
  return {
    lines: text.split('\n').filter((line) => line.trim().length > 0).length,
    words: text.split(/\s+/).filter((word) => word.length > 0).length,
    characters: text.length,
    totalPhonemes: phonemeCount,
  };
});

const wordPhonemes = computed(() => {
  const cache: Record<string, Phoneme[]> = {};
  for (const word of wordInstances.value) {
    const wordText = word.getText();
    if (!cache[wordText]) {
      cache[wordText] = word.getPhonemes();
    }
  }
  return cache;
});

const wordSyllables = computed(() => {
  const cache: Record<string, Syllable[]> = {};
  for (const word of wordInstances.value) {
    const wordText = word.getText();
    if (!cache[wordText]) {
      cache[wordText] = word.getPhoneticSyllables();
    }
  }
  return cache;
});

const countPhonemeType = (wordText: string, type: string): number => {
  const phonemes = wordPhonemes.value[wordText] || [];
  return phonemes.filter((p) => {
    if (type === 'vowel') {
      return p.phoneticType === PhoneticTypes.VOWEL;
    } else if (type === 'consonant') {
      return p.phoneticType === PhoneticTypes.CONSONANT;
    }
    return false;
  }).length;
};

const countPalatalized = (wordText: string): number => {
  const phonemes = wordPhonemes.value[wordText] || [];
  return phonemes.filter((p) => {
    if (p.phoneticType === PhoneticTypes.CONSONANT) {
      const consonant = p as unknown as { palatalized: boolean };
      return consonant.palatalized === true;
    }
    return false;
  }).length;
};
</script>

<style scoped>
.visualizer-container {
  width: 50vw;
  height: 95vh;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.95);
  padding: 1rem;
  box-shadow: -4px 0 6px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

body.body--dark .visualizer-container {
  background: rgba(30, 30, 30, 0.95);
}

.visualizer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
  flex-shrink: 0;
}

.visualizer-header h2 {
  margin: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-size: 1.2rem;
  font-weight: 700;
}

body.body--dark .visualizer-header h2 {
  -webkit-text-fill-color: unset;
  background: none;
  color: #90caf9;
}

.visualizer-content {
  flex: 1;
  overflow-y: auto;
  padding-right: 0.3rem;
}

.visualizer-content::-webkit-scrollbar {
  width: 6px;
}

.visualizer-content::-webkit-scrollbar-track {
  background: transparent;
}

.visualizer-content::-webkit-scrollbar-thumb {
  background: #bbb;
  border-radius: 3px;
}

.visualizer-content::-webkit-scrollbar-thumb:hover {
  background: #888;
}

body.body--dark .visualizer-content::-webkit-scrollbar-thumb {
  background: #555;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
  text-align: center;
  gap: 1rem;
}

.empty-state p {
  margin: 0;
  font-size: 0.9rem;
}

.analysis-panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* Compact Stats Header */
.stats-header {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  padding: 0.75rem;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.08) 100%);
  border: 1px solid rgba(102, 126, 234, 0.15);
  border-radius: 8px;
}

body.body--dark .stats-header {
  background: rgba(102, 126, 234, 0.08);
  border-color: rgba(102, 126, 234, 0.25);
}

.stat-mini {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.stat-mini .label {
  font-size: 0.7rem;
  color: #666;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

body.body--dark .stat-mini .label {
  color: #aaa;
}

.stat-mini .value {
  font-size: 1.3rem;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Words List */
.words-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.word-card {
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(102, 126, 234, 0.15);
  border-radius: 6px;
  transition: all 0.2s ease;
}

.word-card:hover {
  border-color: rgba(102, 126, 234, 0.35);
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1);
}

body.body--dark .word-card {
  background: rgba(40, 40, 40, 0.85);
  border-color: rgba(102, 126, 234, 0.2);
}

body.body--dark .word-card:hover {
  background: rgba(50, 50, 50, 0.9);
  border-color: rgba(102, 126, 234, 0.3);
}

.word-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  gap: 0.5rem;
}

.word-text {
  font-size: 1rem;
  font-weight: 700;
  color: #667eea;
  min-width: 80px;
}

body.body--dark .word-text {
  color: #90caf9;
}

.word-badges {
  display: flex;
  gap: 0.3rem;
  flex-shrink: 0;
}

.badge-tiny {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  font-size: 0.7rem;
  font-weight: 700;
  border-radius: 4px;
  background: rgba(200, 200, 200, 0.3);
  color: #555;
  border: 1px solid rgba(100, 100, 100, 0.3);
}

body.body--dark .badge-tiny {
  color: #ddd;
  border-color: rgba(100, 100, 100, 0.5);
}

.badge-tiny.vowel {
  background: rgba(76, 175, 80, 0.2);
  border-color: rgba(76, 175, 80, 0.4);
  color: #2e7d32;
}

body.body--dark .badge-tiny.vowel {
  background: rgba(76, 175, 80, 0.25);
  border-color: rgba(76, 175, 80, 0.5);
  color: #81c784;
}

.badge-tiny.consonant {
  background: rgba(255, 152, 0, 0.15);
  border-color: rgba(255, 152, 0, 0.3);
  color: #e65100;
}

body.body--dark .badge-tiny.consonant {
  background: rgba(255, 152, 0, 0.2);
  border-color: rgba(255, 152, 0, 0.4);
  color: #ffb74d;
}

/* Phonemes Row */
.phonemes-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin: 0.5rem 0;
}

.phoneme-cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  width: 32px;
  height: 32px;
  font-size: 0.85rem;
  font-weight: 700;
  border-radius: 4px;
  background: rgba(200, 200, 200, 0.2);
  border: 1.5px solid rgba(100, 100, 100, 0.3);
  cursor: pointer;
  transition: all 0.15s ease;
  overflow: visible;
}

.phoneme-cell:hover {
  transform: scale(1.08);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.phoneme-cell.vowel {
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.25) 0%, rgba(76, 175, 80, 0.15) 100%);
  border-color: rgba(76, 175, 80, 0.5);
  color: #2e7d32;
}

body.body--dark .phoneme-cell.vowel {
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.3) 0%, rgba(76, 175, 80, 0.2) 100%);
  border-color: rgba(76, 175, 80, 0.6);
  color: #81c784;
}

.phoneme-cell.consonant {
  background: linear-gradient(135deg, rgba(255, 152, 0, 0.2) 0%, rgba(255, 152, 0, 0.1) 100%);
  border-color: rgba(255, 152, 0, 0.4);
  color: #e65100;
}

body.body--dark .phoneme-cell.consonant {
  background: linear-gradient(135deg, rgba(255, 152, 0, 0.25) 0%, rgba(255, 152, 0, 0.15) 100%);
  border-color: rgba(255, 152, 0, 0.5);
  color: #ffb74d;
}

.phoneme-cell.palatalized {
  background: linear-gradient(
    135deg,
    rgba(233, 30, 99, 0.3) 0%,
    rgba(233, 30, 99, 0.15) 100%
  ) !important;
  border: 2px solid rgba(233, 30, 99, 0.7) !important;
  border-radius: 3px;
  color: #c2185b !important;
  font-weight: 800;
  box-shadow:
    0 0 8px rgba(233, 30, 99, 0.4),
    inset 0 0 8px rgba(233, 30, 99, 0.2);
}

body.body--dark .phoneme-cell.palatalized {
  background: linear-gradient(
    135deg,
    rgba(233, 30, 99, 0.4) 0%,
    rgba(233, 30, 99, 0.2) 100%
  ) !important;
  border: 2px solid rgba(233, 30, 99, 0.8) !important;
  color: #f06292 !important;
  box-shadow:
    0 0 12px rgba(233, 30, 99, 0.6),
    inset 0 0 8px rgba(233, 30, 99, 0.3);
}

.phoneme-sym {
  font-weight: 700;
  position: relative;
  z-index: 1;
}

.pal-mark {
  position: absolute;
  bottom: -6px;
  right: -6px;
  font-size: 0.7rem;
  font-weight: 800;
  background: linear-gradient(135deg, #d81b60 0%, #c2185b 100%);
  color: white;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 2px solid #fff;
  line-height: 1;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

/* Syllables Container */
.syllables-container {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin: 0.5rem 0;
  padding: 0.3rem 0;
}

.syllable-box {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 0.4rem;
  border-radius: 6px;
  border: 2px solid rgba(100, 100, 100, 0.3);
  background: rgba(100, 150, 200, 0.08);
  transition: all 0.2s ease;
  position: relative;
}

.syllable-box:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  border-color: rgba(100, 100, 100, 0.5);
}

.syllable-box.stressed {
  border: 2px solid rgba(233, 30, 99, 0.6);
  border-width: 2.5px;
  background: rgba(233, 30, 99, 0.1);
  box-shadow: 0 0 8px rgba(233, 30, 99, 0.2);
}

.syllable-box.open {
  border-style: dashed;
  border-color: rgba(76, 175, 80, 0.5);
}

.syllable-phonemes {
  display: flex;
  gap: 0.2rem;
  flex-wrap: wrap;
}

.syllable-info {
  display: flex;
  gap: 0.3rem;
  justify-content: flex-end;
  align-items: center;
  font-size: 0.7rem;
  opacity: 0.7;
}

.stress-mark {
  font-weight: 700;
  color: #d81b60;
  font-size: 0.9rem;
  line-height: 1;
}

.type-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  font-size: 0.65rem;
  font-weight: 700;
  border-radius: 3px;
  background: rgba(100, 100, 100, 0.2);
  color: #666;
}

body.body--dark .syllable-box {
  background: rgba(100, 150, 200, 0.12);
  border-color: rgba(150, 150, 150, 0.4);
}

body.body--dark .syllable-box.stressed {
  border-color: rgba(233, 30, 99, 0.7);
  background: rgba(233, 30, 99, 0.15);
}

body.body--dark .type-badge {
  color: #aaa;
}

/* Word Stats */
.word-stats {
  display: flex;
  gap: 0.75rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  padding-top: 0.4rem;
  border-top: 1px solid rgba(102, 126, 234, 0.08);
}

body.body--dark .word-stats {
  color: #aaa;
  border-color: rgba(102, 126, 234, 0.15);
}

.word-stats span {
  display: inline-block;
  padding: 0.2rem 0.4rem;
  background: rgba(102, 126, 234, 0.08);
  border-radius: 3px;
}

body.body--dark .word-stats span {
  background: rgba(102, 126, 234, 0.15);
}

.pal-count {
  background: rgba(233, 30, 99, 0.15) !important;
  color: #c2185b !important;
}

body.body--dark .pal-count {
  background: rgba(233, 30, 99, 0.25) !important;
  color: #f06292 !important;
}

@media (max-width: 1200px) {
  .visualizer-container {
    width: 100vw;
  }

  .stats-header {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .visualizer-container {
    padding: 0.75rem;
    gap: 0.4rem;
  }

  .visualizer-header h2 {
    font-size: 1rem;
  }

  .stats-header {
    grid-template-columns: 1fr;
    gap: 0.4rem;
  }

  .stat-mini {
    flex-direction: row;
    justify-content: space-between;
    padding: 0.25rem 0.5rem;
  }

  .word-card {
    padding: 0.5rem;
  }

  .phoneme-cell {
    width: 28px;
    height: 28px;
    font-size: 0.75rem;
  }

  .word-text {
    font-size: 0.9rem;
  }

  .word-stats {
    font-size: 0.65rem;
    gap: 0.5rem;
  }
}
</style>
