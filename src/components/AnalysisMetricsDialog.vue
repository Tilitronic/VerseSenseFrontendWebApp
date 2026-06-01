<template>
  <q-dialog v-model="open" class="metrics-dlg">
    <q-card class="metrics-card">
      <!-- ── Header ──────────────────────────────────────────────────── -->
      <div class="metrics-card__header">
        <div class="metrics-card__title">
          <q-icon name="analytics" size="16px" class="q-mr-xs" />
          {{ $t('metrics.title') }}
        </div>
        <div v-if="result" class="metrics-card__engine">
          {{ result.analyzer.name }} · v{{ result.analyzer.version }}
        </div>
        <q-btn flat dense round icon="close" color="grey-6" size="sm" @click="open = false" />
      </div>

      <!-- ── Body ───────────────────────────────────────────────────── -->
      <div class="metrics-card__body">
        <!-- No data -->
        <div v-if="!result" class="metrics-card__empty">
          <q-icon name="pending_actions" size="28px" color="grey-6" />
          <p>{{ $t('metrics.noData') }}</p>
        </div>

        <template v-else>
          <!-- ── Global score ───────────────────────────────────────── -->
          <div class="ms">
            <div class="ms__label">{{ $t('metrics.globalScore') }}</div>
            <div class="ms__global">
              <div class="ms__ring" :style="ringStyle">
                <span class="ms__ring-num">{{ pctDisplay(result.structurality.global) }}</span>
                <span class="ms__ring-sub">structurality</span>
              </div>
              <div class="ms__global-interp">
                <div class="ms__global-row">
                  <span class="ms__global-key">{{ $t('metrics.model') }}</span>
                  <span class="ms__global-val">{{ result.structurality.interdependencyModel }}</span>
                </div>
                <div class="ms__global-row ms__global-row--score" :class="scoreClass(result.structurality.global)">
                  {{ globalVerdict(result.structurality.global) }}
                </div>
              </div>
            </div>
          </div>

          <!-- ── Per-plane scores ──────────────────────────────────── -->
          <div class="ms">
            <div class="ms__label">{{ $t('metrics.planes') }}</div>
            <div class="ms__planes">
              <div v-for="plane in planes" :key="plane.key" class="ms__plane">
                <div class="ms__plane-name">{{ plane.label }}</div>
                <div class="ms__plane-tracks">
                  <!-- Raw signal bar -->
                  <div class="ms__track">
                    <div class="ms__track-label">{{ $t('metrics.raw') }}</div>
                    <div class="ms__bar-wrap">
                      <div
                        class="ms__bar ms__bar--raw"
                        :style="{ width: `${plane.rawSignal * 100}%` }"
                      />
                    </div>
                    <div class="ms__track-val">{{ pctDisplay(plane.rawSignal) }}</div>
                  </div>
                  <!-- Baseline marker -->
                  <div class="ms__track ms__track--baseline">
                    <div class="ms__track-label">{{ $t('metrics.baseline') }}</div>
                    <div class="ms__bar-wrap">
                      <div class="ms__bar ms__bar--baseline" :style="{ width: `${plane.baseline * 100}%` }" />
                    </div>
                    <div class="ms__track-val ms__track-val--dim">{{ pctDisplay(plane.baseline) }}</div>
                  </div>
                  <!-- Above-baseline score -->
                  <div class="ms__track">
                    <div class="ms__track-label">{{ $t('metrics.score') }}</div>
                    <div class="ms__bar-wrap">
                      <div
                        class="ms__bar ms__bar--score"
                        :class="{ 'ms__bar--low': plane.score < 0.05 }"
                        :style="{ width: `${plane.score * 100}%` }"
                      />
                    </div>
                    <div class="ms__track-val" :class="{ 'ms__track-val--dim': plane.score < 0.05 }">
                      {{ pctDisplay(plane.score) }}
                    </div>
                  </div>
                </div>
                <!-- Weight pill -->
                <div class="ms__plane-weight">
                  w={{ Math.round(planeWeight(plane.key) * 100) }}%
                </div>
              </div>
            </div>
          </div>

          <!-- ── Weights summary ───────────────────────────────────── -->
          <div class="ms ms--small">
            <div class="ms__label">{{ $t('metrics.weights') }}</div>
            <div class="ms__weights">
              <span v-for="(w, key) in result.structurality.weights" :key="key" class="ms__wpill">
                {{ WEIGHT_LABELS[key] ?? key }}
                <strong>{{ Math.round(w * 100) }}%</strong>
              </span>
            </div>
          </div>
        </template>
      </div>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { StreamAnalysisResult, StructuralityComponent } from 'src/services/phonetic/analysisTypes';

