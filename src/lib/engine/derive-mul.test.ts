import { describe, expect, it } from 'vitest';
import { deriveMulSteps, partialProducts, squareDiagram } from './derive-mul.js';
import { deriveSteps } from './derive.js';
import { deriveGrid } from './derive-internals.js';
import { generateProblem } from './generate.js';
import type { Problem } from './types.js';

/** write 스텝(answer 칸)을 모아 오른쪽 정렬하면 최종 답이어야 한다. */
function answerFromSteps(problem: Problem): string {
  const grid = deriveGrid(problem);
  const steps = deriveSteps(problem);
  const cells = new Map<string, string>();
  for (const s of steps) {
    if (s.t === 'write' || s.t === 'reveal') {
      if (s.t === 'reveal') for (const c of s.cells) cells.set(c, s.value);
      else cells.set(s.cell, s.value);
    }
  }
  const digitCols = grid.cols.slice(1);
  let out = '';
  for (const col of digitCols) {
    const v = cells.get(`answer.${col}`);
    if (v !== undefined) out += v;
  }
  return out;
}

describe('deriveMulSteps — mul-running (2×1, 3×1) answer matches a×b', () => {
  for (const digits of [2, 3]) {
    it(`${digits}×1`, () => {
      const p = generateProblem(7, { op: 'mul', method: 'mul-running', digits, carry: true });
      const a = p.operands[0] ?? 0; const b = p.operands[1] ?? 0;
      expect(Number(answerFromSteps(p))).toBe(a * b);
    });
  }

  it('2×1: 42 × 7 = 294 (known example)', () => {
    const p: Problem = { op: 'mul', operands: [42, 7], method: 'mul-running', level: 1 };
    expect(Number(answerFromSteps(p))).toBe(294);
  });

  it('3×1: 326 × 7 = 2282 (known example)', () => {
    const p: Problem = { op: 'mul', operands: [326, 7], method: 'mul-running', level: 1 };
    expect(Number(answerFromSteps(p))).toBe(2282);
  });

  it('produces running-total steps for the rolling counter', () => {
    const p: Problem = { op: 'mul', operands: [42, 7], method: 'mul-running', level: 1 };
    const steps = deriveMulSteps(p);
    const running = steps.filter((s) => s.t === 'running');
    expect(running.length).toBeGreaterThan(0);
    // 마지막 running total 은 최종 답.
    const last = running[running.length - 1];
    expect(last).toBeDefined();
    if (last && last.t === 'running') expect(last.total).toBe(294);
  });

  it('partialProducts decomposes by place (42×7 → 40×7=280, 2×7=14)', () => {
    const p: Problem = { op: 'mul', operands: [42, 7], method: 'mul-running', level: 1 };
    const parts = partialProducts(p);
    expect(parts.map((x) => x.product)).toEqual([280, 14]);
    expect(parts[parts.length - 1]!.runningTotal).toBe(294);
  });
});

describe('deriveMulSteps — square (2-digit, ±d) answer matches a²', () => {
  for (const a of [13, 77, 96, 25, 48, 31]) {
    it(`${a}²`, () => {
      const p: Problem = { op: 'mul', operands: [a, a], method: 'square', level: 1 };
      expect(Number(answerFromSteps(p))).toBe(a * a);
    });
  }

  it('77² = 5929 (known example: d=3, 80×74 + 9)', () => {
    const p: Problem = { op: 'mul', operands: [77, 77], method: 'square', level: 1 };
    expect(Number(answerFromSteps(p))).toBe(5929);
    const diag = squareDiagram(77);
    expect(diag.d).toBe(3);
    expect(diag.high).toBe(80);
    expect(diag.low).toBe(74);
    expect(diag.product).toBe(5920);
    expect(diag.dSquared).toBe(9);
    expect(diag.nested).toBeUndefined();
  });

  it('13² = 169 (d=3, 10×16 + 9)', () => {
    const diag = squareDiagram(13);
    expect(diag.answer).toBe(169);
    expect(diag.d).toBe(3);
  });

  it('emits branch steps for the X-diagram', () => {
    const p: Problem = { op: 'mul', operands: [77, 77], method: 'square', level: 1 };
    const steps = deriveMulSteps(p);
    const branches = steps.filter((s) => s.t === 'branch');
    expect(branches.length).toBe(2); // +d, −d
  });
});

