<template>
  <span class="lang-flag" aria-hidden="true">
    <!-- Ukraine: blue over yellow -->
    <svg
      v-if="lang === 'uk'"
      width="20"
      height="14"
      viewBox="0 0 3 2"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="3" height="1" fill="#005BBB" />
      <rect y="1" width="3" height="1" fill="#FFD500" />
    </svg>

    <!-- Poland: white over red -->
    <svg
      v-else-if="lang === 'pl'"
      width="20"
      height="14"
      viewBox="0 0 3 2"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="3" height="1" fill="#fff" />
      <rect y="1" width="3" height="1" fill="#DC143C" />
    </svg>

    <!-- Belarus: white-red-white (democratic opposition flag) -->
    <svg
      v-else-if="lang === 'be'"
      width="20"
      height="14"
      viewBox="0 0 3 2"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="3" height="0.667" fill="#fff" />
      <rect y="0.667" width="3" height="0.666" fill="#CF101A" />
      <rect y="1.333" width="3" height="0.667" fill="#fff" />
    </svg>

    <!-- UK: Union Jack (simplified) -->
    <svg v-else width="20" height="14" viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg">
      <rect width="60" height="40" fill="#012169" />
      <path d="M0,0 L60,40 M60,0 L0,40" stroke="#fff" stroke-width="8" />
      <path d="M0,0 L60,40 M60,0 L0,40" stroke="#C8102E" stroke-width="4.5" />
      <path d="M30,0 V40 M0,20 H60" stroke="#fff" stroke-width="13" />
      <path d="M30,0 V40 M0,20 H60" stroke="#C8102E" stroke-width="8" />
    </svg>
  </span>
</template>

<script setup lang="ts">
import type { MessageLanguages } from 'src/boot/i18n';

defineProps<{ lang: MessageLanguages }>();
</script>

<style scoped>
.lang-flag {
  display: inline-flex;
  align-items: center;
  line-height: 1;
  border-radius: 2px;
  overflow: hidden;
  flex-shrink: 0;

  svg {
    display: block;
    border-radius: 2px;
  }
}
</style>
