<template>
  <span class="word-chip">{{ token.text }}</span>
</template>

<script setup lang="ts">
import type { IWordToken } from 'src/model/Token';

defineProps<{
  token: IWordToken;
}>();
</script>

<style scoped lang="scss">
.word-chip {
  display: inline;
  white-space: pre;
}
</style>
