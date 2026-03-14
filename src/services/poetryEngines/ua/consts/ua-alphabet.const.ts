/**
 * Ukrainian alphabet - all valid letters (34 letters total)
 */
export const UA_ALPHABET = {
  lowercase: 'абвгґдеєжзиіїйклмнопрстуфхцчшщьюя',
  uppercase: 'АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯ',
  all: 'абвгґдеєжзиіїйклмнопрстуфхцчшщьюяАБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯ',
} as const;

/**
 * Valid characters that can appear inside words (apostrophes, hyphens, etc.)
 */
export const UA_WORD_INTERNAL_CHARS = {
  apostrophe: "'",
  hyphen: '-',
  softHyphen: '­',
  all: "'­-",
} as const;

/**
 * Combined: all valid characters for Ukrainian words (letters + internal chars)
 */
export const UA_WORD_VALID_CHARS = {
  all: `${UA_ALPHABET.all}${UA_WORD_INTERNAL_CHARS.all}`,
} as const;

/**
 * Ukrainian vowel letters (all case variants).
 * Used for syllable counting and auto-stress on monosyllabic words.
 * а е є и і ї о у ю я
 */
export const UA_VOWELS = new Set<string>([
  'а',
  'е',
  'є',
  'и',
  'і',
  'ї',
  'о',
  'у',
  'ю',
  'я',
  'А',
  'Е',
  'Є',
  'И',
  'І',
  'Ї',
  'О',
  'У',
  'Ю',
  'Я',
]);
