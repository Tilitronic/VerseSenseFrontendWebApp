<template>
  <div class="lp-root">
    <!-- ── Words column (fills available width) ────────────────────── -->
    <div class="lp-row">
      <template v-for="tok in line.tokens" :key="tok.id">
        <span v-if="tok.kind === 'TAB'" class="lp-tab" />
        <span v-else-if="tok.kind === 'GAP'" class="lp-gap" />
        <span v-else-if="tok.kind === 'HYPHEN'" class="lp-hyphen" />

        <!-- Word box: chars on top, lang badge/dropdown below, aligned left -->
        <span v-else-if="tok.kind === 'WORD'" class="lp-word">
          <!-- Chars row -->
          <span class="lp-word__chars">
            <span
              v-for="slot in getCharSlots(tok)"
              :key="slot.index"
              :class="[
                'lp-char',
                slot.isVowel ? 'lp-char--vowel' : 'lp-char--consonant',
                isStressedVowel(tok, slot) ? 'lp-char--stressed' : '',
              ]"
              @click="slot.isVowel ? setStress(tok, slot) : undefined"
              >{{ slot.char }}</span
            >
          </span>

          <!-- Lang row -->
          <span class="lp-word__lang">
            <!-- 100% confidence lock: script uniquely determines language -->
            <span
              v-if="wordInfo(tok).locked"
              class="lp-lang-badge lp-lang-badge--locked"
              :title="LANGUAGE_META[tok.language].label + ' (locked by script)'"
              >{{ langCode(tok.language) }}</span
            >

            <!-- Single script-valid option: static badge, nothing to choose -->
            <span
              v-else-if="wordInfo(tok).options.length === 1"
              class="lp-lang-badge lp-lang-badge--single"
              :class="{ 'lp-lang-badge--unconfirmed': !isWordConfirmed(tok) }"
              :title="LANGUAGE_META[tok.language].label + ' (only option)'"
              >{{ langCode(tok.language) }}</span
            >

            <!-- Multiple options: active dropdown -->
            <q-btn-dropdown
              v-else
              flat
              dense
              no-caps
              no-icon-animation
              class="lp-lang-btn"
              :label="langCode(tok.language)"
              :title="LANGUAGE_META[tok.language].label"
            >
              <q-list dense style="min-width: 140px">
                <q-item
                  v-for="lang in wordInfo(tok).options"
                  :key="lang"
                  clickable
                  v-close-popup
                  :active="tok.language === lang"
                  @click="setLanguage(tok, lang)"
                >
                  <q-item-section>
                    <span class="lp-lang-opt">
                      <span>{{ LANGUAGE_META[lang].flag }}</span>
                      <span>{{ LANGUAGE_META[lang].label }}</span>
                    </span>
                  </q-item-section>
                  <q-item-section side v-if="tok.language === lang">
                    <q-icon name="check" size="xs" />
                  </q-item-section>
                </q-item>
              </q-list>
            </q-btn-dropdown>
          </span>
        </span>
      </template>
    </div>

    <!-- ── Confirm column: always visible, indicates validation status ─────── -->
    <button
      class="lp-confirm"
      :class="{
        'lp-confirm--confirmed': lineConfirmed,
        'lp-confirm--unconfirmed': lineAllStressesSet && !lineConfirmed,
        'lp-confirm--disabled': !lineAllStressesSet && !lineConfirmed,
      }"
      :disabled="!lineAllStressesSet"
      :title="
        lineConfirmed
          ? 'Click to unconfirm this line'
          : lineAllStressesSet
            ? 'Confirm auto-detected languages for this line'
            : 'Set all stresses first'
      "
      @click="toggleConfirmLine"
    >
      <span class="material-icons lp-confirm__icon">
        {{ lineConfirmed ? 'check_circle' : 'radio_button_unchecked' }}
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { usePoetryStore } from 'src/stores/poetry';
import type { IWordToken, ILine } from 'src/model/Token';
import { LANGUAGE_META, type Language } from 'src/model/Language';
import {
  getWordCharSlots,
  vowelCharIndex,
  type CharSlot,
} from 'src/services/poetryEngines/shared/wordVowels';
import { getWordScriptInfo } from 'src/services/languageDetection/wordScript';

