export type DarkMode = 'auto' | 'on' | 'off';
export type ToolbarMode = 'active' | 'all';

export interface LocalConfig {
  darkMode: DarkMode;
  toolbarMode: ToolbarMode;
}

export const DEFAULT_LOCAL_CONFIG: LocalConfig = {
  darkMode: 'auto',
  toolbarMode: 'active',
};

const LOCAL_STORAGE_KEY = 'localConfig';

export function getLocalConfig(): LocalConfig {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Record<string, unknown>;
      const toolbarMode: ToolbarMode =
        parsed['toolbarMode'] === 'all' ? 'all' : DEFAULT_LOCAL_CONFIG.toolbarMode;
      return { ...DEFAULT_LOCAL_CONFIG, ...parsed, toolbarMode };
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
