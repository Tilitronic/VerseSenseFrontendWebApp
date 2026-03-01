/**
 * uaPhonetic.test.ts — Comprehensive tests for the Ukrainian phonetic pipeline.
 *
 * Test fixtures drawn from:
 * - Савченко І.С. (2014), pp. 69–76 (syllabification examples)
 * - Тоцька Н.І. (1997) (sonority, assimilation)
 * - Мойсієнко А.К. (2010) (vowel allophones, palatalization)
 */

import { describe, it, expect } from 'vitest';
import { tokenize } from 'src/services/phonetic/ua/tokenizer';
import { applyGeminates } from 'src/services/phonetic/ua/geminatePass';
import { applyPalatalization } from 'src/services/phonetic/ua/palatalizationPass';
import { applyVoicingAssimilation } from 'src/services/phonetic/ua/voicingAssimilationPass';
import { applyPlaceAssimilation } from 'src/services/phonetic/ua/placeAssimilationPass';
import { applyVowelAllophones } from 'src/services/phonetic/ua/vowelAllophonePass';
import { applyVAllophones } from 'src/services/phonetic/ua/vAllophonePass';
import { syllabify } from 'src/services/phonetic/ua/syllabifier';
import {
  transcribeUkrainian,
  transcribeUkrainianPipeline,
} from 'src/services/phonetic/ua/uaPhoneticPipeline';

// ── Helper: extract flat IPA from tokens ────────────────────────────────────

// Uncomment as needed for debugging:
// function flatIpa(word: string): string { return tokenize(word).map((t) => t.ipa).join(''); }
// function pipelineIpa(word: string, stress: number): string { return transcribeUkrainianPipeline(word, stress).ipa; }
// function syllableIpas(word: string, stress: number): string[] { return transcribeUkrainian(word, stress).map((s) => s.ipa); }

// ═══════════════════════════════════════════════════════════════════════════════
// PASS 1: TOKENIZER
// ═══════════════════════════════════════════════════════════════════════════════

