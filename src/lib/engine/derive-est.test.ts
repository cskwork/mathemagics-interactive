import { describe, expect, it } from 'vitest';
import { deriveEstSteps, estimationBand } from './derive-est.js';
import type { EstimationBand, Problem } from './types.js';

describe('estimationBand — answer is a range containing the exact value', () => {
  it('band [low, high] always contains the exact value', () => {
    const cases: ReadonlyArray<Problem> = [
      { op: 'est', operands: [23859379, 7426087], method: 'est-digit', level: 1, estOf: 'add' },
      { op: 'est', operands: [8367, 5819], method: 'est-digit', level: 1, estOf: 'sub' },
      { op: 'est', operands: [88, 54], method: 'est-digit', level: 1, estOf: 'mul' },
      { op: 'est', operands: [93000, 186], method: 'est-digit', level: 1, estOf: 'div' }
    ];
    for (const p of cases) {
      const band: EstimationBand = estimationBand(p);
      expect(band.low).toBeLessThanOrEqual(band.exact);
      expect(band.high).toBeGreaterThanOrEqual(band.exact);
    }
  });

  it('addition estimate: 23.9m + 7.4m ≈ 31m-ish (relative error small for big numbers)', () => {
    const p: Problem = {
      op: 'est',
      operands: [23859379, 7426087],
      method: 'est-digit',
      level: 1,
      estOf: 'add'
    };
    const band = estimationBand(p);
    const exact = 23859379 + 7426087;
    const relErr = Math.abs(band.estimate - exact) / exact;
    expect(relErr).toBeLessThan(0.05); // 5% 이내
  });

  it('multiplication estimate rounds 3+ digit numbers before multiplying', () => {
    const p: Problem = { op: 'est', operands: [883, 541], method: 'est-digit', level: 1, estOf: 'mul' };
    const band = estimationBand(p);
    // 883→880, 541→540 → 880×540=475200 (정확 477703, ~0.5% 오차)
    expect(band.estimate).toBe(475200);
  });

  it('roundingNote records the rounded expression', () => {
    const p: Problem = { op: 'est', operands: [8367, 5819], method: 'est-digit', level: 1, estOf: 'sub' };
    const band = estimationBand(p);
    expect(band.roundingNote.ko).toContain('8400');
    expect(band.roundingNote.ko).toContain('5800');
  });
});

describe('deriveEstSteps — substitution chain + range answer', () => {
  it('emits branch steps (rounding substitutions) when numbers are not already round', () => {
    const p: Problem = { op: 'est', operands: [8367, 5819], method: 'est-digit', level: 1, estOf: 'sub' };
    const steps = deriveEstSteps(p);
    const branches = steps.filter((s) => s.t === 'branch');
    expect(branches.length).toBe(2); // 두 수 모두 반올림
  });

  it('emits a write step for the canonical estimate', () => {
    const p: Problem = { op: 'est', operands: [883, 541], method: 'est-digit', level: 1, estOf: 'mul' };
    const steps = deriveEstSteps(p);
    const writes = steps.filter((s) => s.t === 'write');
    expect(writes.length).toBeGreaterThan(0);
  });
});
