import type { FontFamily } from 'stores/localConfig';

/**
 * Font family options for the application
 */
export interface FontOption {
  label: string;
  value: FontFamily;
  family: string;
}

export const FONT_OPTIONS: FontOption[] = [
  {
    label: 'JetBrains Mono',
    value: 'mono-jb',
    family: "'JetBrains Mono', 'Fira Code', monospace",
  },
  {
    label: 'Cascadia Code',
    value: 'mono-cascadia',
    family: "'Cascadia Code', 'Cascadia Mono', 'Consolas', monospace",
  },
  {
    label: 'Fira Code',
    value: 'mono-fira',
    family: "'Fira Code', 'Fira Mono', monospace",
  },
  {
    label: 'Consolas',
    value: 'mono-consolas',
    family: "'Consolas', 'Courier New', monospace",
  },
];

/**
 * Get font family CSS string by font type
 */
export function getFontFamily(font: FontFamily): string {
  const option = FONT_OPTIONS.find((opt) => opt.value === font);
  return option?.family || FONT_OPTIONS[0]!.family;
}
