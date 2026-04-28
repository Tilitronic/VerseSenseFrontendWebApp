<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated class="layout-header">
      <q-toolbar>
        <q-btn flat dense round icon="menu" aria-label="Menu" @click="toggleLeftDrawer" />

        <q-toolbar-title> VerseSense </q-toolbar-title>

        <!-- Language switcher -->
        <q-btn flat dense no-caps class="lang-btn q-mr-xs" size="sm">
          <LangFlag :lang="currentLang.value" class="q-mr-xs" />
          <span class="lang-label">{{ currentLang.code }}</span>
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
                  <LangFlag :lang="lang.value" />
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
import LangFlag from 'src/components/LangFlag.vue';
import { updateLocalConfig } from 'src/stores/localConfig';

const router = useRouter();
const route = useRoute();
const { locale } = useI18n();

const leftDrawerOpen = ref(false);

const langs: Array<{ value: MessageLanguages; label: string; code: string }> = [
  { value: 'uk', label: 'Українська', code: 'UA' },
  { value: 'pl', label: 'Polski', code: 'PL' },
  { value: 'be', label: 'Беларуская', code: 'BE' },
  { value: 'en-US', label: 'English', code: 'EN' },
];

const currentLang = computed(() => langs.find((l) => l.value === locale.value) ?? langs[0]!);

function setLocale(code: MessageLanguages) {
  locale.value = code;
  try {
    updateLocalConfig({ locale: code });
  } catch {
    /* SSR safety */
  }
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

.lang-label {
  font-size: 0.72rem;
}
</style>