describe('deriveMulSteps — square3 (3-digit, recursive nesting)', () => {
  it('636² = 404496 (known example: d=36, 600×672 + 36²)', () => {
    const p: Problem = { op: 'mul', operands: [636, 636], method: 'square', level: 1 };
    expect(Number(answerFromSteps(p))).toBe(404496);
  });

  it('squareDiagram(636) nests a 2-digit diagram for 36²', () => {
    const diag = squareDiagram(636);
    expect(diag.d).toBe(36);
    expect(diag.answer).toBe(404496);
    expect(diag.nested).toBeDefined();
    expect(diag.nested?.base).toBe(36);
    expect(diag.nested?.answer).toBe(1296); // 36²
    // 내부 다이어그램의 ±d: 36→40(+4)/32(−4)
    expect(diag.nested?.d).toBe(4);
  });

  it('recursive diagram terminates (no infinite recursion)', () => {
    // 3자리 제곱의 nested 는 2자리 제곱이고, 그 안의 nested 는 더 이상 의미있게 중첩되지 않는다.
    const diag = squareDiagram(359);
    expect(diag.answer).toBe(359 * 359);
    const nested = diag.nested;
    if (nested) {
      // 2자리 다이어그램은 자체 nested 가 없어야(또는 있어도 깊이 1).
      expect(nested.nested).toBeUndefined();
    }
  });

  it('every expect:true write step is an answer digit', () => {
    const p: Problem = { op: 'mul', operands: [77, 77], method: 'square', level: 1 };
    for (const s of deriveSteps(p)) {
      if (s.t === 'write' && s.expect === true) {
        expect(s.cell.startsWith('answer.')).toBe(true);
        expect(s.value).toMatch(/^[0-9]$/);
      }
    }
  });
});

/** 2×2 네 방법이 모두 같은 답에 도달하는 속성 테스트 (브리프 §3 핵심 요구). */
describe('2×2 four methods reach the same answer (property test)', () => {
  const cases: ReadonlyArray<[number, number]> = [
    [46, 42],
    [88, 23],
    [75, 63],
    [54, 11],
    [32, 47],
    [67, 59]
  ];
  const methods = ['mul-add', 'mul-sub', 'mul-factor', 'mul-11'] as const;

  for (const [a, b] of cases) {
    it(`${a} × ${b}: all applicable methods = ${a * b}`, () => {
      const product = a * b;
      for (const method of methods) {
        // 11법은 b=11 일 때만 적용; 인수분해법은 b 가 분해될 때만 적용.
        if (method === 'mul-11' && b !== 11) continue;
        const p: Problem = { op: 'mul', operands: [a, b], method, level: 1 };
        expect(Number(answerFromSteps(p))).toBe(product);
      }
    });
  }

  it('54 × 11 via mul-11 = 594 (no carry); 76 × 11 = 836 (carry)', () => {
    expect(
      Number(
        answerFromSteps({ op: 'mul', operands: [54, 11], method: 'mul-11', level: 1 })
      )
    ).toBe(594);
    expect(
      Number(
        answerFromSteps({ op: 'mul', operands: [76, 11], method: 'mul-11', level: 1 })
      )
    ).toBe(836);
  });
});

describe('partialProducts — per-method shapes', () => {
  it('mul-add (46×42): 40×46=1840, 2×46=92', () => {
    const p: Problem = { op: 'mul', operands: [46, 42], method: 'mul-add', level: 1 };
    const parts = partialProducts(p);
    expect(parts.map((x) => x.product)).toEqual([1840, 92]);
    expect(parts[parts.length - 1]!.runningTotal).toBe(1932);
  });

  it('mul-sub (88×23): 90×23=2070, −2×23=−46 → 2024', () => {
    const p: Problem = { op: 'mul', operands: [88, 23], method: 'mul-sub', level: 1 };
    const parts = partialProducts(p);
    expect(parts.map((x) => x.sign)).toEqual(['+', '-']);
    expect(parts[parts.length - 1]!.runningTotal).toBe(2024);
  });

  it('mul-factor (75×63): 63=9×7 → 75×9=675, 675×7=4725', () => {
    const p: Problem = { op: 'mul', operands: [75, 63], method: 'mul-factor', level: 1 };
    const parts = partialProducts(p);
    expect(parts.map((x) => x.product)).toEqual([675, 4725]);
  });
});
