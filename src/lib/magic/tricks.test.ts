import { describe, expect, it } from 'vitest';
import { MAGIC_TRICKS, findMagicTrick, magicIdForChapter } from './tricks.js';

describe('MAGIC_TRICKS registry — 4 prioritized tricks', () => {
  it('has exactly 4 tricks (psychic/1089/missing/leapfrog)', () => {
    expect(MAGIC_TRICKS.map((t) => t.id).sort()).toEqual([
      'leapfrog',
      'magic-1089',
      'missing-digit',
      'psychic-math'
    ]);
  });

  it('each maps to its unlocking chapter (2-5)', () => {
    expect(magicIdForChapter(2)).toBe('psychic-math');
    expect(magicIdForChapter(3)).toBe('magic-1089');
    expect(magicIdForChapter(4)).toBe('missing-digit');
    expect(magicIdForChapter(5)).toBe('leapfrog');
  });

  it('findMagicTrick resolves by id', () => {
    expect(findMagicTrick('psychic-math')?.id).toBe('psychic-math');
    expect(findMagicTrick('nope')).toBeUndefined();
  });

  it('each trick has localized title/secret/principle + demo', () => {
    for (const t of MAGIC_TRICKS) {
      expect(t.title.ko.length).toBeGreaterThan(0);
      expect(t.secret.ko.length).toBeGreaterThan(0);
      expect(t.principle.ko.length).toBeGreaterThan(0);
      const d = t.demo(7);
      expect(d.steps.length).toBeGreaterThan(0);
      expect(d.finale.ko.length).toBeGreaterThan(0);
    }
  });
});

describe('psychic-math demo — always lands on 6', () => {
  const psychic = findMagicTrick('psychic-math')!;
  for (const seed of [1, 2, 3, 42, 99]) {
    it(`seed ${seed} → 6`, () => {
      const d = psychic.demo(seed);
      // 마지막 스텝(원래 수 빼기)의 값이 항상 6.
      const last = d.steps[d.steps.length - 1]!;
      expect(last.value).toBe(6);
    });
  }
});

describe('magic-1089 demo — always lands on 1089', () => {
  const t1089 = findMagicTrick('magic-1089')!;
  for (const seed of [1, 5, 13, 77]) {
    it(`seed ${seed} → 1089`, () => {
      const d = t1089.demo(seed);
      // 마지막 스텝의 값 문자열에 1089 포함.
      const last = String(d.steps[d.steps.length - 1]!.value);
      expect(last).toContain('1089');
    });
  }
});

describe('leapfrog demo — sum equals 7th line × 11', () => {
  const leap = findMagicTrick('leapfrog')!;
  it('finale sum matches the ×11 claim structure', () => {
    const d = leap.demo(3);
    // finale 가 "10줄의 합 = N" 형태 — 숫자 추출해 11의 배수인지.
    const m = d.finale.ko.match(/(\d+)/g);
    expect(m).not.toBeNull();
    if (m) {
      const total = Number(m[m.length - 1]);
      expect(total % 11).toBe(0); // 합은 항상 11의 배수.
    }
  });
});

describe('missing-digit demo — principle ties to mod-sum (ch4/ch6)', () => {
  const md = findMagicTrick('missing-digit')!;
  it('produces a hidden-digit puzzle with a finale naming a digit', () => {
    const d = md.demo(8);
    expect(d.steps.length).toBe(3);
    expect(d.finale.ko).toMatch(/빠진 숫자/);
    expect(md.principle.ko).toContain('9의 배수');
  });
});
