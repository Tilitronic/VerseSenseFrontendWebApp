import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { DarkMode, FontFamily, ToolbarMode } from './localConfig';
import { getLocalConfig, updateLocalConfig } from './localConfig';

export const useAppStore = defineStore('app', () => {
  // Initialize directly from localStorage
  const config = getLocalConfig();
  const darkMode = ref<DarkMode>(config.darkMode);
  const fontFamily = ref<FontFamily>(config.fontFamily);
  const toolbarMode = ref<ToolbarMode>(config.toolbarMode);

  // Update dark mode and sync to localStorage
  function setDarkMode(mode: DarkMode) {
    darkMode.value = mode;
    updateLocalConfig({ darkMode: mode });
  }

  // Update font family and sync to localStorage
  function setFontFamily(font: FontFamily) {
    fontFamily.value = font;
    updateLocalConfig({ fontFamily: font });
  }

  // Update toolbar mode and sync to localStorage
  function setToolbarMode(mode: ToolbarMode) {
    toolbarMode.value = mode;
    updateLocalConfig({ toolbarMode: mode });
  }

  return {
    darkMode,
    fontFamily,
    toolbarMode,
    setDarkMode,
    setFontFamily,
    setToolbarMode,
  };
});
