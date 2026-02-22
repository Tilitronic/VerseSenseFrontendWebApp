<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated>
      <q-toolbar>
        <q-btn flat dense round icon="menu" aria-label="Menu" @click="toggleLeftDrawer" />

        <q-toolbar-title> VerseSense </q-toolbar-title>

        <!-- dark/light theme switcher (disabled — app uses a fixed dark theme) -->
        <!-- <q-btn
          flat
          dense
          round
          :icon="$q.dark.isActive ? 'light_mode' : 'dark_mode'"
          aria-label="Toggle Dark Mode"
          @click="toggleDarkMode"
        >
          <q-tooltip>{{ $q.dark.isActive ? 'Light Mode' : 'Dark Mode' }}</q-tooltip>
        </q-btn> -->

        <div class="q-mx-md">Quasar v{{ $q.version }}</div>
      </q-toolbar>
    </q-header>

    <q-drawer v-model="leftDrawerOpen" bordered side="left">
      <q-list>
        <q-item-label header> Navigation </q-item-label>

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
            <q-item-label>Main</q-item-label>
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
            <q-item-label>About</q-item-label>
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
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
// import { Dark } from 'quasar';       // unused — dark mode toggle is disabled
// import { useAppStore } from 'stores/app'; // unused — dark mode toggle is disabled
const router = useRouter();
const route = useRoute();

const leftDrawerOpen = ref(false);

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value;
}

// dark/light mode toggle — commented out together with its button
// function toggleDarkMode() {
//   Dark.toggle();
//   const newDarkMode = Dark.isActive ? 'on' : 'off';
//   appStore.setDarkMode(newDarkMode);
// }

function navigateTo(path: string) {
  void router.push(path);
  leftDrawerOpen.value = false;
}

function isActive(path: string): boolean {
  return route.path === path;
}
</script>
