export type DarkMode = 'auto' | 'on' | 'off';
export type FontFamily = 'mono-jb' | 'mono-cascadia' | 'mono-fira' | 'mono-consolas';
export type ToolbarMode = 'active' | 'all';

const VALID_FONTS: FontFamily[] = ['mono-jb', 'mono-cascadia', 'mono-fira', 'mono-consolas'];
/** Map legacy stored values to current ones */
const FONT_MIGRATIONS: Record<string, FontFamily> = { mono: 'mono-jb', sans: 'mono-jb', serif: 'mono-jb' };

export interface LocalConfig {
  darkMode: DarkMode;
  fontFamily: FontFamily;
  toolbarMode: ToolbarMode;
}

export const DEFAULT_LOCAL_CONFIG: LocalConfig = {
  darkMode: 'auto',
  fontFamily: 'mono-jb',
  toolbarMode: 'active',
};

const LOCAL_STORAGE_KEY = 'localConfig';

export function getLocalConfig(): LocalConfig {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Record<string, unknown>;
      // Migrate legacy font values
      let font = parsed['fontFamily'] as string | undefined;
      if (font && FONT_MIGRATIONS[font]) font = FONT_MIGRATIONS[font];
      if (!font || !VALID_FONTS.includes(font as FontFamily)) font = DEFAULT_LOCAL_CONFIG.fontFamily;
      const toolbarMode: ToolbarMode =
        parsed['toolbarMode'] === 'all' ? 'all' : DEFAULT_LOCAL_CONFIG.toolbarMode;
      return { ...DEFAULT_LOCAL_CONFIG, ...parsed, fontFamily: font as FontFamily, toolbarMode };
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
