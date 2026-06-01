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



            <!-- ── Detection language filter ─────────────────────── -->
            <span class="stress-sep" />
            <q-btn
              no-caps
              dense
              size="sm"
              padding="2px 10px"
              color="blue-grey-9"
              text-color="grey-3"
              icon="translate"
              :label="`Lang ${enabledLanguageCount}/${LANGUAGES.length}`"
            >
              <q-menu anchor="bottom middle" self="top middle" :offset="[0, 6]">
                <q-list dense style="min-width: 220px">
                  <q-item-label header class="text-caption text-grey-5">
                    Detection languages
                  </q-item-label>
                  <q-item v-for="lang in LANGUAGES" :key="lang" dense>
                    <q-item-section>
                      <q-checkbox
                        :model-value="appStore.enabledLanguages[lang]"
                        :disable="appStore.enabledLanguages[lang] && enabledLanguageCount <= 1"
                        dense
                        :label="`${LANGUAGE_META[lang].flag} ${LANGUAGE_META[lang].label}`"
                        @update:model-value="(v) => onLanguageToggle(lang, v)"
                      />
                    </q-item-section>
                  </q-item>
                  <q-separator />
                  <q-item dense>
                    <q-item-section class="text-caption text-grey-5">
                      Unchecked languages are excluded from auto-detection and stress services.
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-btn>

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
          <!-- Visualizer tab switcher -->
          <div class="panel__action-group panel__action-group--tabs">
            <button
              class="panel__web-btn"
              :class="{ 'panel__web-btn--active': visualizerTab === 'phonetic' }"
              @click="visualizerTab = 'phonetic'"
            >{{ $t('phonetic.tabPhonetic') }}</button>
            <button
              class="panel__web-btn"
              :class="{ 'panel__web-btn--active': visualizerTab === 'mol' }"
              @click="visualizerTab = 'mol'"
            >Mol*</button>
          </div>
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
            <!-- Tab indent coupling toggle -->
            <button
              class="panel__web-btn"
              :class="{ 'panel__web-btn--active': bindTabIndent }"
              title="Toggle tab-coupled indent cells"
              @click="selectInteractionMode('tabs')"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="M2 8h4M10 8h4M6 5l2 3-2 3M10 5l-2 3 2 3"
                  stroke="currentColor"
                  stroke-width="1.4"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              Tab Bind
            </button>
            <!-- Manual grid mode toggle -->
            <button
              class="panel__web-btn"
              :class="{ 'panel__web-btn--active': manualGridMode }"
              title="Manual row/word movement mode"
              @click="selectInteractionMode('manual')"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="2" fill="currentColor" />
                <path
                  d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3"
                  stroke="currentColor"
                  stroke-width="1.2"
                  stroke-linecap="round"
                />
              </svg>
              Manual
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
            <!-- Rhyme web toggle: connect same-group occurrences with lines -->
            <button
              class="panel__web-btn"
              :class="{ 'panel__web-btn--active': showRhymeWeb }"
              :title="$t('phonetic.rhymeWebTitle')"
              @click="showRhymeWeb = !showRhymeWeb"
            >
              <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
                <circle cx="3" cy="7" r="2.5" fill="currentColor" fill-opacity="0.85" />
                <circle cx="17" cy="7" r="2.5" fill="currentColor" fill-opacity="0.85" />
                <path
                  d="M5.5 7 C 8 2, 12 2, 14.5 7"
                  stroke="currentColor"
                  stroke-width="1.5"
                  fill="none"
                  stroke-linecap="round"
                />
              </svg>
              {{ $t('phonetic.rhymeWeb') }}
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
            <label class="panel__range" title="Alliteration density sensitivity">
              <span class="panel__range-label">A</span>
              <input
                v-model.number="alliterationThreshold"
                class="panel__range-input"
                type="range"
                min="0.05"
                max="0.8"
                step="0.05"
              />
            </label>
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
              :title="$t('phonetic.exportSvg')"
              @click="phoneticPanelRef?.exportSvg()"
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
            <!-- Metrics summary button -->
            <button
              class="panel__web-btn"
              :disabled="!visualizerInput.analysisResult"
              :title="$t('metrics.button')"
              @click="showMetricsDialog = true"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="9" width="3" height="6" fill="currentColor" rx="1" />
                <rect x="6" y="5" width="3" height="10" fill="currentColor" rx="1" />
                <rect x="11" y="1" width="3" height="14" fill="currentColor" rx="1" />
              </svg>
              {{ $t('metrics.button') }}
            </button>
          </div>
        </div>
      </div>
      <div class="panel__body panel__body--split">
        <!-- Visualization pane (tab bar + active panel, stacked vertically) -->
        <div class="panel__viz-pane">
          <AsyncPhoneticPanel
            v-show="visualizerTab === 'phonetic'"
            ref="phoneticPanelRef"
            class="panel__viz-pane__content"
            :input="visualizerInput"
            :editor-channel="editorVisualizerChannel"
            v-model:showWeb="showSoundWeb"
            v-model:alignRight="showAlignRight"
            v-model:bindTabs="bindTabIndent"
            v-model:manualMode="manualGridMode"
            v-model:showRhymes="showRhymes"
            v-model:showRhymeWeb="showRhymeWeb"
            v-model:showSounds="showSounds"
            v-model:alliterationThreshold="alliterationThreshold"
            v-model:showNumBadge="showNumBadge"
            v-model:showSylBadge="showSylBadge"
            v-model:showCvBadge="showCvBadge"
          />

          <MolVisualizerTab
            v-if="visualizerTab === 'mol'"
            class="panel__viz-pane__content"
            :molstar="visualizerInput.analysisResult?.molstar ?? null"
          />
        </div>

        <!-- Full-panel overlay while UA WASM / CMU dict are initialising -->
        <Transition name="svc-fade">
          <div v-if="visualizerLoading" class="svc-loading-overlay" aria-live="polite">
            <div class="svc-loading-overlay__spiral" aria-hidden="true">
              <span
                v-for="(item, i) in SVC_SPIRAL_ITEMS"
                :key="i"
                class="svc-ipa-sym"
                :style="item.style"
                >{{ item.symbol }}</span
              >
            </div>
            <p class="svc-loading-overlay__label">{{ $t('phonetic.servicesLoading') }}</p>
          </div>
        </Transition>
      </div>
    </div>
  </q-page>

  <AnalysisMetricsDialog
    v-model="showMetricsDialog"
    :result="visualizerInput.analysisResult ?? null"
  />
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue';
import { useAppStore } from 'stores/app';
import { usePoetryStore } from 'stores/poetry';
import { LANGUAGES, LANGUAGE_META, type Language } from 'src/model/Language';
import type { ToolbarMode } from 'stores/localConfig';
import type {
  EditorVisualizerChannel,
  PhoneticVisualizerInput,
} from 'src/components/visualizer/phoneticVisualizerContract';
import PoetryEditor from 'components/PoetryEditor.vue';
import MolVisualizerTab from 'components/MolVisualizerTab.vue';
import AnalysisMetricsDialog from 'components/AnalysisMetricsDialog.vue';

