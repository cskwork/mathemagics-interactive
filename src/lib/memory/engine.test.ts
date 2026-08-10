import { describe, expect, it } from 'vitest';
import { encodeKorean } from './korean-ko.js';
import { encodeMajor, MAJOR_SYSTEM } from './major-en.js';
import { KOREAN_SYSTEM } from './korean-ko.js';
import {
  encodeWordToDigits,
  findWordsForDigits,
  verifyWord,
  systemForLocale,
  KO_DICTIONARY,
  EN_DICTIONARY
} from './engine.js';
import type { WordEntry } from './types.js';

// ── Korean (ko) 자음 코드 ────────────────────────────────────────────────────────

describe('Korean consonant code — encode (word→digits, deterministic)', () => {
  it('나비 → 26 (ㄴ=2, ㅂ=6)', () => {
    expect(encodeKorean('나비')).toBe('26');
  });
  it('사과 → 71 (ㅅ=7, ㄱ=1)', () => {
    expect(encodeKorean('사과')).toBe('71');
  });
  it('호랑이 → 8400 (ㅎ·ㄹ·ㅇ종성·ㅇ초성)', () => {
    expect(encodeKorean('호랑이')).toBe('8400');
  });
  it('곰 → 15 (ㄱ·ㅁ종성)', () => {
    expect(encodeKorean('곰')).toBe('15');
  });
  it('개 → 1 (단일 자음)', () => {
    expect(encodeKorean('개')).toBe('1');
  });
  it('안녕 → 0220 (ㅇ초·ㄴ종·ㄴ초·ㅇ종)', () => {
    // 안 = 초성 ㅇ(0) + 종성 ㄴ(2); 녕 = 초성 ㄴ(2) + 종성 ㅇ(0)
    expect(encodeKorean('안녕')).toBe('0220');
  });
  it('매핑 없는 자음(ㅊ ㅌ ㅍ)은 건너뛴다 — 자동차 → 930 (ㅈ·ㄷ, ㅊ 건너뜀)', () => {
    expect(encodeKorean('자동차')).toBe('930');
  });
  it('겹받침 구성 자음을 순서대로 — 닭 → 45 (ㄹ·ㄹ종+ㄱ)', () => {
    // 닭 = 초성 ㄷ? 아님. 닭 = ㄷ(초)+ ㄹㄱ(종 겹받침 ㄺ). → 3,4,1
    expect(encodeKorean('닭')).toBe('341');
  });
  it('비-한글 문자(공백·숫자)는 무시', () => {
    expect(encodeKorean('나 비 12')).toBe('26');
  });
  it('동일 단어는 항상 동일 숫자열(결정적)', () => {
    expect(encodeKorean('수학')).toBe(encodeKorean('수학'));
    expect(encodeKorean('수학')).toBe('781');
  });
});

// ── English (en) Major System ───────────────────────────────────────────────────

