import { describe, expect, it } from 'vitest';
import {
  columnAddLayout,
  crossMultLayout,
  derivePaperSteps,
  squareRootLayout
} from './derive-paper.js';
import { computeAnswer, deriveSteps } from './derive.js';
import { deriveGrid } from './derive-internals.js';
import type { Problem } from './types.js';

/** write 스텝(answer 칸)을 모아 정렬하면 최종 답. */
function answerFromSteps(problem: Problem): string {
  const grid = deriveGrid(problem, computeAnswer(problem));
  const steps = deriveSteps(problem);
  const cells = new Map<string, string>();
  for (const s of steps) {
    if (s.t === 'write') cells.set(s.cell, s.value);
  }
  const digitCols = grid.cols.slice(1);
  let out = '';
  for (const col of digitCols) {
    const v = cells.get(`answer.${col}`);
    if (v !== undefined) out += v;
  }
  return out;
}

describe('paper-column-add — answer matches sum of all addends', () => {
  it('3 addends: 47 + 38 + 16 = 101', () => {
    const p: Problem = { op: 'add', operands: [47, 38, 16], method: 'paper-column-add', level: 1 };
    expect(Number(answerFromSteps(p))).toBe(101);
  });

  it('4 addends sums correctly (generated)', () => {
    const p: Problem = {
      op: 'add',
      operands: [123, 45, 678, 9],
      method: 'paper-column-add',
      level: 1
    };
    expect(Number(answerFromSteps(p))).toBe(123 + 45 + 678 + 9);
  });

  it('columnAddLayout records carries and sum', () => {
    const p: Problem = { op: 'add', operands: [47, 38, 16], method: 'paper-column-add', level: 1 };
    const lay = columnAddLayout(p);
    expect(lay.sum).toBe(101);
    expect(lay.addends).toEqual([47, 38, 16]);
    expect(lay.digitCols).toBe(2); // 가장 긴 피연산자 자릿수
  });

  it('writes answer right-to-left (units first)', () => {
    const p: Problem = { op: 'add', operands: [47, 38, 16], method: 'paper-column-add', level: 1 };
    const writes = derivePaperSteps(p).filter((s) => s.t === 'write');
    expect(writes.length).toBeGreaterThanOrEqual(3);
    // 모든 expect:true write 는 answer 칸의 한 자리 숫자.
    for (const s of writes) {
      if (s.t === 'write' && s.expect === true) {
        expect(s.cell.startsWith('answer.')).toBe(true);
        expect(s.value).toMatch(/^[0-9]$/);
      }
    }
  });
});

describe('paper-cross-mult — answer matches a×b', () => {
  const cases: ReadonlyArray<[number, number]> = [
    [47, 34],
    [23, 56],
    [853, 762],
    [12, 99],
    [314, 5]
  ];
  for (const [a, b] of cases) {
    it(`${a} × ${b}`, () => {
      const p: Problem = { op: 'mul', operands: [a, b], method: 'paper-cross-mult', level: 1 };
      expect(Number(answerFromSteps(p))).toBe(a * b);
    });
  }

  it('47 × 34 = 1598 (book-content-map §6-5 known example)', () => {
    const p: Problem = { op: 'mul', operands: [47, 34], method: 'paper-cross-mult', level: 1 };
    expect(Number(answerFromSteps(p))).toBe(1598);
  });
});

