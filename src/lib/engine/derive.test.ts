import { describe, expect, it } from 'vitest';
import { deriveGrid, deriveSteps } from './derive.js';
import { generateProblem, generateProblems } from './generate.js';
import type { Problem } from './types.js';

/** 문제의 모든 write 스텝(답 칸) 값을 모아 오른쪽 정렬 문자열로 합치면 최종 답이어야 한다. */
function answerFromSteps(problem: Problem): string {
  const grid = deriveGrid(problem);
  const steps = deriveSteps(problem);
  const cells = new Map<string, string>();
  for (const s of steps) {
    if (s.t === 'write' || s.t === 'carry' || s.t === 'reveal') {
      if (s.t === 'reveal') {
        for (const c of s.cells) cells.set(c, s.value);
      } else {
        cells.set(s.cell, s.value);
      }
    }
  }
  // answer 행의 자릿값 열을 place 역순(큰 자리→일의 자리)로 이어 붙인다.
  const digitCols = grid.cols.slice(1); // c2..cN
  let out = '';
  for (const col of digitCols) {
    const v = cells.get(`answer.${col}`);
    if (v !== undefined) out += v;
  }
  return out;
}

function expectedAnswer(problem: Problem): number {
  const a = problem.operands[0] ?? 0;
  const b = problem.operands[1] ?? 0;
  return problem.op === 'add' ? a + b : a - b;
}

/** 파생된 답 == 독립 산술 계산. 모든 조합에서 검증하는 핵심 대조. */
function expectAnswerMatches(problem: Problem): void {
  expect(Number(answerFromSteps(problem))).toBe(expectedAnswer(problem));
}

const OPS = ['add', 'sub'] as const;
const METHODS = ['ltr', 'rtl'] as const;
const DIGITS = [2, 3, 4];

describe('deriveGrid', () => {
  it('right-aligns operands and sizes columns to the widest of operands/answer', () => {
    // 999 + 1 = 1000 → 답 자릿수(4) 가 피연산자(3) 보다 크므로 자릿값 열은 4.
    const g = deriveGrid({ op: 'add', operands: [999, 1], method: 'rtl', level: 1 });
    expect(g.digitCols).toBe(4);
    expect(g.placeValueOf['c5']).toBe(0); // 일의 자리 = 가장 오른쪽
    expect(g.placeValueOf['c2']).toBe(3); // 천의 자리
    expect(g.placeValueOf['c1']).toBe(-1); // 부호 열
    expect(g.rows.find((r) => r.id === 'op1')?.cells['c5']).toBe('9'); // 999 오른쪽 정렬
    expect(g.rows.find((r) => r.id === 'op2')?.cells['c1']).toBe('+');
    expect(g.rows.find((r) => r.id === 'op2')?.cells['c5']).toBe('1');
    expect(g.rows.find((r) => r.id === 'op2')?.underline).toBe(true);
    expect(g.rows.find((r) => r.id === 'answer')?.input).toBe(true);
  });

  it('places the − sign for subtraction', () => {
    const g = deriveGrid({ op: 'sub', operands: [86, 25], method: 'rtl', level: 1 });
    expect(g.rows.find((r) => r.id === 'op2')?.cells['c1']).toBe('−');
  });

  it('handles single-digit and 0 operands', () => {
    const g = deriveGrid({ op: 'add', operands: [0, 0], method: 'rtl', level: 1 });
    expect(g.digitCols).toBe(1);
    expect(g.rows.find((r) => r.id === 'op1')?.cells['c2']).toBe('0');
    expect(g.rows.find((r) => r.id === 'op2')?.cells['c2']).toBe('0');
  });

  it('exposes the quotient and remainder rows targeted by division steps', () => {
    const p: Problem = { op: 'div', operands: [179, 7], method: 'div-1', level: 1 };
    const grid = deriveGrid(p);
    expect(grid.rows.map((row) => row.id)).toEqual(['op1', 'op2', 'quotient', 'remainder']);
    const cells = deriveSteps(p).flatMap((step) => (step.t === 'write' ? [step.cell] : []));
    expect(cells.every((cell) => grid.rows.some((row) => cell.startsWith(`${row.id}.`)))).toBe(true);
  });

  it('has enough columns for an estimation answer wider than its operands', () => {
    const p: Problem = { op: 'est', operands: [855, 888], method: 'est-band', level: 1, estOf: 'mul' };
    const grid = deriveGrid(p);
    const cells = deriveSteps(p).flatMap((step) => (step.t === 'write' ? [step.cell] : []));
    expect(grid.digitCols).toBe(6);
    expect(cells.every((cell) => grid.cols.includes(cell.split('.')[1] ?? ''))).toBe(true);
  });
});