const open = defineModel<boolean>({ required: true });

const props = defineProps<{
  result?: StreamAnalysisResult | null;
}>();

const { t } = useI18n();

// ── Plane display metadata ────────────────────────────────────────────────────

type PlaneKey = 'rhythm' | 'localPhonemePatterning' | 'soundSequencePatterning' | 'pausePatterning' | 'crossLevelCoupling';

interface PlaneEntry extends StructuralityComponent {
  key: PlaneKey;
  label: string;
}

const PLANE_LABELS: Record<PlaneKey, string> = {
  rhythm:                  'Rhythm',
  localPhonemePatterning:  'Local Phoneme Patterning',
  soundSequencePatterning: 'Sound Sequence / Rhyme',
  pausePatterning:         'Pause Patterning',
  crossLevelCoupling:      'Cross-level Coupling',
};

const WEIGHT_LABELS: Record<string, string> = {
  rhythm:                  'Rhythm',
  localPhonemePatterning:  'Local',
  soundSequencePatterning: 'Sound Seq.',
  pausePatterning:         'Pauses',
  crossLevelCoupling:      'Coupling',
};

const planes = computed<PlaneEntry[]>(() => {
  const s = props.result?.structurality;
  if (!s) return [];
  return (Object.keys(PLANE_LABELS) as PlaneKey[]).map((key) => ({
    key,
    label: PLANE_LABELS[key],
    ...(s[key]),
  }));
});

function planeWeight(key: PlaneKey): number {
  const w = props.result?.structurality.weights;
  if (!w) return 0;
  return (w as unknown as Record<string, number>)[key] ?? 0;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pctDisplay(v: number): string {
  return `${Math.round(v * 100)}%`;
}

function scoreClass(v: number): string {
  if (v >= 0.7) return 'ms__global-row--high';
  if (v >= 0.4) return 'ms__global-row--mid';
  return 'ms__global-row--low';
}

function globalVerdict(v: number): string {
  if (v >= 0.75) return t('metrics.verdictHigh');
  if (v >= 0.45) return t('metrics.verdictMid');
  if (v >= 0.20) return t('metrics.verdictLow');
  return t('metrics.verdictNone');
}

// Conic-gradient ring driven by the global score
const ringStyle = computed(() => {
  const g = props.result?.structurality.global ?? 0;
  // Hue: 0° (red) → 120° (green) proportional to score
  const hue = Math.round(g * 120);
  const deg = Math.round(g * 360);
  return {
    background: `conic-gradient(
      hsl(${hue}, 72%, 50%) ${deg}deg,
      rgba(255,255,255,0.08) ${deg}deg
    )`,
  };
});
</script>

<style scoped lang="scss">
// ── Dialog + card frame ───────────────────────────────────────────────────────
.metrics-dlg {
  // Quasar q-dialog wrapper
  :deep(.q-dialog__inner) {
    padding: 16px;
  }
}

.metrics-card {
  width: min(560px, 95vw);
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  background: #13131f;
  color: rgba(255,255,255,0.88);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    flex-shrink: 0;
  }

  &__title {
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.65);
    flex: 1;
    display: flex;
    align-items: center;
  }

  &__engine {
    font-size: 0.68rem;
    color: rgba(255,255,255,0.25);
    font-family: monospace;
    white-space: nowrap;
  }

  &__body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 40px 0;
    opacity: 0.5;
    font-size: 0.82rem;

    p { margin: 0; }
  }
}