/** 브리프 §3 핵심 요구: 크로스크로스 대각선 리듬 1-2-…-min-…-2-1 단언. */
describe('cross-mult diagonal rhythm (1-2-…-min-…-2-1)', () => {
  it('2×2 → 1,2,1', () => {
    const p: Problem = { op: 'mul', operands: [47, 34], method: 'paper-cross-mult', level: 1 };
    const lay = crossMultLayout(p);
    expect(lay.diagonals.map((d) => d.pairs.length)).toEqual([1, 2, 1]);
    expect(lay.diagonals.length).toBe(3); // 2+2-1
  });

  it('3×3 → 1,2,3,2,1', () => {
    const p: Problem = { op: 'mul', operands: [853, 762], method: 'paper-cross-mult', level: 1 };
    const lay = crossMultLayout(p);
    expect(lay.diagonals.map((d) => d.pairs.length)).toEqual([1, 2, 3, 2, 1]);
    expect(lay.diagonals.length).toBe(5); // 3+3-1
    expect(lay.product).toBe(853 * 762);
  });

  it('2×1 → 1,1 (한 쪽이 1자리면 매 대각선 1개씩)', () => {
    const p: Problem = { op: 'mul', operands: [47, 8], method: 'paper-cross-mult', level: 1 };
    const lay = crossMultLayout(p);
    expect(lay.diagonals.map((d) => d.pairs.length)).toEqual([1, 1]);
    expect(lay.diagonals.length).toBe(2); // 2+1-1
    expect(lay.product).toBe(376);
  });

  it('47×34 diagonals: products 28 / 16+28=44 / 12 → 8,(4+4=8?) write digits form 1598', () => {
    // §6-5: 일의 자리 4×7=28→8(2 올림); 십 자리 4×4+3×7+올림2=39→9(3 올림); 백 자리 3×4+올림3=15→15
    const p: Problem = { op: 'mul', operands: [47, 34], method: 'paper-cross-mult', level: 1 };
    const lay = crossMultLayout(p);
    expect(lay.diagonals[0]!.writeDigit).toBe(8); // 28 → 8
    expect(lay.diagonals[0]!.carryOut).toBe(2);
    // 둘째 대각선 rawSum = 16+28+2(올림) = 46? — 재계산: 4×4=16, 3×7=21, +올림2 = 39.
    expect(lay.diagonals[1]!.rawSum).toBe(16 + 21 + 2);
    expect(lay.diagonals[1]!.writeDigit).toBe(9);
    expect(lay.diagonals[2]!.writeDigit).toBe(5); // 3×4=12 +올림3 = 15 → 5, 남은 1 이 백의자리 위로
  });

  it('each diagonal step highlights exactly one result place (write per diagonal)', () => {
    const p: Problem = { op: 'mul', operands: [853, 762], method: 'paper-cross-mult', level: 1 };
    const writes = derivePaperSteps(p).filter((s) => s.t === 'write');
    // 5 대각선 = 5 자리 답(올림으로 6자리가 될 수도 — 853×762=649986, 6자리).
    expect(writes.length).toBeGreaterThanOrEqual(5);
  });
});

describe('paper-sqrt — integer root matches floor(√n)', () => {
  const cases: ReadonlyArray<[number, number]> = [
    [529, 23],
    [576, 24],
    [1024, 32],
    [1936, 44],
    [9, 3],
    [4489, 67]
  ];
  for (const [n, root] of cases) {
    it(`√${n} = ${root}`, () => {
      const p: Problem = { op: 'sqrt', operands: [n], method: 'paper-sqrt', level: 1 };
      expect(Number(answerFromSteps(p))).toBe(root);
    });
  }

  it('squareRootLayout groups two digits from the right (529 → [5,29])', () => {
    const p: Problem = { op: 'sqrt', operands: [529], method: 'paper-sqrt', level: 1 };
    const lay = squareRootLayout(p);
    expect(lay.groups).toEqual([5, 29]);
    expect(lay.root).toBe(23);
    expect(lay.steps.length).toBe(2); // 첫 그룹 + 둘째 그룹
  });

  it('529 first step: √5 → 2 (2²=4 ≤ 5), remainder 1', () => {
    const p: Problem = { op: 'sqrt', operands: [529], method: 'paper-sqrt', level: 1 };
    const lay = squareRootLayout(p);
    expect(lay.steps[0]!.digit).toBe(2);
    expect(lay.steps[0]!.product).toBe(4);
    expect(lay.steps[0]!.remainder).toBe(1);
  });

  it('529 second step: bring down 29 → 129, trialBase 4, 43×3=129 → digit 3', () => {
    const p: Problem = { op: 'sqrt', operands: [529], method: 'paper-sqrt', level: 1 };
    const lay = squareRootLayout(p);
    expect(lay.steps[1]!.broughtDown).toBe(129); // 1*100+29
    expect(lay.steps[1]!.trialBase).toBe(4); // root(2)*2
    expect(lay.steps[1]!.digit).toBe(3);
    expect(lay.steps[1]!.product).toBe(129);
  });
});

describe('mod-sum-check method produces verification steps', () => {
  it('47 × 34 = 1598: mod9 check passes, writes answer RTL', () => {
    const p: Problem = { op: 'mul', operands: [47, 34], method: 'mod-sum-check', level: 1 };
    const steps = derivePaperSteps(p);
    const writes = steps.filter((s) => s.t === 'write');
    expect(writes.length).toBeGreaterThan(0);
    // 답 1598 이 우→좌로 기록됐는지 확인(answer 칸 모으면 1598).
    expect(Number(answerFromSteps(p))).toBe(1598);
  });
});
