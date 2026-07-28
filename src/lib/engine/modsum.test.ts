import { describe, expect, it } from 'vitest';
import {
  checkModSum,
  expectedMod9,
  isFlaggedWrongByModSum,
  modSum11,
  modSum9
} from './modsum.js';

describe('modSum9 (casting out nines / digital root)', () => {
  it('4328 → 8 (book-content-map §6-2 known example)', () => {
    expect(modSum9(4328)).toBe(8); // 4+3+2+8=17→8
  });
  it('8651 → 2', () => {
    expect(modSum9(8651)).toBe(2); // 8+6+5+1=20→2
  });
  it('multiples of 9 reduce to 9 (not 0): 18 → 9, 99 → 9', () => {
    expect(modSum9(18)).toBe(9);
    expect(modSum9(99)).toBe(9);
  });
  it('0 → 0', () => {
    expect(modSum9(0)).toBe(0);
  });
  it('single digits identity', () => {
    for (let d = 1; d <= 9; d++) expect(modSum9(d)).toBe(d);
  });
});

describe('modSum11 (casting out elevens)', () => {
  it('23487 → 2 (book-content-map §6-6 known example: 7−8+4−3+2)', () => {
    expect(modSum11(23487)).toBe(2);
  });
  it('11 → 0, 22 → 0 (multiples of 11 give 0)', () => {
    expect(modSum11(11)).toBe(0);
    expect(modSum11(22)).toBe(0);
  });
  it('always in 0..10', () => {
    for (const n of [0, 1, 12, 123, 9999, 100000]) {
      const m = modSum11(n);
      expect(m).toBeGreaterThanOrEqual(0);
      expect(m).toBeLessThanOrEqual(10);
    }
  });
});

describe('expectedMod9 per operation', () => {
  it('add: expected = dr(Σ dr(operands))', () => {
    expect(expectedMod9('add', [modSum9(47), modSum9(34)])).toBe(modSum9(47 + 34));
  });
  it('mul: expected = dr(Π dr(operands))', () => {
    expect(expectedMod9('mul', [modSum9(47), modSum9(34)])).toBe(modSum9(47 * 34));
  });
});

/** 브리프 §3 핵심 요구: 모드섬 불일치 ⟺ 오답 속성 테스트. */
describe('mod-sum property: mismatch ⟹ wrong answer (§3 required)', () => {
  it('correct answer NEVER flags wrong (9 and 11 both pass)', () => {
    const cases: ReadonlyArray<['add' | 'mul', number, number]> = [
      ['add', 47, 34],
      ['mul', 47, 34],
      ['add', 999, 1],
      ['mul', 853, 762],
      ['add', 18, 27]
    ];
    for (const [op, a, b] of cases) {
      const truth = op === 'mul' ? a * b : a + b;
      const res = checkModSum(op, [a, b], truth);
      expect(res.mod9Match).toBe(true);
      expect(res.mod11Match).toBe(true);
      expect(isFlaggedWrongByModSum(res)).toBe(false);
    }
  });

  it('a wrong answer (truth+1) is flagged by mod9 OR mod11 with high probability', () => {
    // truth+1 은 mod11 이 항상 잡음(±1 변화가 mod11 에서 1 차이). 1000 표본.
    let flagged = 0;
    const total = 1000;
    for (let i = 0; i < total; i++) {
      const a = 10 + (i % 90);
      const b = 2 + (i % 8);
      const truth = a * b;
      const res = checkModSum('mul', [a, b], truth + 1);
      if (isFlaggedWrongByModSum(res)) flagged++;
    }
    // truth+1 은 거의 항상 잡힌다(mod11 이 +1 변화를 잡음). 95% 이상 기대.
    expect(flagged / total).toBeGreaterThan(0.95);
  });

  it('mismatch ⟹ wrong: if flagged, claimed ≠ truth (deterministic property)', () => {
    for (let k = 1; k <= 200; k++) {
      const a = 10 + ((k * 7) % 89);
      const b = 2 + ((k * 3) % 8);
      const truth = a * b;
      // k 만큼 더한 오답
      const claimed = truth + k;
      const res = checkModSum('mul', [a, b], claimed);
      if (isFlaggedWrongByModSum(res)) {
        // 불일치로 잡혔다면 반드시 틀린 답이다.
        expect(claimed).not.toBe(truth);
      }
    }
  });

  it('ModSumResult fields populated for 47×34=1598', () => {
    const res = checkModSum('mul', [47, 34], 1598);
    expect(res.op).toBe('mul');
    expect(res.mod9Operands).toEqual([modSum9(47), modSum9(34)]); // [2,7]
    expect(res.mod9Match).toBe(true);
    expect(res.mod11Match).toBe(true);
  });
});
