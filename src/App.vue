<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

onMounted(async () => {
  // Remove the splash as soon as the first route is ready to paint.
  // Heavy services and the visualization panel load asynchronously afterward.
  await router.isReady();

  // One extra tick so Vue flushes the route component render to the DOM
  // before we pull the splash — no flash of empty content.
  await nextTick();

  const splash = document.getElementById('q-splash');
  if (!splash) return;
  splash.classList.add('q-splash--out');
  splash.addEventListener('transitionend', () => splash.remove(), { once: true });
});
</script>
