import type { MessageLanguages } from 'src/boot/i18n';

export type DarkMode = 'auto' | 'on' | 'off';
export type ToolbarMode = 'active' | 'all';

export interface LocalConfig {
  darkMode: DarkMode;
  toolbarMode: ToolbarMode;
  useDbStress: boolean;
  useMlStress: boolean;
  locale: MessageLanguages;
}

export const DEFAULT_LOCAL_CONFIG: LocalConfig = {
  darkMode: 'auto',
  toolbarMode: 'all',
  useDbStress: true,
  useMlStress: true,
  locale: 'uk',
};

const LOCAL_STORAGE_KEY = 'localConfig';

const VALID_LOCALES: ReadonlySet<string> = new Set(['uk', 'pl', 'be', 'en-US']);

export function getLocalConfig(): LocalConfig {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Record<string, unknown>;
      const toolbarMode: ToolbarMode =
        parsed['toolbarMode'] === 'active' ? 'active' : DEFAULT_LOCAL_CONFIG.toolbarMode;
      const useDbStress: boolean = parsed['useDbStress'] !== false;
      const useMlStress: boolean = parsed['useMlStress'] !== false;
      // Accept locale from localConfig; fall back to legacy standalone 'locale' key
      const raw = parsed['locale'] ?? localStorage.getItem('locale');
      const locale: MessageLanguages =
        typeof raw === 'string' && VALID_LOCALES.has(raw)
          ? (raw as MessageLanguages)
          : DEFAULT_LOCAL_CONFIG.locale;
      return { ...DEFAULT_LOCAL_CONFIG, ...parsed, toolbarMode, useDbStress, useMlStress, locale };
    }
  } catch (error) {
    console.error('Failed to parse localStorage config:', error);
  }
  return DEFAULT_LOCAL_CONFIG;
}

export function saveLocalConfig(config: LocalConfig): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Failed to save localStorage config:', error);
  }
}

export function updateLocalConfig(updates: Partial<LocalConfig>): LocalConfig {
  const config = getLocalConfig();
  const updated = { ...config, ...updates };
  saveLocalConfig(updated);
  return updated;
}
