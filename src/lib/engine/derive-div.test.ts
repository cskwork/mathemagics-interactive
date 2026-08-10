import { describe, expect, it } from 'vitest';
import { deriveDivisionLayout, deriveDivSteps } from './derive-div.js';
import { generateProblem } from './generate.js';
import type { Problem } from './types.js';

describe('deriveDivisionLayout — quotient & remainder match floor/mod', () => {
  for (const seed of [1, 2, 3, 5, 8]) {
    it(`seed ${seed}: quotient=floor(a/b), remainder=a mod b`, () => {
      const p = generateProblem(seed, { op: 'div', method: 'div-1', digits: 3, carry: true });
      const a = p.operands[0] ?? 0; const b = p.operands[1] ?? 0;
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
  it('produces one write step per quotient digit, then the remainder', () => {
    const p: Problem = { op: 'div', operands: [179, 7], method: 'div-1', level: 1 };
    const steps = deriveDivSteps(p);
    const writes = steps.filter((s) => s.t === 'write');
    expect(writes.length).toBe(3); // quotient 25 plus remainder 4
    // 첫 write 가 몫의 앞자리(2).
    const first = writes[0];
    expect(first).toBeDefined();
    if (first && first.t === 'write') expect(first.value).toBe('2');
  });

  it('179 ÷ 7 assesses quotient and remainder in distinct semantic rows', () => {
    const p: Problem = { op: 'div', operands: [179, 7], method: 'div-1', level: 1 };
    const writes = deriveDivSteps(p).filter((step) => step.t === 'write');
    expect(writes.map((step) => [step.cell, step.value])).toEqual([
      ['quotient.c3', '2'],
      ['quotient.c4', '5'],
      ['remainder.c4', '4']
    ]);
  });

  it('narrates bringing the next digit down before the next quotient digit', () => {
    const p: Problem = { op: 'div', operands: [179, 7], method: 'div-1', level: 1 };
    const narrations = deriveDivSteps(p).flatMap((step) =>
      'narration' in step && step.narration ? [step.narration] : []
    );
    expect(narrations.some((text) => text.ko.includes('나머지 3') && text.ko.includes('39'))).toBe(true);
    expect(narrations.some((text) => text.en?.includes('Bring down 9') && text.en.includes('39'))).toBe(true);
  });

  it('narrates bringing down the next dividend digit between quotient digits', () => {
    const p: Problem = { op: 'div', operands: [179, 7], method: 'div-1', level: 1 };
    const narrations = deriveDivSteps(p).flatMap((step) =>
      step.narration?.en ? [step.narration.en] : []
    );
    expect(narrations).toContain('Bring down 9 beside remainder 3 to make 39.');
  });

  it('derives a real equivalent division before solving div-simplify', () => {
    const p: Problem = { op: 'div', operands: [168, 24], method: 'div-simplify', level: 1 };
    const layout = deriveDivisionLayout(p);
    expect(layout.simplification).toEqual({ factor: 8, dividend: 21, divisor: 3 });
    expect(layout.quotient).toBe(7);
    expect(deriveDivSteps(p).some((step) => step.t === 'branch' && step.from === 168 && step.to === 21)).toBe(true);
  });

  it('does not narrate the simplified quotient before the learner writes it', () => {
    const p: Problem = { op: 'div', operands: [168, 24], method: 'div-simplify', level: 1 };
    const steps = deriveDivSteps(p);
    const firstExpected = steps.findIndex((step) => step.t === 'write' && step.expect === true);
    const beforeInput = steps.slice(0, firstExpected).flatMap((step) =>
      'narration' in step && step.narration ? [step.narration.ko, step.narration.en ?? ''] : []
    );
    expect(beforeInput.join(' ')).not.toContain('= 7');
  });

  it.each([
    [1234, 2, true],
    [1234, 3, false],
    [1236, 4, true],
    [1235, 5, true],
    [1236, 6, true],
    [203, 7, true],
    [1232, 8, true],
    [1233, 9, true],
    [1230, 10, true],
    [2728, 11, true]
  ] as const)('derives %i divisibility by %i as %s without long division', (dividend, divisor, divides) => {
    const p: Problem = { op: 'div', operands: [dividend, divisor], method: 'divisibility', level: 1 };
    const layout = deriveDivisionLayout(p);
    expect(layout.divisibility?.divides).toBe(divides);
    const choices = deriveDivSteps(p).filter((step) => step.t === 'choice');
    expect(choices).toHaveLength(1);
    expect(choices[0]?.value).toBe(divides);
    expect(choices[0]?.expect).toBe(true);
  });

  it('generated divisibility decisions cover divisors 2–11 and both yes/no answers', () => {
    const generated = Array.from({ length: 500 }, (_, i) =>
      generateProblem(i + 1, { op: 'div', method: 'divisibility', digits: 3, carry: true })
    );
    expect(new Set(generated.map((p) => p.operands[1]))).toEqual(new Set([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]));
    expect(new Set(generated.map((p) => (p.operands[0] ?? 0) % (p.operands[1] ?? 1) === 0))).toEqual(
      new Set([true, false])
    );
  });

  it('generated simplification problems preserve the quotient through a non-trivial reduction', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const p = generateProblem(seed, { op: 'div', method: 'div-simplify', digits: 3, carry: false });
      const layout = deriveDivisionLayout(p);
      const reduced = layout.simplification;
      expect(reduced).toBeDefined();
      expect(String(layout.dividend)).toHaveLength(3);
      expect(reduced!.factor).toBeGreaterThan(1);
      expect(reduced!.divisor).toBeGreaterThan(1);
      expect(reduced!.dividend / reduced!.divisor).toBe(layout.quotient);
    }
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
