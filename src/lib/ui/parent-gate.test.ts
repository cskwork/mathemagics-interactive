import { describe, expect, it } from 'vitest';
import {
  isParentGateCorrect,
  makeParentGateChallenge,
  type ParentGateChallenge
} from './parent-gate.js';

describe('makeParentGateChallenge', () => {
  it('produces a deterministic challenge for a fixed seed', () => {
    const a = makeParentGateChallenge(42);
    const b = makeParentGateChallenge(42);
    expect(a).toEqual(b);
    expect(a.answer).toBeGreaterThan(1);
    expect(a.answer).toBeLessThanOrEqual(18);
  });

  it('keeps both operands in 1..9 and the prompt parses back to the answer', () => {
    for (const seed of [0, 1, 7, 99, 1000, 123456]) {
      const c = makeParentGateChallenge(seed);
      const parts = c.prompt.split(' + ').map(Number);
      const x = parts[0];
      const y = parts[1];
      expect(x).toBeGreaterThanOrEqual(1);
      expect(x).toBeLessThanOrEqual(9);
      expect(y).toBeGreaterThanOrEqual(1);
      expect(y).toBeLessThanOrEqual(9);
      expect((x ?? NaN) + (y ?? NaN)).toBe(c.answer);
    }
  });
});

describe('isParentGateCorrect', () => {
  const challenge: ParentGateChallenge = { prompt: '7 + 5', answer: 12 };

  it('accepts the exact answer', () => {
    expect(isParentGateCorrect(challenge, '12')).toBe(true);
  });

  it('accepts the answer with surrounding whitespace', () => {
    expect(isParentGateCorrect(challenge, '  12 ')).toBe(true);
  });

  it('rejects a wrong number', () => {
    expect(isParentGateCorrect(challenge, '11')).toBe(false);
    expect(isParentGateCorrect(challenge, '13')).toBe(false);
  });

  it('rejects non-numeric / empty input without throwing', () => {
    expect(isParentGateCorrect(challenge, '')).toBe(false);
    expect(isParentGateCorrect(challenge, 'twelve')).toBe(false);
    expect(isParentGateCorrect(challenge, '7+5')).toBe(false);
  });
});
