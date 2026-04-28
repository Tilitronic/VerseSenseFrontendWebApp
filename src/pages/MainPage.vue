<template>
  <q-page class="poetry-page">
    <!-- ── LEFT: Editor panel ─────────────────────────────────────── -->
    <div class="panel panel--editor">
      <div class="panel__header">
        <h2 class="panel__title">{{ $t('editor.title') }}</h2>
        <div class="panel__actions">
          <div class="panel__action-group">
            <!-- ── View controls ─────────────────────────────────── -->
            <button
              v-if="appStore.toolbarMode === 'all'"
              class="editor-settings-btn"
              :class="{ 'editor-settings-btn--active': showRowSettings }"
              :title="showRowSettings ? $t('editor.rowsHide') : $t('editor.rowsShow')"
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
              {{ $t('editor.rows') }}
            </button>

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
                <q-tooltip>{{ $t('editor.activeLineOnly') }}</q-tooltip>
              </template>
              <template #all>
                <q-icon name="format_list_bulleted" size="16px" />
                <q-tooltip>{{ $t('editor.everyLine') }}</q-tooltip>
              </template>
            </q-btn-toggle>

            <!-- ── Spellcheck / LT toggles ───────────────────────── -->
            <span class="stress-sep" />
            <q-btn-group unelevated class="stress-source-group">
              <q-btn
                no-caps
                dense
                size="sm"
                padding="2px 10px"
                :color="appStore.spellcheckEnabled ? 'teal-8' : 'blue-grey-9'"
                :text-color="appStore.spellcheckEnabled ? 'white' : 'grey-5'"
                :label="$t('editor.spellcheck')"
                @click="appStore.setSpellcheckEnabled(!appStore.spellcheckEnabled)"
              >
                <q-tooltip
                  anchor="bottom middle"
                  self="top middle"
                  :offset="[0, 6]"
                  style="max-width: 300px"
                >
                  <div class="text-body2 q-mb-xs">
                    {{
                      $t(
                        appStore.spellcheckEnabled ? 'editor.spellcheckOn' : 'editor.spellcheckOff',
                      )
                    }}
                  </div>
                  <div class="text-caption text-grey-4">{{ $t('editor.spellcheckHint') }}</div>
                  <div class="text-caption q-mt-xs">
                    <a
                      href="https://languagetool.org/browserextension"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-teal-3"
                      style="text-decoration: none"
                      @click.stop
                      >{{ $t('editor.ltExtension') }}</a
                    >
                  </div>
                </q-tooltip>
              </q-btn>
              <q-btn
                no-caps
                dense
                size="sm"
                padding="2px 10px"
                :color="appStore.ltEnabled ? 'deep-orange-8' : 'blue-grey-9'"
                :text-color="appStore.ltEnabled ? 'white' : 'grey-5'"
                :label="$t('editor.lt')"
                @click="appStore.setLtEnabled(!appStore.ltEnabled)"
              >
                <q-tooltip
                  anchor="bottom middle"
                  self="top middle"
                  :offset="[0, 6]"
                  style="max-width: 300px"
                >
                  <div class="text-body2 q-mb-xs">
                    {{ $t(appStore.ltEnabled ? 'editor.ltOn' : 'editor.ltOff') }}
                  </div>
                  <div class="text-caption text-grey-4">{{ $t('editor.ltDesc') }}</div>
                  <div class="text-caption text-grey-5 q-mt-xs">{{ $t('editor.ltRateInfo') }}</div>
                  <div class="text-caption q-mt-xs">
                    <a
                      href="https://languagetool.org"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-deep-orange-3"
                      style="text-decoration: none"
                      @click.stop
                      >languagetool.org</a
                    >
                  </div>
                </q-tooltip>
              </q-btn>
            </q-btn-group>

            <!-- ── Stress source toggles ─────────────────────────── -->
            <span class="stress-sep" />
            <q-btn-group unelevated class="stress-source-group">
              <!-- DB toggle -->
              <q-btn
                no-caps
                dense
                size="sm"
                padding="2px 10px"
                :color="appStore.useDbStress ? 'positive' : 'blue-grey-9'"
                :text-color="appStore.useDbStress ? 'white' : 'grey-5'"
                :label="$t('editor.stressDb')"
                :title="$t(appStore.useDbStress ? 'editor.stressDbOn' : 'editor.stressDbOff')"
                @click="appStore.setUseDbStress(!appStore.useDbStress)"
              />

              <!-- ML toggle -->
              <q-btn
                no-caps
                dense
                size="sm"
                padding="2px 10px"
                :color="appStore.useMlStress ? 'primary' : 'blue-grey-9'"
                :text-color="appStore.useMlStress ? 'white' : 'grey-5'"
                :label="$t('editor.stressMl')"
                :title="$t(appStore.useMlStress ? 'editor.stressMlOn' : 'editor.stressMlOff')"
                @click="appStore.setUseMlStress(!appStore.useMlStress)"
              />

              <!-- Info / docs -->
              <q-btn
                dense
                unelevated
                size="sm"
                padding="2px 6px"
                color="blue-grey-9"
                text-color="grey-5"
                icon="help_outline"
              >
                <q-menu anchor="bottom right" self="top right" :offset="[0, 4]">
                  <q-card class="stress-info-card">
                    <q-card-section class="q-pb-xs">
                      <div class="text-subtitle2">
                        <q-icon name="menu_book" size="xs" color="positive" class="q-mr-xs" />
                        {{ $t('stressInfo.dbTitle') }}
                      </div>
                      <div class="text-body2 q-mt-xs">{{ $t('stressInfo.dbDesc') }}</div>
                    </q-card-section>
                    <q-card-section class="q-pt-xs">
                      <q-btn
                        flat
                        no-caps
                        dense
                        size="sm"
                        icon="open_in_new"
                        :label="$t('stressInfo.dbLink')"
                        href="https://github.com/Tilitronic/ua-stress-engine"
                        target="_blank"
                        rel="noopener noreferrer"
                        type="a"
                        color="primary"
                      />
                    </q-card-section>

                    <q-separator />

                    <q-card-section class="q-pb-xs">
                      <div class="text-subtitle2">
                        <q-icon name="psychology" size="xs" color="primary" class="q-mr-xs" />
                        {{ $t('stressInfo.mlTitle') }}
                      </div>
                      <div class="text-body2 q-mt-xs">
                        {{ $t('stressInfo.mlDesc') }}
                        <div class="text-warning q-mt-xs">{{ $t('stressInfo.mlWarning') }}</div>
                      </div>
                    </q-card-section>
                    <q-card-section class="q-pt-xs">
                      <q-btn
                        flat
                        no-caps
                        dense
                        size="sm"
                        icon="open_in_new"
                        :label="$t('stressInfo.mlLink')"
                        href="https://github.com/Tilitronic/ua-stress-engine"
                        target="_blank"
                        rel="noopener noreferrer"
                        type="a"
                        color="primary"
                      />
                    </q-card-section>
                  </q-card>
                </q-menu>
              </q-btn>
            </q-btn-group>

            <!-- ── Document actions (pushed to right) ────────────── -->
            <span class="toolbar-spacer" />
            <span class="panel__word-count">{{ wordCount }} {{ $t('editor.words') }}</span>
            <q-btn flat dense icon="content_copy" class="q-ml-xs" @click="copyAllText">
              <q-tooltip anchor="bottom middle" self="top middle" :offset="[0, 6]">
                {{ $t('editor.copyAll') }}
              </q-tooltip>
            </q-btn>
            <q-btn
              flat
              dense
              icon="delete_outline"
              color="negative"
              class="q-ml-xs"
              @click="clearText"
            >
              <q-tooltip anchor="bottom middle" self="top middle" :offset="[0, 6]">
                {{ $t('editor.clear') }}
              </q-tooltip>
            </q-btn>
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
        <h2 class="panel__title">{{ $t('phonetic.title') }}</h2>
        <div class="panel__actions">
          <div class="panel__action-group">
            <!-- Sound web toggle -->
            <button
              class="panel__web-btn"
              :class="{ 'panel__web-btn--active': showSoundWeb }"
              :title="$t('phonetic.soundsWebTitle')"
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
              {{ $t('phonetic.soundsWeb') }}
            </button>
            <!-- Right-align toggle -->
            <button
              class="panel__web-btn"
              :class="{ 'panel__web-btn--active': showAlignRight }"
              :title="$t('phonetic.alignRightTitle')"
              @click="showAlignRight = !showAlignRight"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="3" width="12" height="2" rx="1" fill="currentColor" />
                <rect x="6" y="7" width="8" height="2" rx="1" fill="currentColor" />
                <rect x="4" y="11" width="10" height="2" rx="1" fill="currentColor" />
              </svg>
              {{ $t('phonetic.alignRight') }}
            </button>
            <!-- Rhyme motif detection toggle -->
            <button
              class="panel__web-btn"
              :class="{ 'panel__web-btn--active': showRhymes }"
              :title="$t('phonetic.rhymesHighlightTitle')"
              @click="showRhymes = !showRhymes"
            >
              <svg
                width="28"
                height="14"
                viewBox="0 0 28 14"
                fill="none"
                style="font-family: serif"
              >
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
              {{ $t('phonetic.rhymesHighlight') }}
            </button>
          </div>
          <div class="panel__action-group">
            <!-- Row badge column toggles -->
            <button
              class="panel__web-btn"
              :class="{ 'panel__web-btn--active': showNumBadge }"
              :title="$t('phonetic.rowNumTitle')"
              @click="showNumBadge = !showNumBadge"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="1" width="12" height="12" rx="2" fill="currentColor" />
              </svg>
              {{ $t('phonetic.rowNum') }}
            </button>
            <button
              class="panel__web-btn"
              :class="{ 'panel__web-btn--active': showSylBadge }"
              :title="$t('phonetic.syllablesTitle')"
              @click="showSylBadge = !showSylBadge"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" fill="currentColor" />
              </svg>
              {{ $t('phonetic.syllables') }}
            </button>
            <button
              class="panel__web-btn"
              :class="{ 'panel__web-btn--active': showCvBadge }"
              :title="$t('phonetic.cvRatioTitle')"
              @click="showCvBadge = !showCvBadge"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <polygon points="7,1 13,7 7,13 1,7" fill="currentColor" />
              </svg>
              {{ $t('phonetic.cvRatio') }}
            </button>
          </div>
          <div class="panel__action-group">
            <!-- Sound pattern colours toggle -->
            <button
              class="panel__web-btn"
              :class="{ 'panel__web-btn--active': showSounds }"
              :title="$t('phonetic.soundsColorTitle')"
              @click="showSounds = !showSounds"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="5" cy="8" r="3" fill="currentColor" fill-opacity="0.6" />
                <circle cx="11" cy="8" r="3" fill="currentColor" fill-opacity="0.85" />
              </svg>
              {{ $t('phonetic.soundsColor') }}
            </button>
          </div>
          <div class="panel__action-group">
            <!-- Rhymes panel toggle -->
            <button
              class="panel__web-btn"
              :class="{ 'panel__web-btn--active': showRhymesPanel }"
              :title="$t('phonetic.rhymesPanelTitle')"
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
              {{ $t('phonetic.rhymesPanel') }}
            </button>
          </div>
          <div class="panel__action-group">
            <!-- Legend link -->
            <a
              href="/#/legend"
              target="_blank"
              rel="noopener"
              class="panel__web-btn panel__web-btn--link"
              :title="$t('phonetic.legendTitle')"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect
                  x="1"
                  y="1"
                  width="14"
                  height="14"
                  rx="2"
                  stroke="currentColor"
                  stroke-width="1.4"
                  fill="none"
                />
                <text
                  x="3"
                  y="12"
                  font-size="9"
                  font-weight="700"
                  fill="currentColor"
                  font-family="serif"
                >
                  ?
                </text>
              </svg>
              {{ $t('phonetic.legend') }}
            </a>
          </div>
          <div class="panel__action-group">
            <!-- Export SVG button -->
            <button
              class="panel__web-btn panel__web-btn--export"
              :disabled="!hasConfirmedLines"
              :title="exportWithLegend ? $t('phonetic.exportSvgLegend') : $t('phonetic.exportSvg')"
              @click="phoneticPanelRef?.exportSvg(exportWithLegend)"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="M8 2v8M5 7l3 3 3-3"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                />
              </svg>
              {{ $t('phonetic.exportSvg') }}
            </button>
            <!-- Sub-setting: include legend in exported SVG -->
            <button
              class="panel__web-btn panel__web-btn--sub"
              :class="{ 'panel__web-btn--active': exportWithLegend }"
              :title="$t('phonetic.exportLegendTitle')"
              @click="exportWithLegend = !exportWithLegend"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect
                  x="2"
                  y="2"
                  width="5"
                  height="5"
                  rx="1"
                  fill="currentColor"
                  fill-opacity="0.7"
                />
                <rect x="9" y="3" width="5" height="1.5" rx="0.75" fill="currentColor" />
                <rect
                  x="9"
                  y="6"
                  width="3"
                  height="1.5"
                  rx="0.75"
                  fill="currentColor"
                  fill-opacity="0.5"
                />
                <rect
                  x="2"
                  y="9"
                  width="5"
                  height="5"
                  rx="1"
                  fill="currentColor"
                  fill-opacity="0.4"
                />
                <rect x="9" y="10" width="5" height="1.5" rx="0.75" fill="currentColor" />
                <rect
                  x="9"
                  y="13"
                  width="3"
                  height="1.5"
                  rx="0.75"
                  fill="currentColor"
                  fill-opacity="0.5"
                />
              </svg>
              {{ $t('phonetic.exportLegend') }}
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
          v-model:showNumBadge="showNumBadge"
          v-model:showSylBadge="showSylBadge"
          v-model:showCvBadge="showCvBadge"
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
const showNumBadge = ref(true);
const showSylBadge = ref(true);
const showCvBadge = ref(true);

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

async function copyAllText() {
  const text = poetryStore.rawText;
  if (!text) return;
  await navigator.clipboard.writeText(text);
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
    flex: 1 1 auto; // allow the group itself to grow so spacer works
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

  &__activity {
    flex-shrink: 0;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
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

// ── Export sub-setting button (+Legend) ───────────────────────────────────────
.panel__web-btn--sub {
  font-size: 0.62rem !important;
  padding: 2px 6px !important;
  opacity: 0.65;
  border-style: dashed !important;

  &:hover {
    opacity: 1;
  }

  &.panel__web-btn--active {
    opacity: 1;
    border-style: solid !important;
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

// ── Stress source toggles ────────────────────────────────────────────────────
.stress-sep {
  display: inline-block;
  width: 1px;
  height: 14px;
  background: rgba(255, 255, 255, 0.12);
  margin: 0 6px;
  flex-shrink: 0;
}

// Pushes document-action cluster (word count / copy / clear) to the right
.toolbar-spacer {
  flex: 1 1 auto;
}

.stress-source-group {
  border-radius: 4px;
  overflow: hidden;
}

.stress-info-card {
  width: 280px;
}
</style>
