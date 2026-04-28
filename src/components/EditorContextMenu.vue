<template>
  <Teleport to="body">
    <div v-if="visible" ref="menuEl" class="ecm" :style="menuStyle" @contextmenu.prevent>
      <!-- ── Header: word + hidden-items reveal ──────────────────────── -->
      <div class="ecm__header">
        <span class="ecm__word">{{ word || '—' }}</span>
        <button
          v-if="settings.hidden.length > 0"
          class="ecm__reveal-btn"
          :class="{ 'ecm__reveal-btn--open': showHiddenPanel }"
          :title="`${settings.hidden.length} прихованих`"
          @click="showHiddenPanel = !showHiddenPanel"
        >
          <span class="material-icons ecm__reveal-icon">visibility_off</span>
          <span class="ecm__reveal-count">{{ settings.hidden.length }}</span>
        </button>
      </div>

      <!-- ── Hidden items restore panel ─────────────────────────────── -->
      <div v-if="showHiddenPanel" class="ecm__hidden-panel">
        <div v-for="s in allHiddenSearches" :key="s.key" class="ecm__hidden-row">
          <span class="ecm__hidden-label">{{ s.label }}</span>
          <button class="ecm__unhide-btn" title="Показати" @click="unhide(s.key)">
            <span class="material-icons">visibility</span>
          </button>
        </div>
        <div v-if="allHiddenSearches.length === 0" class="ecm__hidden-empty">Немає прихованих</div>
      </div>

      <!-- ── Group: Text editing ─────────────────────────────────────── -->
      <div class="ecm__group-title">Редагування</div>
      <div class="ecm__action-row">
        <button class="ecm__action-btn" @click="onCopy">
          <span class="material-icons ecm__action-icon">content_copy</span>
          Копіювати
        </button>
        <button class="ecm__action-btn" :disabled="!word" @click="onCut">
          <span class="material-icons ecm__action-icon">content_cut</span>
          Вирізати
        </button>
        <button class="ecm__action-btn" @click="onPaste">
          <span class="material-icons ecm__action-icon">content_paste</span>
          Вставити
        </button>
      </div>

      <!-- ── Case transforms ────────────────────────────────────────── -->
      <div class="ecm__case-row">
        <button
          class="ecm__case-btn"
          :disabled="!word"
          title="Перша велика + решта малі"
          @click="doTransform('capitalize')"
        >
          Аа
        </button>
        <button
          class="ecm__case-btn"
          :disabled="!word"
          title="Всі малі"
          @click="doTransform('lowercase')"
        >
          аа
        </button>
        <button
          class="ecm__case-btn"
          :disabled="!word"
          title="Всі великі"
          @click="doTransform('uppercase')"
        >
          АА
        </button>
      </div>

      <!-- ── Search groups ──────────────────────────────────────────── -->
      <template v-for="grp in visibleGroups" :key="grp.id">
        <div class="ecm__divider" />
        <div class="ecm__group-title">{{ grp.label }}</div>
        <div v-for="s in grp.searches" :key="s.key" class="ecm__search-row">
          <a
            :href="word ? s.url(word) : undefined"
            rel="noopener noreferrer"
            class="ecm__search-lbl"
            :class="{
              'ecm__search-lbl--opened': openedKeys.has(s.key),
              'ecm__search-lbl--disabled': !word,
            }"
            @click.prevent="word && handleSearchClick(s)"
          >
            <span
              class="ecm__search-dot"
              :class="{ 'ecm__search-dot--done': openedKeys.has(s.key) }"
            />
            {{ s.label }}
          </a>
          <button class="ecm__hide-btn" title="Сховати" @click="hide(s.key)">×</button>
        </div>
      </template>

      <div class="ecm__divider" />
      <div class="ecm__footer">
        <button
          class="ecm__tab-toggle"
          :class="{ 'ecm__tab-toggle--bg': openInBackground }"
          :title="
            openInBackground
              ? 'Фоновий режим: вкладка відкривається, едитор лишається активним'
              : 'Режим переходу: браузер перемикається до нової вкладки'
          "
          @click.stop="openInBackground = !openInBackground"
        >
          <span class="material-icons ecm__tab-icon">{{
            openInBackground ? 'tab_unselected' : 'open_in_new'
          }}</span>
          {{ openInBackground ? 'Фон' : 'Перейти' }}
        </button>
        <button class="ecm__close-btn" @click="emit('close')">Закрити</button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onUnmounted } from 'vue';
import { getWordScriptInfo, type WordScriptInfo } from 'src/services/languageDetection/wordScript';

