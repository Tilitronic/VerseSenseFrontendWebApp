<template>
  <q-page class="poetry-page">
    <!-- ── LEFT: Editor panel ─────────────────────────────────────── -->
    <div class="panel panel--editor">
      <div class="panel__header">
        <h2 class="panel__title">Poetry Editor</h2>
        <div class="panel__actions">
          <div class="panel__action-group">
          <!-- Row settings toggle -->
          <button
            v-if="appStore.toolbarMode === 'all'"
            class="editor-settings-btn"
            :class="{ 'editor-settings-btn--active': showRowSettings }"
            :title="showRowSettings ? 'Hide row settings' : 'Show row settings'"
            @click="showRowSettings = !showRowSettings"
          >
            <span
              class="editor-settings-btn__dot"
              :class="
                allLinesConfirmed
                  ? 'editor-settings-btn__dot--ok'
                  : 'editor-settings-btn__dot--pending'
              "
            />
            Rows
          </button>

            <!-- Toolbar mode toggle -->
            <q-btn-toggle
              v-model="toolbarModeModel"
              flat
              dense
              no-caps
              toggle-color="primary"
              class="q-ml-xs"
              :options="[
                { value: 'active', slot: 'active' },
                { value: 'all', slot: 'all' },
              ]"
            >
              <template #active>
                <q-icon name="highlight" size="16px" />
                <q-tooltip>Active line only</q-tooltip>
              </template>
              <template #all>
                <q-icon name="format_list_bulleted" size="16px" />
                <q-tooltip>Every line</q-tooltip>
              </template>
            </q-btn-toggle>

            <!-- Word count -->
            <span class="panel__word-count q-ml-xs">
              {{ wordCount }} word{{ wordCount !== 1 ? 's' : '' }}
            </span>

            <!-- Clear -->
            <q-btn
              flat
              dense
              icon="delete_outline"
              color="negative"
              title="Clear"
              class="q-ml-xs"
              @click="clearText"
            />
          </div>
        </div>
      </div>

      <!-- Token-based editor replaces the old textarea -->
      <div class="panel__body">
        <PoetryEditor :show-row-settings="showRowSettings" />
      </div>
    </div>

    <!-- ── RIGHT: Phonetic panel ──────────────────────────────────── -->
    <div class="panel panel--phonetic">
      <div class="panel__header">
        <h2 class="panel__title">Patterns Visualization</h2>
        <div class="panel__actions">
          <div class="panel__action-group">
          <!-- Sound web toggle -->
          <button
            class="panel__web-btn"
            :class="{ 'panel__web-btn--active': showSoundWeb }"
            title="Sound clustering web"
            @click="showSoundWeb = !showSoundWeb"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="3" cy="8" r="1.8" fill="currentColor" />
              <circle cx="13" cy="3" r="1.8" fill="currentColor" />
              <circle cx="13" cy="13" r="1.8" fill="currentColor" />
              <circle cx="8" cy="2" r="1.8" fill="currentColor" />
              <circle cx="8" cy="14" r="1.8" fill="currentColor" />
              <line x1="3" y1="8" x2="13" y2="3" stroke="currentColor" stroke-width="1.2" />
              <line x1="3" y1="8" x2="13" y2="13" stroke="currentColor" stroke-width="1.2" />
              <line x1="3" y1="8" x2="8" y2="2" stroke="currentColor" stroke-width="1.2" />
              <line x1="3" y1="8" x2="8" y2="14" stroke="currentColor" stroke-width="1.2" />
              <line x1="13" y1="3" x2="8" y2="14" stroke="currentColor" stroke-width="1.2" />
              <line x1="13" y1="13" x2="8" y2="2" stroke="currentColor" stroke-width="1.2" />
            </svg>
            Sounds web
          </button>
          <!-- Right-align toggle -->
          <button
            class="panel__web-btn"
            :class="{ 'panel__web-btn--active': showAlignRight }"
            title="Right-align rows (ignore leading tabs)"
            @click="showAlignRight = !showAlignRight"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="3" width="12" height="2" rx="1" fill="currentColor" />
              <rect x="6" y="7" width="8" height="2" rx="1" fill="currentColor" />
              <rect x="4" y="11" width="10" height="2" rx="1" fill="currentColor" />
            </svg>
            Right
          </button>
            <!-- Rhyme motif detection toggle -->
            <button
              class="panel__web-btn"
              :class="{ 'panel__web-btn--active': showRhymes }"
              title="Highlight recurring phoneme patterns (rhymes)"
              @click="showRhymes = !showRhymes"
            >
            <svg width="28" height="14" viewBox="0 0 28 14" fill="none" style="font-family: serif">
              <text
                x="0"
                y="11"
                font-size="8"
                font-family="Georgia,serif"
                font-weight="700"
                fill="currentColor"
                opacity="1.0"
              >
                A
              </text>
              <text
                x="7"
                y="11"
                font-size="8"
                font-family="Georgia,serif"
                font-weight="700"
                fill="currentColor"
                opacity="0.55"
              >
                B
              </text>
              <text
                x="14"
                y="11"
                font-size="8"
                font-family="Georgia,serif"
                font-weight="700"
                fill="currentColor"
                opacity="0.55"
              >
                B
              </text>
              <text
                x="21"
                y="11"
                font-size="8"
                font-family="Georgia,serif"
                font-weight="700"
                fill="currentColor"
                opacity="1.0"
              >
                A
              </text>
            </svg>
            Rhymes highlight
            </button>
          </div>
          <div class="panel__action-group">
            <!-- Sound pattern colours toggle -->
            <button
              class="panel__web-btn"
              :class="{ 'panel__web-btn--active': showSounds }"
              title="Show / hide sound-pattern colour highlights"
              @click="showSounds = !showSounds"
            >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="5" cy="8" r="3" fill="currentColor" fill-opacity="0.6" />
              <circle cx="11" cy="8" r="3" fill="currentColor" fill-opacity="0.85" />
            </svg>
            Sounds highlight
          </button>
          </div>
          <div class="panel__action-group">
            <!-- Rhymes panel toggle -->
            <button
              class="panel__web-btn"
              :class="{ 'panel__web-btn--active': showRhymesPanel }"
              title="Open rhyme groups panel"
              @click="showRhymesPanel = !showRhymesPanel"
            >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect
                x="1"
                y="2"
                width="14"
                height="3"
                rx="1.5"
                fill="currentColor"
                fill-opacity="0.9"
              />
              <rect
                x="1"
                y="7"
                width="10"
                height="3"
                rx="1.5"
                fill="currentColor"
                fill-opacity="0.65"
              />
              <rect
                x="1"
                y="12"
                width="7"
                height="2"
                rx="1"
                fill="currentColor"
                fill-opacity="0.4"
              />
            </svg>
            Rhymes panel
            </button>
          </div>
          <div class="panel__action-group">
            <!-- Legend link -->
            <a
              href="/legend"
              target="_blank"
              rel="noopener"
              class="panel__web-btn panel__web-btn--link"
              title="Умовні позначення (відкрити в новій вкладці)"
            >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.4" fill="none"/>
              <text x="3" y="12" font-size="9" font-weight="700" fill="currentColor" font-family="serif">?</text>
            </svg>
            Legend
          </a>
            <!-- Legend-in-export toggle -->
            <button
              class="panel__web-btn"
              :class="{ 'panel__web-btn--active': exportWithLegend }"
              title="Include legend (умовні позначення) in exported SVG"
              @click="exportWithLegend = !exportWithLegend"
            >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="5" height="5" rx="1" fill="currentColor" fill-opacity="0.7"/>
              <rect x="9" y="3" width="5" height="1.5" rx="0.75" fill="currentColor"/>
              <rect x="9" y="6" width="3" height="1.5" rx="0.75" fill="currentColor" fill-opacity="0.5"/>
              <rect x="2" y="9" width="5" height="5" rx="1" fill="currentColor" fill-opacity="0.4"/>
              <rect x="9" y="10" width="5" height="1.5" rx="0.75" fill="currentColor"/>
              <rect x="9" y="13" width="3" height="1.5" rx="0.75" fill="currentColor" fill-opacity="0.5"/>
            </svg>
            +Legend
          </button>
          </div>
          <div class="panel__action-group">
            <!-- Export SVG button -->
            <button
              class="panel__web-btn panel__web-btn--export"
              :disabled="!hasConfirmedLines"
              :title="exportWithLegend ? 'Export SVG with legend' : 'Export SVG (no legend)'"
              @click="phoneticPanelRef?.exportSvg(exportWithLegend)"
            >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 2v8M5 7l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            Export SVG
            </button>
          </div>
        </div>
      </div>
      <div class="panel__body panel__body--split" ref="splitBodyRef">
        <PhoneticPanel
          ref="phoneticPanelRef"
          class="panel__split-main"
          v-model:showWeb="showSoundWeb"
          v-model:alignRight="showAlignRight"
          v-model:showRhymes="showRhymes"
          v-model:showSounds="showSounds"
        />
        <Transition name="rp-slide">
          <div v-if="showRhymesPanel" class="panel__rp-wrap">
            <div class="panel__rp-divider" @pointerdown="onRpDividerPointerDown" />
            <RhymesPanel class="panel__split-side" :style="rhymesPanelStyle" />
          </div>
        </Transition>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAppStore } from 'stores/app';
