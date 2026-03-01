/**
 * Ukrainian consonant assimilation by place of articulation.
 *
 * Sources:
 *   Савченко І. С. (2014) — Фонетика, орфоепія і графіка сучасної української мови
 *   Тоцька Н. І. (1997) — Фонетика, фонологія, орфоепія, графіка
 *   Мойсієнко А. К. et al. (2010) — Сучасна українська літературна мова
 *
 * These rules apply within words (often at morpheme boundaries).
 * The pipeline scans for IPA bigrams/trigrams and replaces them.
 */
export default {
  _meta: {
    description: 'Ukrainian consonant assimilation by place of articulation',
    sources: [
      'Савченко І. С. (2014) — Фонетика, орфоепія і графіка сучасної української мови',
      'Тоцька Н. І. (1997) — Фонетика, фонологія, орфоепія, графіка',
      'Мойсієнко А. К. et al. (2010) — Сучасна українська літературна мова',
    ],
    note: 'These rules apply within words (often at morpheme boundaries). The pipeline scans for IPA bigrams/trigrams and replaces them.',
  },

  sibilantAssimilation: {
    _doc: 'Dental sibilants assimilate to postalveolar place before postalveolar consonants. Direction: regressive (right-to-left).',
    rules: [
      {
        id: 'z_before_sh',
        description: 'з + ш → шш (зшити → шшити)',
        trigger: 'ʃ',
        target: 'z',
        result: 'ʃ',
        examples: ['зшити', 'безшумний'],
      },
      {
        id: 's_before_sh',
        description: 'с + ш → шш (вісшій → вішшій)',
        trigger: 'ʃ',
        target: 's',
        result: 'ʃ',
        examples: ['вісшій'],
      },
      {
        id: 'z_before_zh',
        description: 'з + ж → жж (зжати → жжати)',
        trigger: 'ʒ',
        target: 'z',
        result: 'ʒ',
        examples: ['зжати', 'безжурний'],
      },
      {
        id: 's_before_zh',
        description: 'с + ж → жж (Запоріжжя-style cluster — розсіяти)',
        trigger: 'ʒ',
        target: 's',
        result: 'ʒ',
        examples: [],
      },
      {
        id: 'z_before_ch',
        description: 'з + ч → шч (зчепити → шчепити)',
        trigger: 'tʃ',
        target: 'z',
        result: 'ʃ',
        examples: ['зчепити', 'безчесний'],
      },
      {
        id: 's_before_ch',
        description: 'с + ч → шч (зісчепити → зішчепити)',
        trigger: 'tʃ',
        target: 's',
        result: 'ʃ',
        examples: ['розсічка'],
      },
      {
        id: 'z_before_dzh',
        description: 'з + дж → ждж (зджерти → ждж...)',
        trigger: 'dʒ',
        target: 'z',
        result: 'ʒ',
        examples: ['зджерти'],
      },
      {
        id: 'soft_z_before_sh',
        description: 'зь + ш → шш',
        trigger: 'ʃ',
        target: 'zʲ',
        result: 'ʃ',
        examples: [],
      },
      {
        id: 'soft_s_before_sh',
        description: 'сь + ш → шш',
        trigger: 'ʃ',
        target: 'sʲ',
        result: 'ʃ',
        examples: [],
      },
      {
        id: 'soft_z_before_ch',
        description: 'зь + ч → шч',
        trigger: 'tʃ',
        target: 'zʲ',
        result: 'ʃ',
        examples: [],
      },
      {
        id: 'soft_s_before_ch',
        description: 'сь + ч → шч',
        trigger: 'tʃ',
        target: 'sʲ',
        result: 'ʃ',
        examples: [],
      },
    ],
  },

  affricateAssimilation: {
    _doc: 'Stop + homorganic fricative merges into affricate. Very limited set in Ukrainian.',
    rules: [
      {
        id: 't_before_s_to_ts',
        description: 'тс → ц (коротсь → короцьк-)',
        first: 't',
        second: 's',
        result: 'ts',
        examples: ['братство'],
      },
      {
        id: 't_before_ts_to_ts',
        description: 'тц → цц (отцем → оцьцем-style)',
        first: 't',
        second: 'ts',
        result: 'ts',
        examples: ['отці'],
      },
      {
        id: 'soft_t_before_s_to_ts',
        description: 'ть + с → ць',
        first: 'tʲ',
        second: 's',
        result: 'tsʲ',
        examples: ['багатство'],
      },
      {
        id: 'soft_t_before_soft_s_to_tsʲ',
        description: 'ть + сь → цьць',
        first: 'tʲ',
        second: 'sʲ',
        result: 'tsʲ',
        examples: ['літься'],
      },
    ],
  },

  prefixes: {
    _doc: 'Common Ukrainian prefixes that form morpheme boundaries. Used as heuristic for prefix-root split in syllabification. Ordered longest-first for greedy matching.',
    list: [
      'без',
      'від',
      "від'",
      'перед',
      'понад',
      'попід',
      'поміж',
      'роз',
      'через',
      'між',
      'над',
      'під',
      'при',
      'пре',
      'про',
      'пере',
      'об',
      'від',
      'з',
      'с',
    ],
  },
};
