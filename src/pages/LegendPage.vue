<template>
  <div class="legend-page">
    <LegendPanel />
  </div>
</template>

<script setup lang="ts">
import LegendPanel from 'src/components/LegendPanel.vue';
</script>

<style scoped>
.legend-page {
  min-height: 100vh;
  background: #f4f4f6;
  overflow-y: auto;
}
</style>