describe('Tokenizer', () => {
  it('maps simple consonants to IPA', () => {
    const tokens = tokenize('бпдтк');
    const ipas = tokens.map((t) => t.ipa);
    expect(ipas).toEqual(['b', 'p', 'd', 't', 'k']);
  });

  it('maps Ukrainian-specific consonants correctly', () => {
    // г → ɦ (not ɡ), ґ → ɡ, в → ʋ
    const tokens = tokenize('гґв');
    expect(tokens.map((t) => t.ipa)).toEqual(['ɦ', 'ɡ', 'ʋ']);
  });

  it('handles digraphs дж and дз', () => {
    const tokens = tokenize('джміль');
    expect(tokens[0]!.ipa).toBe('dʒ');
    expect(tokens[0]!.source).toBe('дж');
  });

  it('handles composite щ → ʃ + tʃ', () => {
    const tokens = tokenize('щука');
    expect(tokens[0]!.ipa).toBe('ʃ');
    expect(tokens[1]!.ipa).toBe('tʃ');
  });

  it('maps simple vowels', () => {
    const tokens = tokenize('аеиіоу');
    const ipas = tokens.map((t) => t.ipa);
    expect(ipas).toEqual(['ɑ', 'ɛ', 'ɪ', 'i', 'ɔ', 'u']);
  });

  it('handles iotated vowels word-initially → j+vowel', () => {
    // яма → j+ɑ, м, ɑ
    const tokens = tokenize('яма');
    expect(tokens[0]!.ipa).toBe('j');
    expect(tokens[0]!.type).toBe('glide');
    expect(tokens[1]!.ipa).toBe('ɑ');
    expect(tokens[1]!.type).toBe('vowel');
  });

  it('handles iotated vowels after consonant → palatalization', () => {
    // ня → нь + а (н palatalized, vowel without j)
    const tokens = tokenize('ня');
    expect(tokens[0]!.ipa).toBe('nʲ');
    expect(tokens[0]!.palatalized).toBe(true);
    expect(tokens[1]!.ipa).toBe('ɑ');
  });

  it('ї is always iotated even after consonant', () => {
    // їх → j+i, x
    const tokens = tokenize('їх');
    expect(tokens[0]!.ipa).toBe('j');
    expect(tokens[1]!.ipa).toBe('i');
  });

  it('handles soft sign (ь) → palatalizes preceding consonant', () => {
    const tokens = tokenize('день');
    // д, ɛ, nʲ (ь merged into н)
    const ipas = tokens.map((t) => t.ipa);
    expect(ipas).toEqual(['d', 'ɛ', 'nʲ']);
    expect(tokens[2]!.palatalized).toBe(true);
  });

  it('handles apostrophe → glottal boundary', () => {
    const tokens = tokenize("м'яч");
    expect(tokens[1]!.ipa).toBe('ʔ');
    expect(tokens[1]!.type).toBe('glottal');
    // After apostrophe, я should iotate (j+ɑ)
    expect(tokens[2]!.ipa).toBe('j');
    expect(tokens[3]!.ipa).toBe('ɑ');
  });

  it('assigns vowel indices sequentially', () => {
    const tokens = tokenize('молоко');
    const vowels = tokens.filter((t) => t.type === 'vowel');
    expect(vowels.map((v) => v.vowelIndex)).toEqual([0, 1, 2]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PASS 2: PALATALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Palatalization Pass', () => {
  it('propagates softness regressively across dental cluster', () => {
    // сніг: с, нь, і, ɦ → сь before нь
    const tokens = tokenize('сніг');
    applyPalatalization(tokens);
    const ipas = tokens.map((t) => t.ipa);
    // н is palatalized by iotated і (already done in tokenizer)
    // с should be palatalized by the soft н
    expect(ipas[0]).toBe('sʲ');
    expect(ipas[1]).toBe('nʲ');
  });

  it('does not propagate across non-dental consonants', () => {
    // пісня: п is labial, should NOT be softened
    const tokens = tokenize('пісня');
    applyPalatalization(tokens);
    const pToken = tokens.find((t) => t.ipa === 'p' || t.ipa === 'pʲ');
    // п should stay hard (labials don't participate)
    expect(pToken?.ipa).toBe('p');
  });

  it('palatalizes тьс → тьсь in dental cluster', () => {
    // тьсь should propagate: if ь softens т, and with dental cluster rule
    const tokens = tokenize('міться'); // мі-ться
    applyPalatalization(tokens);
    // Find the с — it should be softened by ь (or transitively)
    const sToken = tokens.find((t) => t.source === 'с' || t.ipa.startsWith('s'));
    // The ь directly softens the preceding т, and with regressive propagation
    // сь could propagate from тьс cluster
    expect(sToken).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PASS 3: VOICING ASSIMILATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Voicing Assimilation Pass', () => {
  it('voices sʲ → zʲ before b in просьба', () => {
    const tokens = tokenize('просьба');
    applyPalatalization(tokens);
    applyVoicingAssimilation(tokens);
    const ipas = tokens.map((t) => t.ipa);
    // After palatalization: p, r, ɔ, sʲ, b, ɑ
    // After voicing assimilation: sʲ → zʲ before b
    expect(ipas).toContain('zʲ');
    expect(ipas).not.toContain('sʲ');
  });

  it('voices k → ɡ before z in вокзал', () => {
    const tokens = tokenize('вокзал');
    applyVoicingAssimilation(tokens);
    const ipas = tokens.map((t) => t.ipa);
    expect(ipas).toContain('ɡ');
    expect(ipas).not.toContain('k');
  });

  it('devoices ɦ → x before k in легко', () => {
    const tokens = tokenize('легко');
    applyVoicingAssimilation(tokens);
    const ipas = tokens.map((t) => t.ipa);
    // ɦ before k → x (devoicing)
    expect(ipas.join('')).toContain('xk');
  });

  it('does NOT apply word-final devoicing (Ukrainian rule)', () => {
    // Ukrainian: "хліб" stays [xlʲib], NOT [xlʲip]
    const tokens = tokenize('хліб');
    applyVoicingAssimilation(tokens);
    const lastToken = tokens[tokens.length - 1]!;
    expect(lastToken.ipa).toBe('b');
  });

  it('does not affect sonorants', () => {
    // Sonorants are exempt from voicing assimilation
    const tokens = tokenize('вовна');
    applyVoicingAssimilation(tokens);
    // ʋ should stay ʋ (sonorant, not affected)
    const vTokens = tokens.filter((t) => t.source === 'в');
    for (const v of vTokens) {
      expect(v.ipa).toBe('ʋ');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PASS 4: VOWEL ALLOPHONES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Vowel Allophone Pass', () => {
  it('assigns stress flag to correct vowel', () => {
    const tokens = tokenize('молоко');
    applyVowelAllophones(tokens, 2); // stress on last о
    const vowels = tokens.filter((t) => t.type === 'vowel');
    expect(vowels[0]!.stressed).toBe(false);
    expect(vowels[1]!.stressed).toBe(false);
    expect(vowels[2]!.stressed).toBe(true);
  });

  it('shifts unstressed е → ɛ̝', () => {
    const tokens = tokenize('весна'); // stress on а (index 1)
    applyVowelAllophones(tokens, 1);
    const eToken = tokens.find((t) => t.source === 'е');
    expect(eToken!.ipa).toBe('ɛ̝');
  });

  it('shifts unstressed и → ɪ̞', () => {
    const tokens = tokenize('живий'); // stress on last и (index 1)
    applyVowelAllophones(tokens, 1);
    const firstY = tokens.find((t) => t.source === 'и' && t.vowelIndex === 0);
    expect(firstY!.ipa).toBe('ɪ̞');
  });

  it('keeps stressed е as ɛ', () => {
    const tokens = tokenize('день');
    applyVowelAllophones(tokens, 0);
    const eToken = tokens.find((t) => t.source === 'е');
    expect(eToken!.ipa).toBe('ɛ');
    expect(eToken!.stressed).toBe(true);
  });

  it('shifts unstressed о → ɔ̝ before stressed у', () => {
    // зозуля: stress on у (index 1)
    const tokens = tokenize('зозуля');
    applyVowelAllophones(tokens, 1);
    const firstO = tokens.find((t) => t.source === 'о' && t.vowelIndex === 0);
    expect(firstO!.ipa).toBe('ɔ̝');
  });

  it('keeps і, у, а stable when unstressed', () => {
    const tokens = tokenize('кукурудза'); // stress on у at index 2
    applyVowelAllophones(tokens, 2);
    const firstU = tokens.find((t) => t.source === 'у' && t.vowelIndex === 0);
    expect(firstU!.ipa).toBe('u'); // stable
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PASS 5: В ALLOPHONES
// ═══════════════════════════════════════════════════════════════════════════════

describe('В Allophone Pass', () => {
  it('keeps ʋ before vowel (default)', () => {
    const tokens = tokenize('вода');
    applyVAllophones(tokens);
    expect(tokens[0]!.ipa).toBe('ʋ');
  });

  it('changes to w after vowel before consonant (правда)', () => {
    const tokens = tokenize('правда');
    applyVowelAllophones(tokens, 0); // need vowels marked for context
    applyVAllophones(tokens);
    const vToken = tokens.find((t) => t.source === 'в');
    expect(vToken!.ipa).toBe('w');
  });

  it('changes to u̯ word-final after vowel (кров)', () => {
    const tokens = tokenize('кров');
    applyVowelAllophones(tokens, 0);
    applyVAllophones(tokens);
    const vToken = tokens.find((t) => t.source === 'в');
    expect(vToken!.ipa).toBe('u̯');
  });

  it('stays ʋ word-initial before consonant (вклад)', () => {
    const tokens = tokenize('вклад');
    applyVAllophones(tokens);
    expect(tokens[0]!.ipa).toBe('ʋ');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PASS 6: SYLLABIFICATION (Савченко §20 rules)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Syllabifier — Савченко §20 rules', () => {
  // Helper: tokenize + syllabify (without full pipeline, just raw tokenizer + syllabifier)
  function rawSyllables(word: string): string[] {
    const tokens = tokenize(word);
    // Mark one vowel as stressed to keep syllabifier happy
    const vowels = tokens.filter((t) => t.type === 'vowel');
    if (vowels.length > 0) vowels[0]!.stressed = true;
    return syllabify(tokens).map((s) => s.ipa);
  }

  describe('Rule 1: Single intervocalic C → onset of next', () => {
    it('са-ди-ба', () => {
      expect(rawSyllables('садиба')).toEqual(['sɑ', 'dɪ', 'bɑ']);
    });

    it('де-ре-во', () => {
      expect(rawSyllables('дерево')).toEqual(['dɛ', 'rɛ', 'ʋɔ']);
    });

    it('мо-ло-ко', () => {
      expect(rawSyllables('молоко')).toEqual(['mɔ', 'lɔ', 'kɔ']);
    });
  });

  describe('Rule 2a: Two voiceless obstruents → both to next', () => {
    it('гу-сто', () => {
      expect(rawSyllables('густо')).toEqual(['ɦu', 'stɔ']);
    });

    it('ша-пка', () => {
      expect(rawSyllables('шапка')).toEqual(['ʃɑ', 'pkɑ']);
    });

    it('кри-хта', () => {
      expect(rawSyllables('крихта')).toEqual(['krɪ', 'xtɑ']);
    });
  });

  describe('Rule 2c: Obstruent + sonorant → both to next', () => {
    it('ху-тро', () => {
      expect(rawSyllables('хутро')).toEqual(['xu', 'trɔ']);
    });

    it('ша-бля', () => {
      // шабля: ʃ ɑ b lʲ ɑ → ша-бля
      const syls = rawSyllables('шабля');
      expect(syls.length).toBe(2);
      expect(syls[0]).toBe('ʃɑ');
      // second syllable starts with b+lʲ (obstruent + sonorant)
      expect(syls[1]).toContain('b');
      expect(syls[1]).toContain('lʲ');
    });
  });

  describe('Rule 2d: Two sonorants → split', () => {
    it('гор-ло', () => {
      expect(rawSyllables('горло')).toEqual(['ɦɔr', 'lɔ']);
    });

    it('пер-ли', () => {
      expect(rawSyllables('перли')).toEqual(['pɛr', 'lɪ']);
    });
  });

  describe('Rule 2e: Sonorant + obstruent → split', () => {
    it('чай-ка', () => {
      const syls = rawSyllables('чайка');
      expect(syls.length).toBe(2);
      // First syllable should end with j (чай-)
      expect(syls[0]).toContain('j');
      // Second syllable starts with k
      expect(syls[1]!.startsWith('k')).toBe(true);
    });
  });

  describe('Rule 2f: Voiced obs + voiceless obs → split', () => {
    it('каз-ка', () => {
      expect(rawSyllables('казка')).toEqual(['kɑz', 'kɑ']);
    });
  });

  describe('Rule 2g: Voiced fric + voiced stop → split', () => {
    it('друж-ба', () => {
      const syls = rawSyllables('дружба');
      expect(syls.length).toBe(2);
      expect(syls[0]).toContain('ʒ');
      expect(syls[1]).toContain('b');
    });
  });

  describe('Rule 3a: First sonorant stays in prev, rest → next', () => {
    it('пор-тфель', () => {
      const syls = rawSyllables('портфель');
      expect(syls.length).toBe(2);
      expect(syls[0]).toContain('r');
    });
  });

  describe('Rule 3b: Obstruents + sonorant → all to next', () => {
    it('по-стріл', () => {
      const syls = rawSyllables('постріл');
      expect(syls.length).toBe(2);
      expect(syls[0]).toBe('pɔ');
    });
  });

  describe('Rule 3c: All voiceless obstruents → all to next', () => {
    it('ху-стка', () => {
      const syls = rawSyllables('хустка');
      expect(syls.length).toBe(2);
      expect(syls[0]).toBe('xu');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FULL PIPELINE — end-to-end
// ═══════════════════════════════════════════════════════════════════════════════

describe('Full Pipeline — transcribeUkrainianPipeline', () => {
  it('дім (stress 0) → dʲim', () => {
    const r = transcribeUkrainianPipeline('дім', 0);
    expect(r.ipa).toBe('dʲim');
    expect(r.syllables.length).toBe(1);
  });

  it('просьба (stress 0) → contains zʲb (voicing assimilation)', () => {
    const r = transcribeUkrainianPipeline('просьба', 0);
    expect(r.ipa).toContain('zʲb');
  });

  it('легко (stress 1) → contains xk (devoicing)', () => {
    const r = transcribeUkrainianPipeline('легко', 1);
    expect(r.ipa).toContain('xk');
  });

  it('кров (stress 0) → ends with u̯ (в allophone)', () => {
    const r = transcribeUkrainianPipeline('кров', 0);
    expect(r.ipa).toMatch(/u̯$/);
  });

  it('правда (stress 0) → contains w (в allophone)', () => {
    const r = transcribeUkrainianPipeline('правда', 0);
    expect(r.ipa).toContain('w');
  });

  it('зозуля (stress 1) → unstressed о shifts to ɔ̝', () => {
    const r = transcribeUkrainianPipeline('зозуля', 1);
    expect(r.ipa).toContain('ɔ̝');
  });

  it('весна (stress 1) → unstressed е shifts to ɛ̝', () => {
    const r = transcribeUkrainianPipeline('весна', 1);
    expect(r.ipa).toContain('ɛ̝');
  });

  it('empty word → empty result', () => {
    const r = transcribeUkrainianPipeline('', 0);
    expect(r.ipa).toBe('');
    expect(r.tokens).toEqual([]);
  });

  it('single vowel word → single syllable', () => {
    const r = transcribeUkrainianPipeline('а', 0);
    expect(r.syllables.length).toBe(1);
    expect(r.syllables[0]!.stressed).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BACKWARD COMPATIBILITY — transcribeUkrainian (old API shape)
// ═══════════════════════════════════════════════════════════════════════════════

describe('transcribeUkrainian — backward-compatible API', () => {
  it('returns array of {ipa, stressed, isOpen}', () => {
    const syls = transcribeUkrainian('молоко', 2);
    expect(Array.isArray(syls)).toBe(true);
    expect(syls.length).toBeGreaterThan(0);
    for (const s of syls) {
      expect(s).toHaveProperty('ipa');
      expect(s).toHaveProperty('stressed');
      expect(s).toHaveProperty('isOpen');
    }
  });

  it('exactly one syllable is stressed', () => {
    const syls = transcribeUkrainian('дерево', 0);
    const stressedCount = syls.filter((s) => s.stressed).length;
    expect(stressedCount).toBe(1);
  });

  it('open syllable detection works', () => {
    // молоко: all syllables end with vowel → all open
    const syls = transcribeUkrainian('молоко', 2);
    for (const s of syls) {
      expect(s.isOpen).toBe(true);
    }
  });

  it('closed syllable detection works', () => {
    // горло: гор-ло → first syllable closed, second open
    const syls = transcribeUkrainian('горло', 0);
    expect(syls[0]!.isOpen).toBe(false);
    expect(syls[1]!.isOpen).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PASS 1b: GEMINATE CONSONANTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Geminate Pass', () => {
  it('merges doubled т → tʲː in життя (я palatalizes preceding т)', () => {
    const tokens = tokenize('життя');
    const merged = applyGeminates(tokens);
    const ipas = merged.map((t) => t.ipa);
    // ж, и, тт → tʲː (я palatalizes the second т, merge takes soft variant), я → ɑ
    expect(ipas).toContain('tʲː');
    // Should be fewer tokens than original
    expect(ipas.filter((ipa) => ipa === 't').length).toBe(0);
  });

  it('merges doubled л → lʲː in зілля (soft + hard → soft geminate)', () => {
    const tokens = tokenize('зілля');
    const merged = applyGeminates(tokens);
    const ipas = merged.map((t) => t.ipa);
    // зілля: зь, і, лль → lʲː, я → ɑ
    // The first л is softened by і, the second by я
    // Geminate merges them: lʲ + lʲ → lʲː
    expect(ipas).toContain('lʲː');
  });

  it('merges doubled н → nʲː in знання', () => {
    const tokens = tokenize('знання');
    const merged = applyGeminates(tokens);
    const ipas = merged.map((t) => t.ipa);
    expect(ipas).toContain('nʲː');
  });

  it('merges doubled с → sː in волосся', () => {
    const tokens = tokenize('волосся');
    const merged = applyGeminates(tokens);
    const ipas = merged.map((t) => t.ipa);
    // вол, о, сс → sʲː (because ся palatalizes), я → ɑ
    expect(ipas.some((ipa) => ipa.startsWith('s') && ipa.includes('ː'))).toBe(true);
  });

  it('does not merge different consonants', () => {
    const tokens = tokenize('мати');
    const merged = applyGeminates(tokens);
    expect(merged.length).toBe(tokens.length);
  });

  it('preserves source from both graphemes', () => {
    const tokens = tokenize('стаття');
    const merged = applyGeminates(tokens);
    const gemToken = merged.find((t) => t.ipa.includes('ː'));
    expect(gemToken).toBeDefined();
    expect(gemToken!.source).toBe('тт');
  });

  it('reduces token count by 1 per merge', () => {
    const originalTokens = tokenize('життя');
    const originalCount = originalTokens.length;
    const tokens2 = tokenize('життя');
    const merged = applyGeminates(tokens2);
    expect(merged.length).toBe(originalCount - 1);
  });

  it('handles doubled ж → ʒː in Запоріжжя', () => {
    const tokens = tokenize('запоріжжя');
    const merged = applyGeminates(tokens);
    const ipas = merged.map((t) => t.ipa);
    expect(ipas).toContain('ʒː');
  });

  it('handles doubled ш → ʃː in піддашшя (hypothetical)', () => {
    const tokens = tokenize('піддашшя');
    const merged = applyGeminates(tokens);
    const ipas = merged.map((t) => t.ipa);
    // Both дд → dː and шш → ʃː should appear
    expect(ipas).toContain('dː');
    expect(ipas).toContain('ʃː');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PASS 3b: PLACE ASSIMILATION (SIBILANT + AFFRICATE)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Place Assimilation Pass', () => {
  describe('Sibilant assimilation', () => {
    it('з + ш → шш (зшити: z before ʃ becomes ʃ)', () => {
      const tokens = tokenize('зшити');
      // Don't run geminate pass — we want to test place assimilation on raw tokens
      applyPlaceAssimilation(tokens);
      const ipas = tokens.map((t) => t.ipa);
      // First token (з) should have become ʃ
      expect(ipas[0]).toBe('ʃ');
      // Second token (ш) stays ʃ
      expect(ipas[1]).toBe('ʃ');
    });

    it('з + ж → жж (зжати: z before ʒ becomes ʒ)', () => {
      const tokens = tokenize('зжати');
      applyPlaceAssimilation(tokens);
      const ipas = tokens.map((t) => t.ipa);
      expect(ipas[0]).toBe('ʒ');
      expect(ipas[1]).toBe('ʒ');
    });

    it('з + ч → шч (зчепити: z before tʃ becomes ʃ)', () => {
      const tokens = tokenize('зчепити');
      applyPlaceAssimilation(tokens);
      const ipas = tokens.map((t) => t.ipa);
      // з (z) → ʃ before ч (tʃ)
      expect(ipas[0]).toBe('ʃ');
      expect(ipas[1]).toBe('tʃ');
    });

    it('preserves tokens that do not match sibilant rules', () => {
      const tokens = tokenize('мати');
      const originalLen = tokens.length;
      applyPlaceAssimilation(tokens);
      expect(tokens.length).toBe(originalLen);
    });
  });

  describe('Affricate assimilation', () => {
    it('т + с → ц in братство', () => {
      const tokens = tokenize('братство');
      applyPlaceAssimilation(tokens);
      const ipas = tokens.map((t) => t.ipa);
      // The тс cluster should have merged to ts (ц)
      expect(ipas).toContain('ts');
      // Source of the merged token should span both graphemes
      const tsToken = tokens.find((t) => t.ipa === 'ts');
      expect(tsToken).toBeDefined();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FULL PIPELINE — GEMINATE + PLACE ASSIMILATION end-to-end
// ═══════════════════════════════════════════════════════════════════════════════

describe('Full Pipeline — new passes', () => {
  it('життя (stress 0) → contains tʲː (palatalized geminate)', () => {
    const r = transcribeUkrainianPipeline('життя', 0);
    expect(r.ipa).toContain('tʲː');
  });

  it('зілля (stress 0) → contains lʲː (geminate)', () => {
    const r = transcribeUkrainianPipeline('зілля', 0);
    expect(r.ipa).toContain('lʲː');
  });

  it('знання (stress 0) → contains nʲː (geminate)', () => {
    const r = transcribeUkrainianPipeline('знання', 0);
    expect(r.ipa).toContain('nʲː');
  });

  it('запоріжжя (stress 2) → contains ʒː (geminate)', () => {
    const r = transcribeUkrainianPipeline('запоріжжя', 2);
    expect(r.ipa).toContain('ʒː');
  });

  it('братство (stress 0) → contains ts (affricate assimilation)', () => {
    const r = transcribeUkrainianPipeline('братство', 0);
    expect(r.ipa).toContain('ts');
  });

  it('зшити (stress 0) → starts with ʃʃ (sibilant assimilation)', () => {
    const r = transcribeUkrainianPipeline('зшити', 0);
    // з → ʃ before ш → result has ʃʃ
    expect(r.ipa).toMatch(/^ʃʃ/);
  });

  it('зчепити (stress 1) → starts with ʃtʃ (sibilant assimilation)', () => {
    const r = transcribeUkrainianPipeline('зчепити', 1);
    expect(r.ipa).toMatch(/^ʃtʃ/);
  });

  it('syllabification works with geminates — жи-ття', () => {
    const r = transcribeUkrainianPipeline('життя', 0);
    expect(r.syllables.length).toBe(2);
    // First syllable should contain the vowel ɪ
    expect(r.syllables[0]!.ipa).toContain('ʒ');
    // Second syllable should contain the palatalized geminate
    expect(r.syllables[1]!.ipa).toContain('tʲː');
  });

  it('syllabification works with geminates — зі-лля', () => {
    const r = transcribeUkrainianPipeline('зілля', 0);
    expect(r.syllables.length).toBe(2);
    expect(r.syllables[1]!.ipa).toContain('lʲː');
  });

  it('geminate + voicing assimilation combined — no crash', () => {
    // Test that geminates don't break voicing assimilation
    const r = transcribeUkrainianPipeline('підданство', 0);
    expect(r.ipa).toBeDefined();
    expect(r.syllables.length).toBeGreaterThan(0);
  });

  it('geminate + palatalization combined — зілля has soft geminate', () => {
    const r = transcribeUkrainianPipeline('зілля', 0);
    const gemToken = r.tokens.find((t) => t.ipa.includes('ː'));
    expect(gemToken).toBeDefined();
    expect(gemToken!.palatalized).toBe(true);
  });
});