// ── Types ──────────────────────────────────────────────────────────────────────
type ShowForFn = (info: WordScriptInfo) => boolean;

interface SearchDef {
  key: string;
  group: string;
  label: string;
  url: (word: string) => string;
  showFor: ShowForFn;
}

interface GroupDef {
  id: string;
  label: string;
}

interface EcmSettings {
  checked: Record<string, boolean>;
  hidden: string[];
}

// ── Predicate helpers ─────────────────────────────────────────────────────────
const ALWAYS: ShowForFn = () => true;
const FOR_UA: ShowForFn = (i) => i.script === 'cyrillic';
const FOR_PL: ShowForFn = (i) => i.script === 'latin' && i.lockedLanguage === 'pl';
const FOR_EN: ShowForFn = (i) => i.script === 'latin' && i.lockedLanguage !== 'pl';
/** Ukrainian (any Cyrillic) OR English/ambiguous Latin — for bilingual uk↔en resources. */
const FOR_UA_OR_EN: ShowForFn = (i) =>
  i.script === 'cyrillic' || (i.script === 'latin' && i.lockedLanguage !== 'pl');

const enc = encodeURIComponent;

// ── All search definitions ─────────────────────────────────────────────────────
const ALL_SEARCHES: SearchDef[] = [
  // ── Ukrainian dictionaries ───────────────────────────────────────────────
  {
    key: 'goroh_decl',
    group: 'ua-dict',
    label: '📚 Словозміна (Горох)',
    showFor: FOR_UA,
    url: (w) => `https://goroh.pp.ua/Словозміна/${enc(w)}`,
  },
  {
    key: 'goroh_rhyme',
    group: 'ua-dict',
    label: '🎵 Римування (Горох)',
    showFor: FOR_UA,
    url: (w) => `https://goroh.pp.ua/Римування/${enc(w)}`,
  },
  {
    key: 'goroh_trans',
    group: 'ua-dict',
    label: '🔤 Транскрипція (Горох)',
    showFor: FOR_UA,
    url: (w) => `https://goroh.pp.ua/Транскрипція/${enc(w)}`,
  },
  {
    key: 'goroh_mean',
    group: 'ua-dict',
    label: '📖 Тлумачення (Горох)',
    showFor: FOR_UA,
    url: (w) => `https://goroh.pp.ua/Тлумачення/${enc(w)}`,
  },
  {
    key: 'goroh_syn',
    group: 'ua-dict',
    label: '💬 Синонімія (Горох)',
    showFor: FOR_UA,
    url: (w) => `https://goroh.pp.ua/Синонімія/${enc(w)}`,
  },
  {
    key: 'azrhymes',
    group: 'ua-dict',
    label: '🎶 AzRhymes',
    showFor: FOR_UA,
    url: (w) => `https://ua.azrhymes.com/?q=${enc(w)}`,
  },
  {
    key: 'slovnyk',
    group: 'ua-dict',
    label: '📕 Словник.ua',
    showFor: FOR_UA,
    url: (w) => `https://slovnyk.ua/index.php?swrd=${enc(w)}`,
  },
  {
    key: 'r2u',
    group: 'translate',
    label: '📗 R2U (ru→uk)',
    showFor: FOR_UA,
    url: (w) => `https://r2u.org.ua/s?w=${enc(w)}&dicts=all&highlight=on`,
  },

  // ── English-Ukrainian dictionaries ────────────────────────────────────────
  {
    key: 'e2u',
    group: 'translate',
    label: '🔤 E2U uk↔en',
    showFor: FOR_UA_OR_EN,
    url: (w) => `https://e2u.org.ua/s?w=${enc(w)}&dicts=all&highlight=on&filter_lines=on`,
  },

  // ── Glosbe — direction depends on word language ──────────────────────────
  {
    key: 'glosbe_uk_pl',
    group: 'translate',
    label: '🌍 Glosbe uk→pl',
    showFor: FOR_UA,
    url: (w) => `https://pl.glosbe.com/uk/pl/${enc(w)}`,
  },
  {
    key: 'glosbe_uk_en',
    group: 'translate',
    label: '🌍 Glosbe uk→en',
    showFor: FOR_UA,
    url: (w) => `https://en.glosbe.com/uk/en/${enc(w)}`,
  },
  {
    key: 'glosbe_pl_en',
    group: 'translate',
    label: '🌍 Glosbe pl→en',
    showFor: FOR_PL,
    url: (w) => `https://en.glosbe.com/pl/en/${enc(w)}`,
  },
  {
    key: 'glosbe_pl_uk',
    group: 'translate',
    label: '🌍 Glosbe pl→uk',
    showFor: FOR_PL,
    url: (w) => `https://uk.glosbe.com/pl/uk/${enc(w)}`,
  },
  {
    key: 'glosbe_en_uk',
    group: 'translate',
    label: '🌍 Glosbe en→uk',
    showFor: FOR_EN,
    url: (w) => `https://uk.glosbe.com/en/uk/${enc(w)}`,
  },
  {
    key: 'glosbe_en_pl',
    group: 'translate',
    label: '🌍 Glosbe en→pl',
    showFor: FOR_EN,
    url: (w) => `https://pl.glosbe.com/en/pl/${enc(w)}`,
  },

  // ── Wiktionary ───────────────────────────────────────────────────────────
  {
    key: 'wikt_uk',
    group: 'translate',
    label: '📘 Wiktionary (uk)',
    showFor: FOR_UA,
    url: (w) => `https://uk.wiktionary.org/wiki/${enc(w)}`,
  },
  {
    key: 'wikt_pl',
    group: 'translate',
    label: '📘 Wiktionary (pl)',
    showFor: FOR_PL,
    url: (w) => `https://pl.wiktionary.org/wiki/${enc(w)}`,
  },
  {
    key: 'wikt_en',
    group: 'translate',
    label: '📘 Wiktionary (en)',
    showFor: ALWAYS,
    url: (w) => `https://en.wiktionary.org/wiki/${enc(w)}`,
  },

  // ── Web ──────────────────────────────────────────────────────────────────
  {
    key: 'google',
    group: 'web',
    label: '🔍 Google',
    showFor: ALWAYS,
    url: (w) => `https://www.google.com/search?q=${enc(w)}`,
  },
];