describe('deriveSteps — final answer matches a+b / a-b (all combinations)', () => {
  // 생성기로 다양한 문제를 만들고 각각 답 대조. 자릿수·올림·방향 전 조합.
  for (const op of OPS) {
    for (const method of METHODS) {
      for (const digits of DIGITS) {
        for (const carry of [true, false]) {
          const label = `${op}/${method}/${digits}d/carry=${carry}`;
          it(label, () => {
            const problem = generateProblem(hashSeed(label), { op, method, digits, carry });
            expect(problem.op).toBe(op);
            expect(problem.method).toBe(method);
            if (op === 'sub') expect(problem.operands[0] ?? 0).toBeGreaterThanOrEqual(problem.operands[1] ?? 0);
            expectAnswerMatches(problem);
          });
        }
      }
    }
  }
});

describe('deriveSteps — direction & carry/borrow encoding', () => {
  it('rtl add writes answer digits right→left and emits carry steps', () => {
    // 348 + 257 = 605. units(c4)→tens(c3)→hundreds(c2); carry steps present.
    const p: Problem = { op: 'add', operands: [348, 257], method: 'rtl', level: 1 };
    const steps = deriveSteps(p);
    const writes = steps.filter((s) => s.t === 'write');
    expect(writes.map((w) => (w as { cell: string }).cell)).toEqual([
      'answer.c4',
      'answer.c3',
      'answer.c2'
    ]);
    const carries = steps.filter((s) => s.t === 'carry');
    expect(carries.length).toBe(2); // tens 올림, hundreds 올림
    expect((carries[0] as { cell: string }).cell).toBe('carry.c3'); // 십의 자리 위에 올림
  });

  it('rtl add without carry has no carry steps', () => {
    const p: Problem = { op: 'add', operands: [12, 23], method: 'rtl', level: 1 };
    const steps = deriveSteps(p);
    expect(steps.filter((s) => s.t === 'carry').length).toBe(0);
    expect(answerFromSteps(p)).toBe('35');
  });

  it('ltr add writes answer digits left→right and emits NO carry steps', () => {
    // 538 + 327 = 865. ltr → hundreds(c2)→tens(c3)→units(c4); 벤저민식은 표기 없음.
    const p: Problem = { op: 'add', operands: [538, 327], method: 'ltr', level: 1 };
    const steps = deriveSteps(p);
    const writes = steps.filter((s) => s.t === 'write');
    expect(writes.map((w) => (w as { cell: string }).cell)).toEqual([
      'answer.c2',
      'answer.c3',
      'answer.c4'
    ]);
    expect(steps.some((s) => s.t === 'carry')).toBe(false);
    expect(answerFromSteps(p)).toBe('865');
  });

  it('ltr add narrates the full digit sum before writing and carrying', () => {
    const p: Problem = { op: 'add', operands: [78, 29], method: 'ltr', level: 1 };
    const narrations = deriveSteps(p).flatMap((step) =>
      step.narration?.ko === undefined ? [] : [step.narration.ko]
    );

    expect(narrations).toContain('일의 자리: 8 + 9 = 17. 7을 쓰고 1 올림.');
    expect(narrations).not.toContain('일의 자리: 8 + 9 = 7');
  });

  it('rtl sub emits strike steps for borrows', () => {
    // 732 − 458 = 274. units(2<8) borrow strike op1.c3, tens(3→2<5) borrow strike op1.c2.
    const p: Problem = { op: 'sub', operands: [732, 458], method: 'rtl', level: 1 };
    const steps = deriveSteps(p);
    const strikes = steps.filter((s) => s.t === 'strike');
    expect(strikes.length).toBe(2);
    expect((strikes[0] as { cell: string }).cell).toBe('op1.c3');
    expect(answerFromSteps(p)).toBe('274');
  });

  it('rtl sub without borrow has no strike steps', () => {
    const p: Problem = { op: 'sub', operands: [86, 25], method: 'rtl', level: 1 };
    const steps = deriveSteps(p);
    expect(steps.filter((s) => s.t === 'strike').length).toBe(0);
    expect(answerFromSteps(p)).toBe('61');
  });

  it('ltr sub writes answer left→right with no strike steps', () => {
    const p: Problem = { op: 'sub', operands: [86, 25], method: 'ltr', level: 1 };
    const steps = deriveSteps(p);
    const writes = steps.filter((s) => s.t === 'write');
    expect(writes.map((w) => (w as { cell: string }).cell)).toEqual(['answer.c2', 'answer.c3']);
    expect(steps.some((s) => s.t === 'strike')).toBe(false);
    expect(answerFromSteps(p)).toBe('61');
  });

  it('ltr sub narrates round-up subtraction with the exact compensation', () => {
    const p: Problem = { op: 'sub', operands: [60, 17], method: 'ltr', level: 1 };
    const narrations = deriveSteps(p).flatMap((step) =>
      step.narration?.ko === undefined ? [] : [step.narration.ko]
    );

    expect(narrations).toContain('먼저 10을 빼고, 더 뺈 3을 되돌려줘요: 50 − 10 + 3 = 43');
    expect(narrations.some((text) => text.includes('50 − 7') && text.includes('→43'))).toBe(false);
  });
});

