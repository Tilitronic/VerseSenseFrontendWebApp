<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated>
      <q-toolbar>
        <q-btn flat dense round icon="menu" aria-label="Menu" @click="toggleLeftDrawer" />

        <q-toolbar-title> VerseSense </q-toolbar-title>

        <!-- Language switcher -->
        <q-btn flat dense no-caps class="lang-btn q-mr-xs" size="sm">
          <span class="lang-flag">{{ currentLang.flag }}</span>
          <span class="lang-label q-ml-xs">{{ currentLang.label }}</span>
          <q-icon name="arrow_drop_down" size="16px" />
          <q-menu auto-close anchor="bottom right" self="top right" :offset="[0, 4]">
            <q-list dense style="min-width: 160px">
              <q-item
                v-for="lang in langs"
                :key="lang.value"
                clickable
                :active="locale === lang.value"
                active-class="text-primary"
                @click="setLocale(lang.value)"
              >
                <q-item-section side style="min-width: 28px; padding-right: 6px">
                  {{ lang.flag }}
                </q-item-section>
                <q-item-section>{{ lang.label }}</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </q-toolbar>
    </q-header>

    <q-drawer v-model="leftDrawerOpen" bordered side="left">
      <q-list>
        <q-item-label header>{{ $t('nav.navigation') }}</q-item-label>

        <q-item
          clickable
          :active="isActive('/')"
          active-class="bg-blue text-white"
          @click="navigateTo('/')"
        >
          <q-item-section avatar>
            <q-icon name="home" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ $t('nav.main') }}</q-item-label>
          </q-item-section>
        </q-item>

        <q-item
          clickable
          :active="isActive('/about')"
          active-class="bg-blue text-white"
          @click="navigateTo('/about')"
        >
          <q-item-section avatar>
            <q-icon name="info" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ $t('nav.about') }}</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import type { MessageLanguages } from 'src/boot/i18n';

const router = useRouter();
const route = useRoute();
const { locale } = useI18n();

const leftDrawerOpen = ref(false);

const langs: Array<{ value: MessageLanguages; label: string; flag: string }> = [
  { value: 'uk', label: 'Українська', flag: '🇺🇦' },
  { value: 'pl', label: 'Polski', flag: '🇵🇱' },
  { value: 'be', label: 'Беларуская', flag: '🇧🇾' },
  { value: 'en-US', label: 'English', flag: '🇬🇧' },
];

const currentLang = computed(
  () => langs.find((l) => l.value === locale.value) ?? langs[0]!,
);

function setLocale(code: MessageLanguages) {
  locale.value = code;
  try {
    localStorage.setItem('locale', code);
  } catch { /* SSR safety */ }
}

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value;
}

function navigateTo(path: string) {
  void router.push(path);
  leftDrawerOpen.value = false;
}

function isActive(path: string): boolean {
  return route.path === path;
}
</script>

<style scoped lang="scss">
.lang-btn {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  border-radius: 4px;
  padding: 2px 6px;
}

.lang-flag {
  font-size: 1rem;
  line-height: 1;
}

.lang-label {
  font-size: 0.72rem;
}
</style>