// ── Generic section ───────────────────────────────────────────────────────────
.ms {
  display: flex;
  flex-direction: column;
  gap: 10px;

  &--small { gap: 6px; }

  &__label {
    font-size: 0.67rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.28);
  }
}

// ── Global score ring ─────────────────────────────────────────────────────────
.ms__global {
  display: flex;
  align-items: center;
  gap: 20px;
}

.ms__ring {
  position: relative;
  width: 84px;
  height: 84px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  // inner cutout
  &::after {
    content: '';
    position: absolute;
    inset: 10px;
    border-radius: 50%;
    background: #13131f;
  }
}

.ms__ring-num {
  position: relative;
  z-index: 1;
  font-size: 1.1rem;
  font-weight: 800;
  line-height: 1;
  color: #fff;
}

.ms__ring-sub {
  position: relative;
  z-index: 1;
  font-size: 0.52rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.4);
  margin-top: 2px;
}

.ms__global-interp {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.ms__global-row {
  font-size: 0.75rem;
  color: rgba(255,255,255,0.55);

  &--score {
    font-weight: 600;
    font-size: 0.82rem;
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid;
  }

  &--high { color: #4cdb8a; border-color: rgba(76,219,138,0.35); background: rgba(76,219,138,0.08); }
  &--mid  { color: #f0c040; border-color: rgba(240,192,64,0.35);  background: rgba(240,192,64,0.08);  }
  &--low  { color: #e08060; border-color: rgba(224,128,96,0.35);  background: rgba(224,128,96,0.08);  }
}

.ms__global-key {
  color: rgba(255,255,255,0.28);
  margin-right: 6px;
  font-size: 0.68rem;
}

.ms__global-val {
  font-size: 0.7rem;
  font-family: monospace;
  color: rgba(255,255,255,0.5);
}

// ── Per-plane bars ────────────────────────────────────────────────────────────
.ms__planes {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ms__plane {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto 1fr;
  gap: 4px 8px;

  &-name {
    font-size: 0.74rem;
    font-weight: 600;
    color: rgba(255,255,255,0.7);
    grid-column: 1;
    grid-row: 1;
  }

  &-tracks {
    grid-column: 1;
    grid-row: 2;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  &-weight {
    grid-column: 2;
    grid-row: 1 / 3;
    align-self: center;
    font-size: 0.62rem;
    color: rgba(255,255,255,0.22);
    white-space: nowrap;
    font-family: monospace;
  }
}

.ms__track {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 14px;

  &-label {
    width: 52px;
    font-size: 0.62rem;
    color: rgba(255,255,255,0.28);
    text-align: right;
    flex-shrink: 0;
  }

  &-val {
    width: 32px;
    font-size: 0.68rem;
    color: rgba(255,255,255,0.55);
    text-align: right;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;

    &--dim { color: rgba(255,255,255,0.22); }
  }
}

.ms__bar-wrap {
  flex: 1;
  height: 6px;
  background: rgba(255,255,255,0.07);
  border-radius: 3px;
  overflow: hidden;
}

.ms__bar {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s ease;

  &--raw     { background: #5588dd; }
  &--baseline { background: rgba(255,255,255,0.18); }
  &--score   { background: #44bb88; }
  &--low     { background: #666; opacity: 0.4; }
}

// ── Weights pills ─────────────────────────────────────────────────────────────
.ms__weights {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ms__wpill {
  font-size: 0.68rem;
  color: rgba(255,255,255,0.4);
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 4px;
  padding: 2px 8px;

  strong {
    color: rgba(255,255,255,0.7);
    margin-left: 4px;
  }
}
</style>
