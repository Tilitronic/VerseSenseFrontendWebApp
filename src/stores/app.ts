import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Language } from 'src/model/Language';
import type { DarkMode, ToolbarMode } from './localConfig';
import { getLocalConfig, updateLocalConfig } from './localConfig';

export const useAppStore = defineStore('app', () => {
  // Initialize directly from localStorage
  const config = getLocalConfig();
  const darkMode = ref<DarkMode>(config.darkMode);
  const toolbarMode = ref<ToolbarMode>(config.toolbarMode);
  const useDbStress = ref<boolean>(config.useDbStress);
  const useMlStress = ref<boolean>(config.useMlStress);
  const enabledLanguages = ref<Record<Language, boolean>>({ ...config.enabledLanguages });
  const spellcheckEnabled = ref<boolean>(config.spellcheckEnabled);
  const ltEnabled = ref<boolean>(config.ltEnabled);

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

  function setLanguageEnabled(lang: Language, enabled: boolean) {
    const next = { ...enabledLanguages.value, [lang]: enabled };
    if (!Object.values(next).some(Boolean)) return;
    enabledLanguages.value = next;
    updateLocalConfig({ enabledLanguages: next });
  }

  function isLanguageEnabled(lang: Language): boolean {
    return enabledLanguages.value[lang] !== false;
  }

  function setSpellcheckEnabled(val: boolean) {
    spellcheckEnabled.value = val;
    updateLocalConfig({ spellcheckEnabled: val });
  }

  function setLtEnabled(val: boolean) {
    ltEnabled.value = val;
    updateLocalConfig({ ltEnabled: val });
  }

  return {
    darkMode,
    toolbarMode,
    useDbStress,
    useMlStress,
    enabledLanguages,
    spellcheckEnabled,
    ltEnabled,
    setDarkMode,
    setToolbarMode,
    setUseDbStress,
    setUseMlStress,
    setLanguageEnabled,
    isLanguageEnabled,
    setSpellcheckEnabled,
    setLtEnabled,
  };
});