describe('English Major System — encode (word→digits, phonetic)', () => {
  it('dog → 17 (d=1, g=7 hard)', () => {
    expect(encodeMajor('dog')).toBe('17');
  });
  it('moon → 32 (m=3, n=2)', () => {
    expect(encodeMajor('moon')).toBe('32');
  });
  it('cat → 71 (c hard=7, t=1)', () => {
    expect(encodeMajor('cat')).toBe('71');
  });
  it('cheese → 60 (ch=6, s=0, 중복 s 1회)', () => {
    // ch→6, ee 무효, s→0, e 무효 → 60. (cheese: c-h-e-e-s-e)
    expect(encodeMajor('cheese')).toBe('60');
  });
  it('phone → 82 (ph=8, n=2)', () => {
    expect(encodeMajor('phone')).toBe('82');
  });
  it('show → 6 (sh=6)', () => {
    expect(encodeMajor('show')).toBe('6');
  });
  it('knight → 21 (silent k/gh; n=2, t=1)', () => {
    expect(encodeMajor('knight')).toBe('21');
  });
  it('double consonant counted once — tt → 1', () => {
    expect(encodeMajor('kitten')).toBe('712');
  });
  it('soft c (before e/i/y) → 0 — city → 01', () => {
    expect(encodeMajor('city')).toBe('01');
  });
  it('soft g (before e/i/y) → 6 — gym → 63', () => {
    expect(encodeMajor('gym')).toBe('63');
  });
  it('counts same-code sounds when a vowel separates them — date → 11', () => {
    expect(encodeMajor('date')).toBe('11');
    expect(encodeMajor('five')).toBe('88');
    expect(encodeMajor('cake')).toBe('77');
  });
  it('treats tch as one /ch/ sound — match → 36', () => {
    expect(encodeMajor('match')).toBe('36');
  });
  it('ignores common silent initial k — knee → 2, knife → 28', () => {
    expect(encodeMajor('knee')).toBe('2');
    expect(encodeMajor('knife')).toBe('28');
  });
  it('uses explicit pronunciations where spelling rules are ambiguous', () => {
    expect(encodeMajor('girl')).toBe('745');
    expect(encodeMajor('ocean')).toBe('62');
    expect(encodeMajor('pizza')).toBe('910');
  });
});

// ── 공통 엔진 ────────────────────────────────────────────────────────────────────

describe('memory engine — common interface', () => {
  it('encodeWordToDigits delegates to system', () => {
    expect(encodeWordToDigits('나비', KOREAN_SYSTEM)).toBe('26');
    expect(encodeWordToDigits('dog', MAJOR_SYSTEM)).toBe('17');
  });
  it('verifyWord round-trips encode', () => {
    expect(verifyWord('나비', '26', KOREAN_SYSTEM)).toBe(true);
    expect(verifyWord('나비', '99', KOREAN_SYSTEM)).toBe(false);
    expect(verifyWord('moon', '32', MAJOR_SYSTEM)).toBe(true);
  });
  it('systemForLocale returns correct system', () => {
    expect(systemForLocale('ko').locale).toBe('ko');
    expect(systemForLocale('en').locale).toBe('en');
  });

  it('findWordsForDigits returns matching dictionary entries (ko)', () => {
    const dict: readonly WordEntry[] = [
      { word: '나비', digits: '26' },
      { word: '소', digits: '7' },
      { word: '새', digits: '7' }
    ];
    const matches = findWordsForDigits('7', dict);
    expect(matches.map((e) => e.word).sort()).toEqual(['새', '소'].sort());
    expect(findWordsForDigits('26', dict).map((e) => e.word)).toEqual(['나비']);
    expect(findWordsForDigits('999', dict)).toEqual([]);
  });

  it('dictionaries loaded and non-empty', () => {
    expect(KO_DICTIONARY.length).toBeGreaterThan(50);
    expect(EN_DICTIONARY.length).toBeGreaterThan(50);
    // 사전 모든 항목은 digits 가 비어있지 않다.
    expect(KO_DICTIONARY.every((e) => e.digits.length > 0)).toBe(true);
    expect(EN_DICTIONARY.every((e) => e.digits.length > 0)).toBe(true);
  });

  it('every dictionary entry encodes back to its stored digits (ko)', () => {
    for (const e of KO_DICTIONARY) {
      expect(encodeKorean(e.word), `word "${e.word}"`).toBe(e.digits);
    }
  });
  it('every dictionary entry encodes back to its stored digits (en)', () => {
    for (const e of EN_DICTIONARY) {
      expect(encodeMajor(e.word), `word "${e.word}"`).toBe(e.digits);
    }
  });

  it('findWordsForDigits against real KO_DICTIONARY: 7 → includes 새/소', () => {
    const matches = findWordsForDigits('7', KO_DICTIONARY).map((e) => e.word);
    expect(matches).toContain('새');
    expect(matches).toContain('소');
  });
});