import { usePoetryStore } from 'stores/poetry';
import type { ToolbarMode } from 'stores/localConfig';
import PoetryEditor from 'components/PoetryEditor.vue';
import PhoneticPanel from 'components/PhoneticPanel.vue';
import RhymesPanel from 'components/RhymesPanel.vue';

const appStore = useAppStore();
const poetryStore = usePoetryStore();

const phoneticPanelRef = ref<InstanceType<typeof PhoneticPanel> | null>(null);

const wordCount = computed(() => poetryStore.allWordTokens.length);
const hasConfirmedLines = computed(() =>
  poetryStore.document.lines.some((l) => poetryStore.isLineConfirmed(l.id)),
);
const showSoundWeb = ref(false);
const showAlignRight = ref(false);
const showRhymes = ref(false);
const showSounds = ref(true);
const showRhymesPanel = ref(false);
const showRowSettings = ref(true);
const exportWithLegend = ref(false);

// ── Resizable rhymes panel ───────────────────────────────────────────────────
const splitBodyRef = ref<HTMLElement | null>(null);
const rhymesPanelPx = ref(220);

const rhymesPanelStyle = computed(() => ({ width: `${rhymesPanelPx.value}px` }));

let rpDragStartX = 0;
let rpDragStartPx = 0;

function onRpDividerPointerDown(e: PointerEvent) {
  e.preventDefault();
  rpDragStartX = e.clientX;
  rpDragStartPx = rhymesPanelPx.value;
  window.addEventListener('pointermove', onRpDividerPointerMove);
  window.addEventListener('pointerup', onRpDividerPointerUp);
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
}

