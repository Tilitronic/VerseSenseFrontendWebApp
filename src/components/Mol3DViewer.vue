<template>
  <div ref="containerRef" class="mol-3d" />
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';

const props = defineProps<{
  pdb?: string | null;
}>();

const containerRef = ref<HTMLElement | null>(null);

// Typed loosely to avoid NGL @types issues at compile time
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let stage: any = null;
let resizeObs: ResizeObserver | null = null;

async function loadPdb(pdb: string) {
  if (!stage) return;
  stage.removeAllComponents();
  const blob = new Blob([pdb], { type: 'text/plain' });
  // NGL accepts Blob for loadFile; ext tells it the format
  const comp = await stage.loadFile(blob, { ext: 'pdb', name: 'poem' });
  comp.addRepresentation('cartoon', {
    colorScheme: 'residueindex',
    colorScale: 'rainbow',
    aspectRatio: 3,
    scale: 0.7,
    opacity: 0.92,
  });
  comp.autoView(500);
}

async function init() {
  if (!containerRef.value) return;
  // Dynamic import keeps NGL out of the initial bundle
  const { Stage } = await import('ngl');
  stage = new Stage(containerRef.value, {
    backgroundColor: '#0d0d1a',
    ambientColor: 0xffffff,
    ambientIntensity: 0.5,
    lightColor: 0xffffff,
    lightIntensity: 0.8,
  });

  // Keep the NGL canvas in sync with container resizes
  resizeObs = new ResizeObserver(() => {
    stage?.handleResize();
  });
  resizeObs.observe(containerRef.value);

  if (props.pdb) {
    await nextTick();
    await loadPdb(props.pdb);
  }
}

watch(
  () => props.pdb,
  async (pdb) => {
    if (pdb) await loadPdb(pdb);
    else stage?.removeAllComponents();
  },
);

onMounted(init);
onBeforeUnmount(() => {
  resizeObs?.disconnect();
  resizeObs = null;
  stage?.dispose();
  stage = null;
});
</script>

<style scoped lang="scss">
.mol-3d {
  width: 100%;
  height: 380px;
  border-radius: 6px;
  overflow: hidden;
  background: #0d0d1a;
  cursor: grab;

  &:active {
    cursor: grabbing;
  }

  // NGL injects a <canvas> directly — make sure it fills the container
  :deep(canvas) {
    display: block;
    width: 100% !important;
    height: 100% !important;
  }
}
</style>
