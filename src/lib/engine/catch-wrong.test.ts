import { describe, expect, it } from 'vitest';
import { findWrongByModSum, isActuallyWrong, makeRound } from './catch-wrong.js';
import { checkModSum } from './modsum.js';

describe('makeRound — structure', () => {
  it('produces n items with exactly 1 wrong', () => {
    const round = makeRound(42, 5, 'mul');
    expect(round.items.length).toBe(5);
    const wrongs = round.items.filter((it) => isActuallyWrong(it));
    expect(wrongs.length).toBe(1);
    expect(isActuallyWrong(round.items[round.wrongIndex]!)).toBe(true);
  });

  it('deterministic: same seed → same round', () => {
    const r1 = makeRound(7, 4, 'add');
    const r2 = makeRound(7, 4, 'add');
    expect(r1.wrongIndex).toBe(r2.wrongIndex);
    expect(r1.items.map((i) => i.claimed)).toEqual(r2.items.map((i) => i.claimed));
  });

  it('throws for n < 2', () => {
    expect(() => makeRound(1, 1)).toThrow();
  });

  it('correct items pass mod-sum; wrong item fails mod9', () => {
    const round = makeRound(99, 6, 'mul');
    for (let i = 0; i < round.items.length; i++) {
      const it = round.items[i]!;
      const res = checkModSum(it.op, it.operands, it.claimed);
      if (i === round.wrongIndex) {
        expect(res.mod9Match).toBe(false); // 오답은 반드시 9 버리기에 걸림
        expect(isActuallyWrong(it)).toBe(true);
      } else {
        expect(res.mod9Match).toBe(true);
        expect(isActuallyWrong(it)).toBe(false);
      }
    }
  });
});

/** 브리프 §3 핵심 요구: 모드섬으로 틀린 것을 잡아낸다 (mismatch ⇔ wrong). */
describe('findWrongByModSum — catches the wrong answer', () => {
  it('finds the wrong index via mod-sum (5 items)', () => {
    const round = makeRound(123, 5, 'mul');
    expect(findWrongByModSum(round)).toBe(round.wrongIndex);
  });

  it('works across many seeds and sizes (property)', () => {
    for (const seed of [1, 2, 3, 10, 50, 100, 777, 2024]) {
      for (const n of [2, 4, 6]) {
        const round = makeRound(seed, n, 'mul');
        const found = findWrongByModSum(round);
        expect(found).toBe(round.wrongIndex);
      }
    }
  });

  it('works for add operation too', () => {
    for (const seed of [5, 15, 25]) {
      const round = makeRound(seed, 4, 'add');
      expect(findWrongByModSum(round)).toBe(round.wrongIndex);
    }
  });
});
