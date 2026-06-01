<template>
  <div class="mol-tab">
    <div class="mol-tab__scroll">
    <div v-if="!molstar" class="mol-tab__empty">
      <q-icon name="biotech" size="32px" color="grey-5" />
      <p class="mol-tab__empty-text">{{ $t('mol.noData') }}</p>
    </div>

    <template v-else>
      <!-- 3D structure viewer -->
      <div v-if="molstar.pdb" class="mol-tab__section">
        <div class="mol-tab__section-title">{{ $t('mol.viewer3d') }}</div>
        <Mol3DViewer :pdb="molstar.pdb" />
      </div>

      <!-- Interpretation summary -->
      <div v-if="molstar.interpretation?.length" class="mol-tab__section mol-tab__interpretation">
        <div class="mol-tab__section-title">{{ $t('mol.interpretation') }}</div>
        <ul class="mol-tab__interp-list">
          <li v-for="(line, i) in molstar.interpretation" :key="i">{{ line }}</li>
        </ul>
      </div>

      <!-- Sequence + secondary structure -->
      <div class="mol-tab__section">
        <div class="mol-tab__section-title">{{ $t('mol.structure') }}</div>
        <div class="mol-tab__chain">
          <div class="mol-tab__chain-row">
            <template v-for="(res, ri) in residues" :key="ri">
              <div
                class="mol-tab__res"
                :class="[`mol-tab__res--${res.ss}`]"
                :title="`${res.aa} — ${res.ipa}`"
              >
                <span class="mol-tab__res-aa">{{ res.aa }}</span>
                <span class="mol-tab__res-ipa">{{ res.ipa }}</span>
              </div>
            </template>
          </div>

          <!-- Secondary structure track -->
          <div class="mol-tab__ss-track">
            <template v-for="(seg, si) in ssSegments" :key="si">
              <div
                class="mol-tab__ss-seg"
                :class="`mol-tab__ss-seg--${seg.type}`"
                :style="{ width: `${seg.count * RES_W}px` }"
                :title="seg.type"
              />
            </template>
          </div>
        </div>
      </div>

      <!-- Lines: original aligned with IPA -->
      <div v-if="molstar.originalLines?.length" class="mol-tab__section">
        <div class="mol-tab__section-title">{{ $t('mol.lines') }}</div>
        <table class="mol-tab__lines-table">
          <tbody>
            <tr v-for="(orig, li) in molstar.originalLines" :key="li">
              <td class="mol-tab__line-num">{{ li + 1 }}</td>
              <td class="mol-tab__line-orig">{{ orig }}</td>
              <td class="mol-tab__line-ipa">{{ molstar.ipaLines?.[li] ?? '' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Contact map -->
      <div v-if="contacts.length" class="mol-tab__section">
        <div class="mol-tab__section-title">{{ $t('mol.contacts') }}</div>
        <div class="mol-tab__contact-wrap">
          <canvas ref="contactCanvasRef" class="mol-tab__contact-canvas" />
        </div>
      </div>

      <!-- Biophysical model note -->
      <div v-if="molstar.biophysicalModel?.modelName" class="mol-tab__section mol-tab__model-note">
        <q-icon name="info_outline" size="13px" color="grey-6" />
        {{ molstar.biophysicalModel.modelName }}
      </div>
    </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, nextTick } from 'vue';
import type { MolstarTranscription } from 'src/services/phonetic/analysisTypes';
import Mol3DViewer from 'src/components/Mol3DViewer.vue';

const props = defineProps<{
  molstar?: MolstarTranscription | null;
}>();

const RES_W = 24; // px per residue in chain view

// ── Residue list ──────────────────────────────────────────────────────────────

interface ResidueView {
  aa: string;
  ipa: string;
  ss: 'helix' | 'sheet' | 'coil';
}

function ssKindToClass(kind: string): 'helix' | 'sheet' | 'coil' {
  if (kind === 'helix') return 'helix';
  if (kind === 'sheet') return 'sheet';
  return 'coil';
}

/** Build a per-residue secondary-structure array from the segment list. */
function buildSsPerResidue(
  residueCount: number,
  segments: MolstarTranscription['secondaryStructure'],
): ('helix' | 'sheet' | 'coil')[] {
  const arr: ('helix' | 'sheet' | 'coil')[] = new Array(residueCount).fill('coil');
  for (const seg of segments) {
    const cls = ssKindToClass(seg.kind);
    for (let i = seg.startResidueIndex; i <= seg.endResidueIndex && i < residueCount; i++) {
      arr[i] = cls;
    }
  }
  return arr;
}

const residues = computed<ResidueView[]>(() => {
  const mol = props.molstar;
  if (!mol?.residueMap) return [];
  const ssArr = buildSsPerResidue(mol.residueMap.length, mol.secondaryStructure ?? []);
  return mol.residueMap.map((item, i) => ({
    aa: item.aminoAcid ?? '?',
    ipa: item.symbol ?? '',
    ss: ssArr[i] ?? 'coil',
  }));
});

// ── Secondary structure segments (run-length encoded) ─────────────────────────

interface SsSegment {
  type: 'helix' | 'sheet' | 'coil';
  count: number;
}

const ssSegments = computed<SsSegment[]>(() => {
  const segs: SsSegment[] = [];
  for (const res of residues.value) {
    const last = segs[segs.length - 1];
    if (last && last.type === res.ss) {
      last.count++;
    } else {
      segs.push({ type: res.ss, count: 1 });
    }
  }
  return segs;
});

// ── Contacts ──────────────────────────────────────────────────────────────────

const contacts = computed(() => props.molstar?.contacts ?? []);

// ── Contact map canvas ────────────────────────────────────────────────────────

const contactCanvasRef = ref<HTMLCanvasElement | null>(null);

function drawContactMap() {
  const canvas = contactCanvasRef.value;
  if (!canvas || !contacts.value.length) return;
  const n = residues.value.length;
  if (n === 0) return;
  const size = Math.max(120, Math.min(480, n * 6));
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#f8f8f8';
  ctx.fillRect(0, 0, size, size);
  const cell = size / n;
  ctx.fillStyle = 'rgba(80,120,200,0.7)';
  for (const c of contacts.value) {
    const i = c.fromResidueIndex;
    const j = c.toResidueIndex;
    if (i < 0 || j < 0 || i >= n || j >= n) continue;
    ctx.fillRect(i * cell, j * cell, Math.max(1, cell - 0.5), Math.max(1, cell - 0.5));
    ctx.fillRect(j * cell, i * cell, Math.max(1, cell - 0.5), Math.max(1, cell - 0.5));
  }
}

watch(
  () => [props.molstar, contactCanvasRef.value] as const,
  () => nextTick(drawContactMap),
  { immediate: true },
);
onMounted(() => nextTick(drawContactMap));
</script>

<style scoped lang="scss">
.mol-tab {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  &__scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 12px 16px;
    font-size: 13px;
    color: var(--q-dark, #222);
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200px;
    gap: 8px;
    opacity: 0.5;
  }

  &__empty-text {
    font-size: 12px;
    color: #888;
    margin: 0;
  }

  &__section {
    margin-bottom: 20px;
  }

  &__section-title {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: #888;
    margin-bottom: 8px;
  }

  &__interpretation {
    background: rgba(0, 0, 0, 0.02);
    border-left: 2px solid rgba(0, 0, 0, 0.12);
    padding: 8px 12px;
    border-radius: 0 4px 4px 0;
  }

  &__interp-list {
    margin: 0;
    padding-left: 16px;
    li {
      margin-bottom: 4px;
      font-size: 12px;
      line-height: 1.5;
    }
  }

  &__chain {
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow-x: auto;
  }

  &__chain-row {
    display: flex;
    flex-wrap: nowrap;
    gap: 1px;
  }

  &__res {
    width: 24px;
    min-width: 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    border-radius: 3px;
    padding: 2px 1px;
    cursor: default;
    font-size: 9px;

    &--helix {
      background: rgba(255, 100, 80, 0.18);
    }
    &--sheet {
      background: rgba(80, 140, 220, 0.18);
    }
    &--coil {
      background: rgba(0, 0, 0, 0.04);
    }
  }

  &__res-aa {
    font-weight: 700;
    font-size: 9px;
  }

  &__res-ipa {
    font-size: 7.5px;
    opacity: 0.6;
  }

  &__ss-track {
    display: flex;
    height: 8px;
    margin-top: 2px;
    border-radius: 2px;
    overflow: hidden;
  }

  &__ss-seg {
    height: 100%;
    &--helix {
      background: rgba(255, 100, 80, 0.55);
    }
    &--sheet {
      background: rgba(80, 140, 220, 0.55);
    }
    &--coil {
      background: rgba(0, 0, 0, 0.12);
    }
  }

  &__lines-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;

    td {
      padding: 3px 6px;
      vertical-align: top;
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    }
  }

  &__line-num {
    color: #aaa;
    width: 24px;
    text-align: right;
    font-size: 10px;
    user-select: none;
  }

  &__line-orig {
    width: 50%;
  }

  &__line-ipa {
    color: #666;
    font-family: 'Georgia', serif;
    font-size: 11px;
  }

  &__contact-wrap {
    overflow: auto;
  }

  &__contact-canvas {
    display: block;
    image-rendering: pixelated;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 3px;
  }

  &__model-note {
    font-size: 11px;
    color: #999;
    display: flex;
    align-items: center;
    gap: 4px;
  }
}
</style>