function onRpDividerPointerMove(e: PointerEvent) {
  // dragging left = bigger panel (divider is on the LEFT of the panel)
  const delta = rpDragStartX - e.clientX;
  const containerW = splitBodyRef.value?.clientWidth ?? window.innerWidth;
  rhymesPanelPx.value = Math.min(containerW * 0.6, Math.max(140, rpDragStartPx + delta));
}

function onRpDividerPointerUp() {
  window.removeEventListener('pointermove', onRpDividerPointerMove);
  window.removeEventListener('pointerup', onRpDividerPointerUp);
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
}

const allLinesConfirmed = computed(() => {
  const lines = poetryStore.document.lines;
  const wordLines = lines.filter((l) => l.tokens.some((t) => t.kind === 'WORD'));
  return wordLines.length > 0 && wordLines.every((l) => poetryStore.isLineConfirmed(l.id));
});

const toolbarModeModel = computed<ToolbarMode>({
  get: () => appStore.toolbarMode,
  set: (v) => appStore.setToolbarMode(v),
});

function clearText() {
  poetryStore.setRawText('');
}
</script>

<style scoped lang="scss">
.poetry-page {
  display: flex;
  align-items: stretch;
  height: calc(100vh - 50px); /* subtract header height */
  padding: 0;
  gap: 0;
  overflow: hidden;
}