const props = defineProps<{ line: ILine }>();

const store = usePoetryStore();

/** Whether every non-locked word on this line has been confirmed */
const lineConfirmed = computed(() => store.isLineConfirmed(props.line.id));

/** Whether every word on this line has stress set (auto or manual).
 *  Zero-vowel words (e.g. "з", "в") report 'auto' in wordStressStatus
 *  so they never block this check.
 *  Punctuation-only tokens (e.g. "—") are excluded. */
const lineAllStressesSet = computed(() => {
  const words = props.line.tokens.filter(
    (t): t is IWordToken => t.kind === 'WORD' && /\p{L}/u.test(t.text),
  );
  if (words.length === 0) return false;
  return words.every((w) => store.wordStressStatus.get(w.id) !== 'unset');
});

/** Whether a specific word token has been confirmed */
function isWordConfirmed(tok: IWordToken): boolean {
  const { lockedLanguage } = getWordScriptInfo(tok.text);
  if (lockedLanguage !== null) return true; // locked = implicitly confirmed
  return store.confirmedWords.has(tok.id);
}

function toggleConfirmLine() {
  if (lineConfirmed.value) {
    store.unconfirmLine(props.line.id);
  } else {
    store.confirmLine(props.line.id);
  }
}

function getCharSlots(tok: IWordToken): CharSlot[] {
  return getWordCharSlots(tok.text, tok.language);
}

function isStressedVowel(tok: IWordToken, slot: CharSlot): boolean {
  if (!slot.isVowel || tok.stressIndex === null) return false;
  return vowelCharIndex(tok.text, tok.language, tok.stressIndex) === slot.index;
}

function setStress(tok: IWordToken, slot: CharSlot) {
  if (!slot.isVowel) return;
  let ord = 0;
  for (const s of getCharSlots(tok)) {
    if (!s.isVowel) continue;
    if (s.index === slot.index) {
      store.setWordStress(tok.id, ord);
      return;
    }
    ord++;
  }
}

/** Returns display metadata for a word's language control */
function wordInfo(tok: IWordToken): { locked: boolean; options: Language[] } {
  const { lockedLanguage, allowedLanguages } = getWordScriptInfo(tok.text);
  if (lockedLanguage !== null) {
    return { locked: true, options: [] };
  }
  return { locked: false, options: allowedLanguages };
}

function setLanguage(tok: IWordToken, lang: Language) {
  store.setWordLanguage(tok.id, lang);
}

function langCode(lang: Language): string {
  const map: Record<Language, string> = { ua: 'UA', pl: 'PL', 'en-us': 'EN', 'en-gb': 'GB' };
  return map[lang] ?? lang.toUpperCase();
}
</script>

<style scoped lang="scss">
.lp-root {
  display: flex;
  flex-direction: row; // words column + optional confirm column
  align-items: stretch;
  width: 100%; // fill the alt-root row so lp-row can flex-grow
  min-width: 0;
  gap: 0;
}

.lp-row {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: row;
  align-items: flex-end; // bottom-align so taller word-boxes don't shift shorter ones
  flex-wrap: nowrap;
}

.lp-tab {
  display: inline-block;
  width: 1ch;
}
.lp-gap {
  display: inline-block;
  width: 1ch;
}
.lp-hyphen {
  // Renders as a short horizontal line aligned to the char row midline.
  // align-self: flex-start keeps it at the top (char row) not the bottom (badge row).
  display: inline-flex;
  align-self: flex-start;
  align-items: center;
  height: 1.6rem; // matches lp-word__chars line-height
  padding: 0 1px;
  color: rgba(255, 255, 255, 0.3);
  font-size: 1rem;
  line-height: 1.6;
  &::before {
    content: '-';
  }
}

// Per-word vertical box — width = max(chars width, badge width)
.lp-word {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start; // left-align both rows

  // Chars row: let it be as wide as the content naturally is
  &__chars {
    display: flex;
    flex-direction: row;
    align-items: center;
    line-height: 1.6;
    white-space: nowrap;
  }

  // Lang row: left-aligned, no extra width forcing
  &__lang {
    display: flex;
    align-items: center;
    margin-top: 1px;
  }
}