const GROUP_DEFS: GroupDef[] = [
  { id: 'ua-dict', label: '🇺🇦 Словники' },
  { id: 'translate', label: '🌐 Переклад' },
  { id: 'web', label: '🔍 Веб' },
];

// ── Defaults ──────────────────────────────────────────────────────────────────
const DEFAULT_CHECKED: Record<string, boolean> = Object.fromEntries(
  ALL_SEARCHES.map((s) => [s.key, s.key === 'goroh_decl' || s.key === 'google']),
);

// ── localStorage persistence ──────────────────────────────────────────────────
const STORAGE_KEY = 'versesense.ecm';

function loadSettings(): EcmSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<EcmSettings>;
      return {
        checked: { ...DEFAULT_CHECKED, ...(p.checked ?? {}) },
        hidden: Array.isArray(p.hidden) ? p.hidden : [],
      };
    }
  } catch {
    /* ignore */
  }
  return { checked: { ...DEFAULT_CHECKED }, hidden: [] };
}

const settings = reactive<EcmSettings>(loadSettings());

watch(
  settings,
  () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  },
  { deep: true },
);

// ── Tab-mode preference: 'focus' (switch to new tab) | 'background' (stay here) ──
const BG_KEY = 'versesense.ecm.bgTabs';
const openInBackground = ref<boolean>(localStorage.getItem(BG_KEY) !== 'false');
watch(openInBackground, (val) => {
  try {
    localStorage.setItem(BG_KEY, String(val));
  } catch {
    /* ignore */
  }
});

// ── Props / emits ─────────────────────────────────────────────────────────────
const props = defineProps<{
  visible: boolean;
  word: string | null;
  x: number;
  y: number;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'copy'): void;
  (e: 'cut'): void;
  (e: 'paste'): void;
  (e: 'transform', kind: 'capitalize' | 'lowercase' | 'uppercase'): void;
}>();

// ── Word script info ──────────────────────────────────────────────────────────
const wordInfo = computed<WordScriptInfo>(() =>
  props.word
    ? getWordScriptInfo(props.word)
    : { script: 'other', lockedLanguage: null, allowedLanguages: [] },
);

// ── Menu position ─────────────────────────────────────────────────────────────
const menuEl = ref<HTMLElement | null>(null);

const menuStyle = computed(() => {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
  return {
    left: `${Math.max(4, Math.min(props.x, vw - 308))}px`,
    top: `${Math.max(4, Math.min(props.y, vh - 600))}px`,
  };
});

// ── Hidden panel local state ──────────────────────────────────────────────────
const showHiddenPanel = ref(false);

// ── Opened-tab tracking ──────────────────────────────────────────────────────
const openedKeys = ref(new Set<string>());