// ── Shared panel base ────────────────────────────────────────────────────────
.panel {
  display: flex;
  flex-direction: column;
  width: 50%;
  overflow: hidden;

  &--editor {
    border-right: 1px solid rgba(255, 255, 255, 0.08);
    background: #12121c;
  }

  &--phonetic {
    background: #ffffff;

    .panel__header {
      background: #12121c;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      padding-left: 20px;
      padding-right: 20px;
    }

    .panel__title {
      color: rgba(255, 255, 255, 0.45);
    }

    .panel__word-count {
      color: rgba(255, 255, 255, 0.3);
    }

    .panel__web-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 4px;
      background: transparent;
      color: rgba(255, 255, 255, 0.35);
      font-size: 0.68rem;
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
      flex-shrink: 0;
      transition:
        background 0.12s,
        color 0.12s,
        border-color 0.12s;

      &:hover {
        border-color: rgba(255, 255, 255, 0.4);
        color: rgba(255, 255, 255, 0.7);
      }

      &--active {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.5);
        color: rgba(255, 255, 255, 0.9);
      }
    }
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    flex-shrink: 0;
  }

    &__title {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.45);
    white-space: nowrap;
    flex-shrink: 0;
    padding-left: 20px;
    padding-right: 12px;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    align-content: flex-start;
    min-width: 0;
  }

  .panel__action-group {
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
    flex: 0 0 auto;
    margin-right: 8px;
    margin-bottom: 6px;
  }

  &__word-count {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.3);
  }

  &__body {
    flex: 1;
    overflow: hidden;
    position: relative;

    // Split layout: IPA grid + rhymes panel side-by-side
    &--split {
      display: flex;
      flex-direction: row;
      align-items: stretch;
    }
  }

  &__split-main {
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  &__split-side {
    // width is set inline via rhymesPanelStyle
    flex-shrink: 0;
    overflow: hidden;
    min-width: 140px;
  }

  &__rp-wrap {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    overflow: hidden;
  }

  &__rp-divider {
    width: 5px;
    flex-shrink: 0;
    cursor: col-resize;
    background: transparent;
    position: relative;
    transition: background 0.15s;

    &::after {
      content: '';
      position: absolute;
      inset: 0 2px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 1px;
      transition: background 0.15s;
    }

    &:hover::after {
      background: rgba(255, 255, 255, 0.28);
    }
  }
}

// ── Rhymes panel slide transition ─────────────────────────────────────────────
.rp-slide-enter-active,
.rp-slide-leave-active {
  transition:
    width 0.22s ease,
    opacity 0.18s ease;
  overflow: hidden;
}
.rp-slide-enter-from,
.rp-slide-leave-to {
  width: 0 !important;
  opacity: 0;
}

// ── Row-settings toggle button ───────────────────────────────────────────────
.editor-settings-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 4px;
  background: transparent;
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.68rem;
  cursor: pointer;
  user-select: none;
  transition:
    background 0.12s,
    color 0.12s,
    border-color 0.12s;

  &:hover {
    border-color: rgba(255, 255, 255, 0.35);
    color: rgba(255, 255, 255, 0.7);
  }

  &--active {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.3);
    color: rgba(255, 255, 255, 0.8);
  }

  &__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
    transition: background 0.25s;

    &--ok {
      background: #4caf7d;
    } // green  — all confirmed
    &--pending {
      background: #e8a030;
    } // orange — at least one unconfirmed
  }
}

// ── Export SVG button ─────────────────────────────────────────────────────────
.panel__web-btn--export {
  border-color: rgba(100, 200, 120, 0.35) !important;
  color: rgba(100, 220, 130, 0.7) !important;

  &:not(:disabled):hover {
    border-color: rgba(100, 220, 130, 0.7) !important;
    color: rgba(100, 240, 140, 1) !important;
    background: rgba(100, 220, 130, 0.08) !important;
  }

  &:disabled {
    opacity: 0.3;
    cursor: default;
  }
}

// ── Legend link button ────────────────────────────────────────────────────────
.panel__web-btn--link {
  text-decoration: none;

  &:hover {
    border-color: rgba(255, 255, 255, 0.4);
    color: rgba(255, 255, 255, 0.7);
  }
}

// ── Responsive stacking ──────────────────────────────────────────────────────
@media (max-width: 900px) {
  .poetry-page {
    flex-direction: column;
    height: auto;
  }

  .panel {
    width: 100%;
    min-height: 50vh;
  }
}
</style>