const phoneticPanelChunkReady = ref(false);
const AsyncPhoneticPanel = defineAsyncComponent(async () => {
  const mod = await import('components/PhoneticPanel.vue');
  phoneticPanelChunkReady.value = true;
  return mod;
});

const SVC_IPA_SYMBOLS = [
  'ɪ',
  'ɛ',
  'æ',
  'ɑ',
  'ɔ',
  'ʊ',
  'ə',
  'ʌ',
  'ɜ',
  'ɨ',
  'ø',
  'œ',
  'ɯ',
  'ɒ',
  'ɐ',
  'ɵ',
  'ʉ',
  'ʏ',
  'ɤ',
  'ɞ',
  'ʒ',
  'ʃ',
  'θ',
  'ð',
  'ŋ',
  'ɹ',
  'ɾ',
  'ɦ',
  'ʎ',
  'ɕ',
  'ʑ',
  'ɲ',
  'ɫ',
  'ʂ',
  'ʐ',
  'ɣ',
  'χ',
  'ʁ',
  'β',
  'ɸ',
  'ʋ',
  'ɬ',
  'ɱ',
  'ɴ',
  'ɳ',
  'ʈ',
  'ɖ',
  'ɡ',
  'ʔ',
  'ɻ',
  'ˈ',
  'ˌ',
  'ː',
  'ˑ',
  'ʼ',
  'ʦ',
  'ʧ',
  'ʤ',
  'ʣ',
  'ʥ',
  'ɗ',
  'ɓ',
  'ʄ',
  'ɠ',
  'ʙ',
  'ʀ',
  'ɧ',
  'ʍ',
  'ɭ',
  'ɽ',
  'ɺ',
  'ɮ',
  'ħ',
  'ʜ',
  'ʛ',
  'ʝ',
  'ɰ',
  'ʡ',
  'ʢ',
] as const;

const SVC_GOLDEN = Math.PI * (3 - Math.sqrt(5));
const SVC_SPIRAL_ITEMS = SVC_IPA_SYMBOLS.map((symbol, index) => {
  const t = index / (SVC_IPA_SYMBOLS.length - 1);
  const radius = Math.sqrt(t);
  const angle = index * SVC_GOLDEN;
  const x = 50 + Math.cos(angle) * radius * 41;
  const y = 50 + Math.sin(angle) * radius * 34;
  const sizeRem = 1.75 - t * 0.8;
  const hue = Math.round(255 - t * 58);
  const sat = Math.round(72 + t * 20);
  const lig = Math.round(62 + t * 24);

  return {
    symbol,
    style: {
      left: `${x.toFixed(2)}%`,
      top: `${y.toFixed(2)}%`,
      fontSize: `${sizeRem.toFixed(2)}rem`,
      color: `hsl(${hue} ${sat}% ${lig}%)`,
      animationDelay: `${(t * 1.4).toFixed(2)}s`,
    },
  };
});

const appStore = useAppStore();
const poetryStore = usePoetryStore();

