/**
 * Ukrainian Cyrillic → IPA grapheme mapping with context rules.
 *
 * This file is the single source of truth for grapheme-to-phoneme conversion.
 * Portable to Python via json.load() on the equivalent .json export.
 */
export default {
  _meta: {
    description: 'Ukrainian Cyrillic → IPA grapheme mapping with context rules',
    note: 'This file is the single source of truth for grapheme-to-phoneme conversion. Portable to Python via json.load().',
  },

  apostropheChars: ["'", '\u02bc', '\u2019', '\u0027', '\u2018', '\u0060'] as string[],
  softSign: 'ь',

  vowelGraphemes: ['а', 'е', 'є', 'и', 'і', 'ї', 'о', 'у', 'ю', 'я'] as string[],

  iotatedVowels: {
    я: { vowelIpa: 'ɑ', glide: 'j' },
    ю: { vowelIpa: 'u', glide: 'j' },
    є: { vowelIpa: 'ɛ', glide: 'j' },
    ї: { vowelIpa: 'i', glide: 'j', alwaysIotated: true },
  },

  simpleVowels: {
    а: 'ɑ',
    е: 'ɛ',
    и: 'ɪ',
    і: 'i',
    о: 'ɔ',
    у: 'u',
  } as Record<string, string>,

  consonantGraphemes: {
    б: 'b',
    в: 'ʋ',
    г: 'ɦ',
    ґ: 'ɡ',
    д: 'd',
    ж: 'ʒ',
    з: 'z',
    й: 'j',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    ф: 'f',
    х: 'x',
    ц: 'ts',
    ч: 'tʃ',
    ш: 'ʃ',
  } as Record<string, string>,

  digraphs: {
    дж: 'dʒ',
    дз: 'dz',
  } as Record<string, string>,

  composites: {
    щ: ['ʃ', 'tʃ'],
  } as Record<string, string[]>,

  softenableConsonants: [
    'd',
    'dʲ',
    't',
    'tʲ',
    'z',
    'zʲ',
    's',
    'sʲ',
    'dz',
    'dzʲ',
    'ts',
    'tsʲ',
    'l',
    'lʲ',
    'n',
    'nʲ',
    'r',
    'rʲ',
  ] as string[],

  softMap: {
    d: 'dʲ',
    t: 'tʲ',
    z: 'zʲ',
    s: 'sʲ',
    dz: 'dzʲ',
    ts: 'tsʲ',
    l: 'lʲ',
    n: 'nʲ',
    r: 'rʲ',
  } as Record<string, string>,

  vAllophones: {
    _doc: 'Ukrainian /в/ has positional allophones: [ʋ] default, [w] post-vocalic pre-consonantal, [u̯] word-final after vowel',
    default: 'ʋ',
    postVocalicPreConsonantal: 'w',
    wordFinalPostVocalic: 'u̯',
  },
};
