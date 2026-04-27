export type DarkMode = 'auto' | 'on' | 'off';
export type ToolbarMode = 'active' | 'all';

export interface LocalConfig {
  darkMode: DarkMode;
  toolbarMode: ToolbarMode;
  useDbStress: boolean;
  useMlStress: boolean;
}

export const DEFAULT_LOCAL_CONFIG: LocalConfig = {
  darkMode: 'auto',
  toolbarMode: 'active',
  useDbStress: true,
  useMlStress: true,
};

const LOCAL_STORAGE_KEY = 'localConfig';

export function getLocalConfig(): LocalConfig {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Record<string, unknown>;
      const toolbarMode: ToolbarMode =
        parsed['toolbarMode'] === 'all' ? 'all' : DEFAULT_LOCAL_CONFIG.toolbarMode;
      const useDbStress: boolean = parsed['useDbStress'] !== false;
      const useMlStress: boolean = parsed['useMlStress'] !== false;
      return { ...DEFAULT_LOCAL_CONFIG, ...parsed, toolbarMode, useDbStress, useMlStress };
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