describe('deriveSteps — edge cases', () => {
  it('999 + 1 = 1000 (answer grows by a digit, both directions)', () => {
    for (const method of METHODS) {
      const p: Problem = { op: 'add', operands: [999, 1], method, level: 1 };
      expect(answerFromSteps(p)).toBe('1000');
    }
  });

  it('1000 − 1 = 999 (answer shrinks; no leading zero written)', () => {
    const p: Problem = { op: 'sub', operands: [1000, 1], method: 'rtl', level: 1 };
    expect(answerFromSteps(p)).toBe('999');
    // 천의 자리(c2) 답 칸에 쓰기 스텝이 없어야 한다(선행 0 생략).
    const steps = deriveSteps(p);
    expect(steps.some((s) => s.t === 'write' && (s as { cell: string }).cell === 'answer.c2')).toBe(false);
  });

  it('includes 0 in operands', () => {
    const p: Problem = { op: 'add', operands: [50, 0], method: 'rtl', level: 1 };
    expect(answerFromSteps(p)).toBe('50');
  });

  it('throws on negative-result subtraction', () => {
    const p: Problem = { op: 'sub', operands: [3, 5], method: 'rtl', level: 1 };
    expect(() => deriveSteps(p)).toThrow();
  });

  it('every expect:true step is an answer write with a single-digit value', () => {
    const p: Problem = { op: 'add', operands: [678, 789], method: 'rtl', level: 1 };
    for (const s of deriveSteps(p)) {
      if (s.t === 'write' && s.expect === true) {
        expect(s.cell.startsWith('answer.')).toBe(true);
        expect(s.value).toMatch(/^[0-9]$/);
      }
    }
  });
});

// ── 생성기 ───────────────────────────────────────────────────────────────────

