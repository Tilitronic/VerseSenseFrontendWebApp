/**
 * Ukrainian vowel phoneme inventory — 6 phonemes + allophone rules.
 *
 * Sources:
 *   Савченко І. С. (2014) — Фонетика, орфоепія і графіка сучасної української мови
 *   Мойсієнко А. К. et al. (2010) — Сучасна українська літературна мова
 *
 * Vector model: 3D (backness, height, rounding)
 */
export default {
  _meta: {
    description: 'Ukrainian vowel phoneme inventory — 6 phonemes + allophone rules',
    sources: [
      'Савченко І. С. (2014) — Фонетика, орфоепія і графіка сучасної української мови',
      'Мойсієнко А. К. et al. (2010) — Сучасна українська літературна мова',
    ],
    vectorModel: '3D: (backness, height, rounding)',
    encoding: {
      backness: { front: 1, central: 2, back: 3 },
      height: { high: 3, 'high-mid': 2.5, mid: 2, low: 1 },
      rounding: { unrounded: 0, rounded: 1 },
    },
  },
  phonemes: [
    {
      ipa: 'i',
      cyrillic: 'і',
      height: 'high',
      backness: 'front',
      rounding: 'unrounded',
      stable: true,
    },
    {
      ipa: 'ɪ',
      cyrillic: 'и',
      height: 'high-mid',
      backness: 'front',
      rounding: 'unrounded',
      stable: false,
    },
    {
      ipa: 'ɛ',
      cyrillic: 'е',
      height: 'mid',
      backness: 'front',
      rounding: 'unrounded',
      stable: false,
    },
    {
      ipa: 'u',
      cyrillic: 'у',
      height: 'high',
      backness: 'back',
      rounding: 'rounded',
      stable: true,
    },
    {
      ipa: 'ɔ',
      cyrillic: 'о',
      height: 'mid',
      backness: 'back',
      rounding: 'rounded',
      stable: false,
    },
    {
      ipa: 'ɑ',
      cyrillic: 'а',
      height: 'low',
      backness: 'back',
      rounding: 'unrounded',
      stable: true,
    },
  ],
  allophones: {
    _doc: 'Rules for unstressed vowel realization. Applied in applyVowelAllophones pass.',
    rules: [
      {
        phoneme: 'ɛ',
        condition: 'unstressed',
        allophone: 'ɛ̝',
        description: 'Unstressed /е/ rises toward [и], transcribed [еи]',
      },
      {
        phoneme: 'ɪ',
        condition: 'unstressed',
        allophone: 'ɪ̞',
        description: 'Unstressed /и/ lowers toward [е], transcribed [ие]',
      },
      {
        phoneme: 'ɔ',
        condition: 'unstressed_before_high',
        allophone: 'ɔ̝',
        description:
          'Unstressed /о/ before stressed /у/ or /і/ narrows toward [у], transcribed [оу]',
      },
    ],
  },
  iotatedVowels: {
    _doc: 'Iotated vowels produce [j]+vowel or palatalize preceding consonant+vowel',
    mapping: {
      я: { vowel: 'ɑ', glide: 'j' },
      ю: { vowel: 'u', glide: 'j' },
      є: { vowel: 'ɛ', glide: 'j' },
      ї: { vowel: 'i', glide: 'j', alwaysIotated: true },
    },
    iotationContexts: ['word_initial', 'after_vowel', 'after_apostrophe', 'after_soft_sign'],
    palatalizationContext: 'after_consonant',
  },
};
