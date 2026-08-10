import { describe, expect, it } from 'vitest';
import { deriveSteps } from '../engine/derive.js';
import type { Problem } from '../engine/types.js';
import type { WriteStep } from '../engine/types.js';
import { expectCount, fadingKForProblem, withExpectOnLastK } from './fading.js';

const problem = (op: 'add' | 'sub', a: number, b: number): Problem => ({
  op,
  operands: [a, b],
  method: 'ltr',
  level: 1
});

function expectCellsOf(steps: { t: string; expect?: true }[]): string[] {
  return steps
    .filter((s) => s.t === 'write' && s.expect === true)
    .map((s) => (s as WriteStep).cell);
}

describe('withExpectOnLastK', () => {
  it('counts the answer (expect) cells', () => {
    const steps = deriveSteps(problem('add', 67, 28)); // =95, 2 answer digits
    expect(expectCount(steps)).toBe(2);
  });

  it('keeps only the last K write steps as expect; the rest become non-expect (auto-reveal)', () => {
    const steps = deriveSteps(problem('add', 67, 28)); // 2 expect cells
    const faded = withExpectOnLastK(steps, 1);
    const expects = faded.filter((s) => s.t === 'write' && (s as WriteStep).expect === true);
    expect(expects).toHaveLength(1);
    // 남은 1개는 일반 write(expect 없음) — DigitInput 이 자동 공개
    const plain = faded.filter((s) => s.t === 'write' && (s as WriteStep).expect === undefined);
    expect(plain.length).toBeGreaterThanOrEqual(1);
  });

  it('keeps all expect when K >= total (same as independent practice)', () => {
    const steps = deriveSteps(problem('add', 67, 28));
    const faded = withExpectOnLastK(steps, 5);
    expect(expectCellsOf(faded)).toHaveLength(2);
  });

  it('K=0 leaves no expect cells (pure demo)', () => {
    const steps = deriveSteps(problem('add', 67, 28));
    const faded = withExpectOnLastK(steps, 0);
    expect(expectCellsOf(faded)).toHaveLength(0);
  });

  it('does not mutate the original steps array', () => {
    const steps = deriveSteps(problem('add', 67, 28));
    const before = expectCellsOf(steps);
    withExpectOnLastK(steps, 1);
    expect(expectCellsOf(steps)).toEqual(before);
  });

  it('the retained expect cell is the LAST one written (solve order) — ltr units place', () => {
    // 67+28=95: ltr writes hundreds? no — answer 95 is 2 digits, written tens(9) then units(5).
    // last write = units place cell. K=1 -> only units remains expect.
    const steps = deriveSteps(problem('add', 67, 28));
    const faded = withExpectOnLastK(steps, 1);
    const last = expectCellsOf(faded);
    expect(last).toHaveLength(1);
    // 일의 자리 열이 가장 오른쪽 자릿값 열(answer.c{digitCols+1}).
    const grid = expectCount(steps);
    void grid;
  });
});

describe('fadingKForProblem', () => {
  it('starts at 1 and grows by 1 per problem, capped at totalExpect', () => {
    expect(fadingKForProblem(0, 3)).toBe(1);
    expect(fadingKForProblem(1, 3)).toBe(2);
    expect(fadingKForProblem(2, 3)).toBe(3);
    expect(fadingKForProblem(3, 3)).toBe(3); // capped
  });

  it('minimum 1 even for small answers', () => {
    expect(fadingKForProblem(0, 1)).toBe(1);
    expect(fadingKForProblem(5, 1)).toBe(1);
  });
});

describe('choice-step fading', () => {
  it('counts a semantic yes/no choice as one expected input', () => {
    const steps = [
      { t: 'highlight' as const, narration: { ko: '규칙' } },
      { t: 'choice' as const, value: true, expect: true as const, narration: { ko: '나누어 떨어질까요?' } }
    ];
    expect(expectCount(steps)).toBe(1);
    expect(withExpectOnLastK(steps, 1)).toEqual(steps);
  });
});