describe('generateProblem — determinism & constraints', () => {
  it('same seed → identical problem', () => {
    const a = generateProblem(42, { op: 'add', method: 'rtl', digits: 3, carry: true });
    const b = generateProblem(42, { op: 'add', method: 'rtl', digits: 3, carry: true });
    expect(a).toEqual(b);
  });

  it('respects digits constraint (operand length, leading digit nonzero)', () => {
    for (const seed of [1, 2, 3, 7, 99]) {
      const p = generateProblem(seed, { op: 'add', method: 'ltr', digits: 3, carry: true });
      expect(String(p.operands[0]).length).toBe(3);
      expect(String(p.operands[1]).length).toBe(3);
      expect(String(p.operands[0])[0]).not.toBe('0');
    }
  });

  it('carry=true produces a carry, carry=false produces none (add)', () => {
    const withCarry = generateProblem(11, { op: 'add', method: 'rtl', digits: 3, carry: true });
    const a = withCarry.operands[0] ?? 0;
    const b = withCarry.operands[1] ?? 0;
    // 적어도 한 자리에서 합 >= 10
    let any = false;
    let x: number = a;
    let y: number = b;
    while (x > 0 || y > 0) {
      if ((x % 10) + (y % 10) >= 10) any = true;
      x = Math.floor(x / 10);
      y = Math.floor(y / 10);
    }
    expect(any).toBe(true);

    const noCarry = generateProblem(11, { op: 'add', method: 'rtl', digits: 3, carry: false });
    let none = true;
    x = noCarry.operands[0] ?? 0;
    y = noCarry.operands[1] ?? 0;
    while (x > 0 || y > 0) {
      if ((x % 10) + (y % 10) >= 10) none = false;
      x = Math.floor(x / 10);
      y = Math.floor(y / 10);
    }
    expect(none).toBe(true);
  });

  it('sub always yields operands[0] >= operands[1] and borrow flag honored', () => {
    for (const carry of [true, false]) {
      for (const seed of [3, 5, 8]) {
        const p = generateProblem(seed, { op: 'sub', method: 'rtl', digits: 2, carry });
        const hi = p.operands[0] ?? 0;
        const lo = p.operands[1] ?? 0;
        expect(hi).toBeGreaterThanOrEqual(lo);
        expect(hi - lo).toBeGreaterThan(0);
      }
    }
  });

  it('generateProblems produces N distinct problems deterministically', () => {
    const list1 = generateProblems(100, { op: 'add', method: 'rtl', digits: 2, carry: true }, 5);
    const list2 = generateProblems(100, { op: 'add', method: 'rtl', digits: 2, carry: true }, 5);
    expect(list1).toEqual(list2);
    expect(list1.length).toBe(5);
    const keys = new Set(list1.map((p) => `${p.operands[0]}_${p.operands[1]}`));
    expect(keys.size).toBe(5);
  });

  it('uses digits for the division dividend and honors the remainder flag', () => {
    for (const carry of [true, false]) {
      for (let seed = 1; seed <= 100; seed++) {
        const p = generateProblem(seed, { op: 'div', method: 'div-1', digits: 3, carry });
        const [dividend, divisor] = p.operands as readonly [number, number];
        expect(String(dividend)).toHaveLength(3);
        expect(dividend % divisor === 0).toBe(!carry);
      }
    }
  });

  it('generates a meaningful two-digit factorized operand for mul-factor', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const p = generateProblem(seed, { op: 'mul', method: 'mul-factor', digits: 2, carry: true });
      const factorized = p.operands[1] ?? 0;
      expect(factorized).toBeGreaterThanOrEqual(10);
      expect(factorized).toBeLessThanOrEqual(99);
      expect(
        Array.from({ length: 8 }, (_, i) => i + 2).some(
          (factor) => factorized % factor === 0 && factorized / factor >= 2 && factorized / factor <= 9
        )
      ).toBe(true);
    }
  });

  it('generates mul-3x3 operands around one shared nearby hundred base', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const p = generateProblem(seed, { op: 'mul', method: 'mul-3x3', digits: 3, carry: true });
      const [a, b] = p.operands as readonly [number, number];
      const base = Math.round(a / 100) * 100;
      expect(Math.round(b / 100) * 100).toBe(base);
      expect(Math.abs(a - base)).toBeLessThanOrEqual(49);
      expect(Math.abs(b - base)).toBeLessThanOrEqual(49);
    }
  });

  it('keeps generated estimation subtraction non-negative (seed 35 regression)', () => {
    const problems = generateProblems(
      35,
      { op: 'est', method: 'est-digit', digits: 3, carry: true, estOf: 'sub' },
      3
    );
    for (const p of problems) {
      expect(p.operands[0]).toBeGreaterThanOrEqual(p.operands[1] ?? 0);
      const writes = deriveSteps(p).filter((step) => step.t === 'write');
      expect(writes.every((step) => /^[0-9]$/.test(step.value))).toBe(true);
    }
  });
});

/** 라벨 문자열 → 안정적 시드(테스트 케이스 독립성). */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
