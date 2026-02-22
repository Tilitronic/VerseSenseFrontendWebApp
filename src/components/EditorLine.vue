<template>
  <div class="editor-line" :class="{ 'editor-line--empty': line.tokens.length === 0 }">
    <!-- Empty line → non-breaking spacer to preserve height -->
    <template v-if="line.tokens.length === 0">
      <span class="editor-line__spacer">&nbsp;</span>
    </template>

    <template v-else>
      <template v-for="token in line.tokens" :key="token.id">
        <!-- TAB indent -->
        <span v-if="token.kind === 'TAB'" class="editor-line__tab" />

        <!-- GAP between words -->
        <span v-else-if="token.kind === 'GAP'" class="editor-line__gap"> </span>

        <!-- WORD -->
        <WordChip
          v-else-if="token.kind === 'WORD'"
          :token="token"
        />
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import WordChip from './WordChip.vue';
import type { ILine } from 'src/model/Token';

defineProps<{
  line: ILine;
}>();
</script>

<style scoped lang="scss">
.editor-line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  min-height: 2rem;
  padding: 1px 0;

  &__spacer {
    display: block;
    height: 1.6rem;
  }

  &__gap {
    display: inline-block;
    width: 0.35em;
  }

  &__tab {
    display: inline-block;
    width: 2.5rem;
  }
}
</style>