// ── Outside-click / ESC ───────────────────────────────────────────────────────
function onOutsideMousedown(e: MouseEvent) {
  if (menuEl.value && !menuEl.value.contains(e.target as Node)) emit('close');
}
function onEsc(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close');
}

watch(
  () => props.visible,
  (vis) => {
    if (vis) {
      showHiddenPanel.value = false;
      openedKeys.value = new Set();
      setTimeout(() => {
        document.addEventListener('mousedown', onOutsideMousedown);
        document.addEventListener('keydown', onEsc);
      }, 0);
    } else {
      document.removeEventListener('mousedown', onOutsideMousedown);
      document.removeEventListener('keydown', onEsc);
    }
  },
);

onUnmounted(() => {
  document.removeEventListener('mousedown', onOutsideMousedown);
  document.removeEventListener('keydown', onEsc);
});

// ── Visible search groups ─────────────────────────────────────────────────────
const visibleGroups = computed(() => {
  const info = wordInfo.value;
  return GROUP_DEFS.map((grp) => ({
    ...grp,
    searches: ALL_SEARCHES.filter(
      (s) => s.group === grp.id && s.showFor(info) && !settings.hidden.includes(s.key),
    ),
  })).filter((grp) => grp.searches.length > 0);
});

const allHiddenSearches = computed(() =>
  ALL_SEARCHES.filter((s) => settings.hidden.includes(s.key)),
);

// ── Hide / unhide ─────────────────────────────────────────────────────────────
function hide(key: string) {
  if (!settings.hidden.includes(key)) {
    settings.hidden.push(key);
    settings.checked[key] = false;
  }
}
function unhide(key: string) {
  const idx = settings.hidden.indexOf(key);
  if (idx !== -1) settings.hidden.splice(idx, 1);
}

// ── Edit operations ───────────────────────────────────────────────────────────
function onCopy() {
  emit('copy');
  emit('close');
}
function onCut() {
  emit('cut');
  emit('close');
}
function onPaste() {
  emit('paste');
  emit('close');
}
function doTransform(kind: 'capitalize' | 'lowercase' | 'uppercase') {
  emit('transform', kind);
  emit('close');
}

// ── Searches ──────────────────────────────────────────────────────────────────
function markOpened(key: string) {
  openedKeys.value = new Set(openedKeys.value).add(key);
}

