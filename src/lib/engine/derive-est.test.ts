import { describe, expect, it } from 'vitest';
import { deriveEstSteps, estimationBand } from './derive-est.js';
import { generateProblem } from './generate.js';
import type { EstimationBand, Problem } from './types.js';

describe('estimationBand — bounds come from directed operand rounding', () => {
  it('band [low, high] contains the exact value without using it to form the bounds', () => {
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

  it('855 × 888 uses one-up/one-down estimate within both-down/both-up bounds', () => {
    const p: Problem = { op: 'est', operands: [855, 888], method: 'est-band', level: 1, estOf: 'mul' };
    const band = estimationBand(p);
    expect(band).toMatchObject({ estimate: 756800, low: 748000, high: 765400, exact: 759240 });
    expect(band.roundingNote.en).toBe('860 × 880');
  });

  it('1049 − 951 gets mathematical rounding bounds that contain both estimate and exact', () => {
    const p: Problem = { op: 'est', operands: [1049, 951], method: 'est-digit', level: 1, estOf: 'sub' };
    const band = estimationBand(p);
    expect(band).toMatchObject({ estimate: 50, low: 40, high: 150, exact: 98 });
  });

  it('generated est-band problems really move one operand up and the other down', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const p = generateProblem(seed, { op: 'est', method: 'est-band', digits: 3, carry: true, estOf: 'mul' });
      const [a, b] = p.operands as readonly [number, number];
      const band = estimationBand(p);
      expect(band.roundedOperands.a.up).toBeGreaterThan(a);
      expect(band.roundedOperands.b.down).toBeLessThan(b);
    }
  });

  it('addition estimate: 23.9m + 7.4m ≈ 31m-ish', () => {
    const p: Problem = {
      op: 'est',
      operands: [23859379, 7426087],
      method: 'est-digit',
      level: 1,
      estOf: 'add'
    };
    const band = estimationBand(p);
    expect(band.estimate).toBe(31_400_000);
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

  it('keeps the rounded division estimate inside its displayed integer band', () => {
    const p: Problem = { op: 'est', operands: [93000, 186], method: 'est-digit', level: 1, estOf: 'div' };
    const band = estimationBand(p);
    expect(band.estimate).toBe(489);
    expect(band.low).toBeLessThanOrEqual(band.estimate);
    expect(band.high).toBeGreaterThanOrEqual(band.estimate);
    expect(Number.isInteger(band.low)).toBe(true);
    expect(Number.isInteger(band.high)).toBe(true);
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

  it('does not narrate the estimate or exact answer before estimate input', () => {
    const p: Problem = { op: 'est', operands: [883, 541], method: 'est-digit', level: 1, estOf: 'mul' };
    const band = estimationBand(p);
    const steps = deriveEstSteps(p);
    const firstExpected = steps.findIndex((step) => step.t === 'write' && step.expect === true);
    const beforeInput = steps.slice(0, firstExpected).flatMap((step) =>
      'narration' in step && step.narration ? [step.narration.ko, step.narration.en ?? ''] : []
    );
    expect(beforeInput.join(' ')).not.toContain(String(band.estimate));
    expect(beforeInput.join(' ')).not.toContain(String(band.exact));
  });
});