const phoneticPanelRef = ref<{ exportSvg: () => void } | null>(null);
const visualizerTab = ref<'phonetic' | 'mol'>('phonetic');

const wordCount = computed(() => poetryStore.allWordTokens.length);
const hasConfirmedLines = computed(() =>
  poetryStore.document.lines.some((l) => poetryStore.isLineConfirmed(l.id)),
);
const showSoundWeb = ref(false);
const showAlignRight = ref(false);
const bindTabIndent = ref(true);
const manualGridMode = ref(false);
const showRhymes = ref(true);
const showRhymeWeb = ref(false);
const showSounds = ref(true);
const alliterationThreshold = ref(0.35);
const showRowSettings = ref(true);
const showNumBadge = ref(true);
const showSylBadge = ref(true);
const showCvBadge = ref(true);
const showMetricsDialog = ref(false);
const enabledLanguageCount = computed(
  () => LANGUAGES.filter((lang) => appStore.enabledLanguages[lang]).length,
);
const visualizerLoading = computed(
  () => !phoneticPanelChunkReady.value || poetryStore.servicesLoading,
);

const visualizerInput = computed<PhoneticVisualizerInput>(() => ({
  document: poetryStore.document,
  allWordTokenCount: poetryStore.allWordTokens.length,
  activeLineIndex: poetryStore.activeLineIndex,
  rawText: poetryStore.rawText,
  analysisResult: poetryStore.analysisResult,
  isLineConfirmed: poetryStore.isLineConfirmed,
}));

const editorVisualizerChannel: EditorVisualizerChannel = {
  setRawText: (text: string) => poetryStore.setRawText(text),
};

type InteractionMode = 'tabs' | 'manual';

function selectInteractionMode(mode: InteractionMode) {
  if (mode === 'tabs') {
    // Radio-like exclusivity, but allow toggling active mode OFF -> none.
    if (bindTabIndent.value) {
      bindTabIndent.value = false;
      manualGridMode.value = false;
      return;
    }
    bindTabIndent.value = true;
    manualGridMode.value = false;
    return;
  }

  if (manualGridMode.value) {
    bindTabIndent.value = false;
    manualGridMode.value = false;
    return;
  }
  bindTabIndent.value = false;
  manualGridMode.value = true;
}

function onLanguageToggle(lang: Language, checked: boolean | null) {
  appStore.setLanguageEnabled(lang, checked === true);
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
  height: calc(100vh - 35px); /* subtract header height (35px after 30% reduction) */
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

    // Multi-row toolbar — buttons wrap to 2–3 rows rather than overflowing
    .panel__actions {
      flex-wrap: wrap;
      overflow-x: hidden;
      gap: 3px;
      row-gap: 2px;
    }

    .panel__action-group {
      flex: 0 0 auto;
      margin-bottom: 1px;
      margin-right: 3px;
      gap: 3px;
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
      gap: 3px;
      padding: 1px 5px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 4px;
      background: transparent;
      color: rgba(255, 255, 255, 0.35);
      font-size: 0.63rem;
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
    &__range {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-left: 6px;
      padding: 2px 4px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
    }

    &__range-label {
      font-size: 0.66rem;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.8);
      width: 12px;
      text-align: center;
    }

    &__range-input {
      width: 92px;
      accent-color: #ffffff;
      cursor: pointer;
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

/* ── Services loading overlay ─────────────────────────────────────────────── */
.svc-loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  background: #0d1117;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 28px;
  pointer-events: none;
}

.svc-loading-overlay__spiral {
  position: relative;
  width: min(88%, 680px);
  height: min(78%, 560px);
  animation: svc-spiral-turn 36s linear infinite;
}

@keyframes svc-spiral-turn {
  to {
    transform: rotate(360deg);
  }
}

@keyframes svc-sym-pulse {
  0%,
  100% {
    opacity: 0.15;
    transform: scale(0.85);
  }
  50% {
    opacity: 0.9;
    transform: scale(1.05);
  }
}

.svc-ipa-sym {
  position: absolute;
  transform: translate(-50%, -50%);
  font-family: 'Noto Serif', 'Linux Libertine', Georgia, serif;
  color: rgba(144, 202, 249, 0.8);
  animation: svc-sym-pulse 2s ease-in-out infinite;
  display: inline-block;
  line-height: 1;
  text-shadow: 0 0 18px rgba(100, 180, 255, 0.18);
}

.svc-loading-overlay__label {
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  color: rgba(144, 202, 249, 0.4);
  margin: 0;
  text-transform: uppercase;
}

.svc-fade-enter-active {
  transition: opacity 0.25s ease;
}
.svc-fade-leave-active {
  transition: opacity 0.5s ease;
}
.svc-fade-enter-from,
.svc-fade-leave-to {
  opacity: 0;
}

// ── Visualizer pane layout ────────────────────────────────────────────────────
.panel__viz-pane {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  overflow: hidden;

  &__content {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
}

// ── Tab group in toolbar ──────────────────────────────────────────────────────
.panel__action-group--tabs {
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  padding-right: 8px;
  margin-right: 4px;
}
</style>
