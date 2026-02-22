<template>
  <div class="visualizer-container">
    <div class="visualizer-header">
      <h2>Analysis</h2>
    </div>

    <div class="visualizer-content">
      <div v-if="!poemText" class="empty-state">
        <q-icon name="description" size="3rem" color="grey-5" />
        <p>Enter poetry to see analysis</p>
      </div>

      <div v-else class="analysis-panel">
        <section class="analysis-section">
          <h3>Statistics</h3>
          <div class="stat-row">
            <span class="stat-label">Lines:</span>
            <span class="stat-value">{{ stats.lines }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Words:</span>
            <span class="stat-value">{{ stats.words }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Characters:</span>
            <span class="stat-value">{{ stats.characters }}</span>
          </div>
        </section>

        <section class="analysis-section">
          <h3>Content Preview</h3>
          <div class="preview-text">
            {{ poemText.substring(0, 200) }}<span v-if="poemText.length > 200">...</span>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  poemText: string;
}

const props = defineProps<Props>();

const stats = computed(() => {
  const text = props.poemText;
  return {
    lines: text.split('\n').filter((line) => line.trim().length > 0).length,
    words: text.split(/\s+/).filter((word) => word.length > 0).length,
    characters: text.length,
  };
});
</script>

<style scoped>
.visualizer-container {
  width: 50vw;
  height: 95vh;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: rgba(255, 255, 255, 0.9);
  padding: 1.5rem;
  box-shadow: -4px 0 6px rgba(0, 0, 0, 0.1);
}

body.body--dark .visualizer-container {
  background: rgba(30, 30, 30, 0.9);
}

.visualizer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.visualizer-header h2 {
  margin: 0;
  color: #1976d2;
  font-size: 1.5rem;
}

.visualizer-content {
  flex: 1;
  overflow-y: auto;
  padding-right: 0.5rem;
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
  gap: 2rem;
}

.analysis-section {
  padding-bottom: 1.5rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

body.body--dark .analysis-section {
  border-bottom-color: rgba(255, 255, 255, 0.1);
}

.analysis-section h3 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
  color: #1976d2;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  font-size: 0.95rem;
}

.stat-label {
  color: #666;
  font-weight: 500;
}

body.body--dark .stat-label {
  color: #aaa;
}

.stat-value {
  color: #1976d2;
  font-weight: 600;
  font-size: 1.1rem;
}

.preview-text {
  padding: 1rem;
  background: rgba(0, 0, 0, 0.03);
  border-left: 3px solid #1976d2;
  border-radius: 4px;
  font-size: 0.9rem;
  line-height: 1.6;
  color: #555;
  word-break: break-word;
}

body.body--dark .preview-text {
  background: rgba(255, 255, 255, 0.05);
  color: #ccc;
}

@media (max-width: 1200px) {
  .visualizer-container {
    width: 100vw;
  }
}
</style>
