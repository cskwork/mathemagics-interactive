import { describe, expect, it } from 'vitest';
import { deriveDivisionLayout, deriveDivSteps } from './derive-div.js';
import { generateProblem } from './generate.js';
import type { Problem } from './types.js';

describe('deriveDivisionLayout — quotient & remainder match floor/mod', () => {
  for (const seed of [1, 2, 3, 5, 8]) {
    it(`seed ${seed}: quotient=floor(a/b), remainder=a mod b`, () => {
      const p = generateProblem(seed, { op: 'div', method: 'div-1', digits: 3, carry: true });
      const [a, b] = p.operands;
      const layout = deriveDivisionLayout(p);
      expect(layout.quotient).toBe(Math.floor(a / b));
      expect(layout.remainder).toBe(a - Math.floor(a / b) * b);
      expect(layout.divisor).toBe(b);
      expect(layout.dividend).toBe(a);
    });
  }

  it('179 ÷ 7 = 25 R 4 (known example)', () => {
    const p: Problem = { op: 'div', operands: [179, 7], method: 'div-1', level: 1 };
    const layout = deriveDivisionLayout(p);
    expect(layout.quotient).toBe(25);
    expect(layout.remainder).toBe(4);
    // 두 자리 몫: 첫 자리 2(14), 둘째 자리 5(35).
    expect(layout.digits.map((d) => d.digit)).toEqual([2, 5]);
    expect(layout.digits[0]!.product).toBe(14);
    expect(layout.digits[0]!.broughtDown).toBe(17);
    expect(layout.digits[1]!.broughtDown).toBe(39);
  });

  it('exact division has remainder 0', () => {
    const p: Problem = { op: 'div', operands: [318, 6], method: 'div-1', level: 1 };
    const layout = deriveDivisionLayout(p);
    expect(layout.quotient).toBe(53);
    expect(layout.remainder).toBe(0);
  });

  it('throws on divisor 0', () => {
    const p: Problem = { op: 'div', operands: [10, 0], method: 'div-1', level: 1 };
    expect(() => deriveDivisionLayout(p)).toThrow();
  });
});

describe('deriveDivSteps — digit reveal left-to-right', () => {
  it('produces one write step per quotient digit (left→right)', () => {
    const p: Problem = { op: 'div', operands: [179, 7], method: 'div-1', level: 1 };
    const steps = deriveDivSteps(p);
    const writes = steps.filter((s) => s.t === 'write');
    expect(writes.length).toBe(2); // 몫 25 → 두 자리
    // 첫 write 가 몫의 앞자리(2).
    const first = writes[0];
    expect(first).toBeDefined();
    if (first && first.t === 'write') expect(first.value).toBe('2');
  });

  it('every expect:true write step is a single digit', () => {
    const p: Problem = { op: 'div', operands: [4579, 6], method: 'div-1', level: 1 };
    for (const s of deriveDivSteps(p)) {
      if (s.t === 'write' && s.expect === true) {
        expect(s.value).toMatch(/^[0-9]$/);
      }
    }
  });
});