function handleSearchClick(s: SearchDef) {
  if (!props.word) return;
  markOpened(s.key);
  const url = s.url(props.word);
  if (openInBackground.value) {
    // Simulate Ctrl+Click — the browser natively interprets this as
    // "open in background tab" without transferring focus.
    // This works cross-browser because it mimics a real user gesture.
    const a = document.createElement('a');
    a.href = url;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
    document.body.removeChild(a);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
</script>

<style scoped lang="scss">
.ecm {
  position: fixed;
  z-index: 9999;
  width: 304px;
  max-height: 85vh;
  overflow-y: auto;
  background: #16162a;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  box-shadow:
    0 16px 48px rgba(0, 0, 0, 0.8),
    0 0 0 1px rgba(255, 255, 255, 0.04);
  user-select: none;
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.88);

  // ── Header ────────────────────────────────────────────────────────────────
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 14px 7px;
    background: rgba(255, 255, 255, 0.04);
  }

  &__word {
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: #e2c66e;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  // ── Hidden-reveal button (top-right) ──────────────────────────────────────
  &__reveal-btn {
    display: flex;
    align-items: center;
    gap: 3px;
    flex-shrink: 0;
    margin-left: 8px;
    padding: 2px 6px;
    background: rgba(255, 100, 80, 0.12);
    border: 1px solid rgba(255, 100, 80, 0.25);
    border-radius: 5px;
    color: rgba(255, 150, 130, 0.85);
    cursor: pointer;
    font-size: 0.72rem;
    transition: background 0.1s;

    &:hover {
      background: rgba(255, 100, 80, 0.22);
    }
    &--open {
      background: rgba(255, 100, 80, 0.22);
    }
  }

  &__reveal-icon {
    font-size: 0.88rem !important;
    line-height: 1;
  }
  &__reveal-count {
    font-weight: 700;
  }

  // ── Hidden items panel ────────────────────────────────────────────────────
  &__hidden-panel {
    background: rgba(255, 100, 80, 0.05);
    border-bottom: 1px solid rgba(255, 100, 80, 0.12);
    padding: 3px 0;
  }

  &__hidden-row {
    display: flex;
    align-items: center;
    padding: 2px 12px;
    &:hover {
      background: rgba(255, 255, 255, 0.04);
    }
  }

  &__hidden-label {
    flex: 1;
    font-size: 0.78rem;
    color: rgba(255, 255, 255, 0.45);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__hidden-empty {
    font-size: 0.78rem;
    color: rgba(255, 255, 255, 0.28);
    padding: 3px 14px;
    font-style: italic;
  }

  &__unhide-btn {
    background: none;
    border: none;
    color: rgba(255, 200, 130, 0.55);
    cursor: pointer;
    padding: 2px;
    border-radius: 3px;
    display: flex;
    align-items: center;
    .material-icons {
      font-size: 0.85rem !important;
    }
    &:hover {
      color: #e2c66e;
    }
  }

  // ── Divider / group title ─────────────────────────────────────────────────
  &__divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.07);
    margin: 2px 0;
  }

  &__group-title {
    padding: 5px 14px 2px;
    font-size: 0.67rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.32);
  }

  // ── Edit actions ──────────────────────────────────────────────────────────
  &__action-row {
    display: flex;
    padding: 4px 6px;
    gap: 2px;
  }

  &__action-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 6px 4px;
    background: none;
    border: none;
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    font-size: 0.71rem;
    line-height: 1.2;
    transition:
      background 0.1s,
      color 0.1s;

    &:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.08);
      color: #fff;
    }
    &:disabled {
      opacity: 0.35;
      cursor: default;
    }
  }

  &__action-icon {
    font-size: 1.1rem !important;
    line-height: 1;
  }

  &__case-row {
    display: flex;
    gap: 4px;
    padding: 0 10px 6px;
  }

  &__case-btn {
    flex: 1;
    padding: 4px 6px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 5px;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    font-size: 0.82rem;
    font-weight: 700;
    transition:
      background 0.1s,
      color 0.1s;

    &:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.12);
      color: #fff;
    }
    &:disabled {
      opacity: 0.35;
      cursor: default;
    }
  }

  // ── Search rows ───────────────────────────────────────────────────────────
  &__search-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 6px 0 10px;
    transition: background 0.08s;

    &:hover {
      background: rgba(255, 255, 255, 0.05);
      .ecm__hide-btn {
        color: rgba(255, 255, 255, 0.28);
      }
    }
  }

  &__search-lbl {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 7px;
    color: rgba(255, 255, 255, 0.78);
    text-decoration: none;
    padding: 5px 0;
    font-size: 0.82rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
    transition: color 0.1s;

    &:hover:not(&--disabled) {
      color: #fff;
    }
    &--disabled {
      opacity: 0.35;
      cursor: default;
      pointer-events: none;
    }
    &--opened {
      color: rgba(110, 220, 160, 0.75);
    }
  }

  &__search-dot {
    flex-shrink: 0;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.18);
    transition: background 0.15s;

    &--done {
      background: #6dde9a;
    }
  }

  &__hide-btn {
    flex-shrink: 0;
    background: none;
    border: none;
    color: transparent;
    cursor: pointer;
    padding: 2px 5px;
    border-radius: 3px;
    font-size: 0.85rem;
    line-height: 1;
    transition:
      color 0.1s,
      background 0.1s;

    &:hover {
      color: rgba(255, 90, 70, 0.9) !important;
      background: rgba(255, 90, 70, 0.1);
    }
  }

  // ── Footer bar (tab-mode toggle + close) ────────────────────────────────
  &__footer {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px 8px;
  }

  &__tab-toggle {
    display: flex;
    align-items: center;
    gap: 3px;
    flex-shrink: 0;
    padding: 4px 9px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.32);
    cursor: pointer;
    font-size: 0.72rem;
    white-space: nowrap;
    transition:
      background 0.1s,
      color 0.1s,
      border-color 0.1s;

    &:hover {
      background: rgba(255, 255, 255, 0.09);
      color: rgba(255, 255, 255, 0.62);
    }

    &--bg {
      color: rgba(110, 200, 255, 0.75);
      border-color: rgba(110, 200, 255, 0.22);
      background: rgba(110, 200, 255, 0.07);
    }
  }

  &__tab-icon {
    font-size: 0.85rem !important;
    line-height: 1;
  }

  // ── Close button ─────────────────────────────────────────────────────────
  &__close-btn {
    flex: 1;
    display: block;
    padding: 5px 10px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.35);
    cursor: pointer;
    font-size: 0.78rem;
    text-align: center;
    transition:
      background 0.1s,
      color 0.1s;

    &:hover {
      background: rgba(255, 255, 255, 0.09);
      color: rgba(255, 255, 255, 0.7);
    }
  }
}
</style>
