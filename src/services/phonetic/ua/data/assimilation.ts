/**
 * Ukrainian voicing assimilation rules — regressive assimilation of obstruents.
 *
 * Sources:
 *   Тоцька Н. І. (1997) — Фонетика, фонологія, орфоепія, графіка
 *   Мойсієнко А. К. et al. (2010) — Сучасна українська літературна мова
 */
export default {
  _meta: {
    description: 'Ukrainian voicing assimilation rules — regressive assimilation of obstruents',
    sources: [
      'Тоцька Н. І. (1997) — Фонетика, фонологія, орфоепія, графіка',
      'Мойсієнко А. К. et al. (2010) — Сучасна українська літературна мова',
    ],
  },

  regressiveVoicing: {
    _doc: 'A voiceless obstruent becomes voiced before a voiced obstruent. Direction: right-to-left scan.',
    examples: [
      { word: 'просьба',  underlying: 'prɔsʲbɑ', surface: 'prɔzʲbɑ',  rule: 'sʲ→zʲ before b' },
      { word: 'вокзал',   underlying: 'ʋɔkzɑl',  surface: 'ʋɔɡzɑl',   rule: 'k→ɡ before z'   },
      { word: 'боротьба', underlying: 'bɔrɔtʲbɑ', surface: 'bɔrɔdʲbɑ', rule: 'tʲ→dʲ before b' },
      { word: 'молотьба', underlying: 'mɔlɔtʲbɑ', surface: 'mɔlɔdʲbɑ', rule: 'tʲ→dʲ before b' },
      { word: 'легко',    underlying: 'lɛɦkɔ',    surface: 'lɛxkɔ',     rule: 'ɦ→x before k (devoicing)' },
      { word: 'нігті',    underlying: 'nʲiɦtʲi',  surface: 'nʲixtʲi',   rule: 'ɦ→x before t'   },
    ],
  },

  regressiveDevoicing: {
    _doc: 'A voiced obstruent becomes voiceless before a voiceless obstruent. Direction: right-to-left scan.',
    note: 'Ukrainian does NOT have systematic word-final devoicing (unlike Russian/German). Only cluster assimilation.',
    examples: [
      { word: 'легко', rule: 'ɦ→x before k' },
      { word: 'кігті', rule: 'ɦ→x before tʲ' },
    ],
  },

  sonorantExemption: {
    _doc: 'Sonorants (m, n, nʲ, l, lʲ, r, rʲ, ʋ, j) do NOT trigger voicing assimilation and are NOT affected by it.',
    sonorants: ['m', 'n', 'nʲ', 'l', 'lʲ', 'r', 'rʲ', 'ʋ', 'j', 'w', 'u̯'],
  },

  obstruents: {
    voiced:    ['b', 'd', 'dʲ', 'ɡ', 'z', 'zʲ', 'ʒ', 'ɦ', 'dz', 'dzʲ', 'dʒ'],
    voiceless: ['p', 't', 'tʲ', 'k', 's', 'sʲ', 'ʃ', 'x', 'f', 'ts', 'tsʲ', 'tʃ'],
  },

  voicingPairs: {
    p:  'b',   b:  'p',
    t:  'd',   d:  't',
    'tʲ': 'dʲ',  'dʲ': 'tʲ',
    k:  'ɡ',   'ɡ':  'k',
    s:  'z',   z:  's',
    'sʲ': 'zʲ',  'zʲ': 'sʲ',
    'ʃ':  'ʒ',   'ʒ':  'ʃ',
    x:  'ɦ',   'ɦ':  'x',
    f:  'ʋ',
    ts: 'dz',  dz: 'ts',
    'tsʲ': 'dzʲ', 'dzʲ': 'tsʲ',
    'tʃ': 'dʒ',  'dʒ': 'tʃ',
  } as Record<string, string>,
};