// ── Stress chars ─────────────────────────────────────────────────────────────

.lp-char {
  display: inline-block;
  font-size: 1rem;
  line-height: 1.6;

  &--consonant {
    color: rgba(255, 255, 255, 0.3);
    cursor: default;
  }

  &--vowel {
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    border-radius: 3px;
    padding: 0 1px;
    transition:
      background 0.12s,
      color 0.12s;
    &:hover {
      background: rgba(100, 180, 255, 0.18);
      color: #fff;
    }
  }

  &--stressed {
    color: #fff !important;
    background: rgba(100, 220, 130, 0.28) !important;
    border-bottom: 2px solid rgba(80, 220, 100, 0.85);
    font-weight: 600;
  }
}

// ── Language row ─────────────────────────────────────────────────────────────

.lp-lang-badge,
.lp-lang-btn {
  font-size: 0.62rem;
  letter-spacing: 0.06em;
  font-family: inherit;
  line-height: 1;
  padding: 1px 4px;
  border-radius: 3px;
  min-height: unset;
  height: auto;
}

.lp-lang-badge {
  display: inline-block;
  cursor: default;

  // 100% locked by script — nearly invisible, purely informational
  &--locked {
    color: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.07);
  }

  // Only one script-valid option — clearly readable but obviously non-interactive
  &--single {
    color: rgba(255, 255, 255, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  // Unconfirmed auto-detected — orange tint to signal it needs user attention
  &--unconfirmed {
    color: rgba(255, 140, 30, 0.9);
    border-color: rgba(255, 140, 30, 0.4);
  }
}

// ── Confirm strip — always-visible narrow right column, icon only ──────────

.lp-confirm {
  flex-shrink: 0;
  position: sticky; // always visible at right edge even when words scroll
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px; // fixed narrow column, always occupies space
  margin-left: 4px;
  border: none;
  border-left: 1px solid rgba(255, 255, 255, 0.07); // default separator
  background: #12121c; // match panel bg so sticky clip looks clean
  padding: 0;
  outline: none;
  transition:
    background 0.12s,
    border-color 0.12s;

  &__icon {
    font-size: 14px;
    user-select: none;
    transition: color 0.12s;
  }

  // ── State: no stresses yet — barely visible, no cursor ─────────────────
  &--disabled {
    cursor: default;
    border-left-color: rgba(255, 255, 255, 0.07);
    &:hover {
      background: #12121c;
    }
    .lp-confirm__icon {
      color: rgba(255, 255, 255, 0.12);
    }
  }

  // ── State: all stresses set, awaiting confirmation — orange, clickable ──
  &--unconfirmed {
    cursor: pointer;
    border-left-color: rgba(255, 140, 30, 0.3);
    &:hover {
      background: mix(#12121c, rgba(255, 140, 30, 0.18), 50%);
    }
    .lp-confirm__icon {
      color: rgba(255, 140, 30, 0.85);
    }
    &:hover .lp-confirm__icon {
      color: rgba(255, 160, 60, 1);
    }
  }

  // ── State: confirmed — green, clickable (toggles back to unconfirmed) ─────
  &--confirmed {
    cursor: pointer;
    border-left-color: rgba(80, 220, 100, 0.2);
    &:hover {
      background: mix(#12121c, rgba(80, 220, 100, 0.12), 50%);
    }
    .lp-confirm__icon {
      color: rgba(80, 220, 100, 0.65);
    }
    &:hover .lp-confirm__icon {
      color: rgba(80, 220, 100, 1);
    }
  }
}

.lp-lang-btn {
  // Active dropdown — full brightness + tinted border signals interactivity
  color: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(100, 180, 255, 0.5);
  background: rgba(100, 180, 255, 0.08);
  &:hover {
    color: #fff;
    border-color: rgba(100, 180, 255, 0.8);
    background: rgba(100, 180, 255, 0.15);
  }

  :deep(.q-btn__content) {
    font-size: 0.62rem;
    letter-spacing: 0.06em;
    font-family: inherit;
  }
  :deep(.q-btn-dropdown__arrow) {
    font-size: 9px;
    margin-left: 1px;
  }
}

.lp-lang-opt {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
}
</style>
