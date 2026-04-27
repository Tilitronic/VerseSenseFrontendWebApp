import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { DarkMode, ToolbarMode } from './localConfig';
import { getLocalConfig, updateLocalConfig } from './localConfig';

export const useAppStore = defineStore('app', () => {
  // Initialize directly from localStorage
  const config = getLocalConfig();
  const darkMode = ref<DarkMode>(config.darkMode);
  const toolbarMode = ref<ToolbarMode>(config.toolbarMode);
  const useDbStress = ref<boolean>(config.useDbStress);
  const useMlStress = ref<boolean>(config.useMlStress);

  // Update dark mode and sync to localStorage
  function setDarkMode(mode: DarkMode) {
    darkMode.value = mode;
    updateLocalConfig({ darkMode: mode });
  }

  // Update toolbar mode and sync to localStorage
  function setToolbarMode(mode: ToolbarMode) {
    toolbarMode.value = mode;
    updateLocalConfig({ toolbarMode: mode });
  }

  function setUseDbStress(val: boolean) {
    useDbStress.value = val;
    updateLocalConfig({ useDbStress: val });
  }

  function setUseMlStress(val: boolean) {
    useMlStress.value = val;
    updateLocalConfig({ useMlStress: val });
  }

  return {
    darkMode,
    toolbarMode,
    useDbStress,
    useMlStress,
    setDarkMode,
    setToolbarMode,
    setUseDbStress,
    setUseMlStress,
  };
});
