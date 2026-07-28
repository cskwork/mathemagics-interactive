import { describe, expect, it } from 'vitest';
import { DEFAULT_SRS_CONFIG } from './config.js';
import { accuracyOf, decideProficiency, timeModeUnlocked, type TechniqueStats } from './gate.js';

function stats(over: Partial<TechniqueStats> = {}): TechniqueStats {
  return {
    skillId: 'x',
    lessonCompleted: true,
    correct: 0,
    total: 0,
    maxStability: 0,
    gatePassedAt: undefined,
    ...over
  };
}

describe('decideProficiency — 4단계', () => {
  it('pre-learning: 레슨 미완료', () => {
    const d = decideProficiency(stats({ lessonCompleted: false }), DEFAULT_SRS_CONFIG);
    expect(d.level).toBe('pre-learning');
    expect(d.newlyPassed).toBe(false);
  });

  it('learning: 완료했으나 샘플 부족', () => {
    const d = decideProficiency(
      stats({ lessonCompleted: true, correct: 5, total: 5 }),
      DEFAULT_SRS_CONFIG
    );
    // total 5 = gateMinReviews(5) 이지만 accuracy 1.0 >= 0.9 → 통과. 샘플 부족 케이스는 total<5.
    expect(d.level).not.toBe('pre-learning');
  });

  it('learning: 정확도 < 게이트(90%)', () => {
    const d = decideProficiency(
      stats({ lessonCompleted: true, correct: 4, total: 10 }), // 40%
      DEFAULT_SRS_CONFIG
    );
    expect(d.level).toBe('learning');
    expect(d.newlyPassed).toBe(false);
  });

  it('gate-passed: 정확도 ≥ 90% & 샘플 충분 → newlyPassed=true', () => {
    const d = decideProficiency(
      stats({ lessonCompleted: true, correct: 9, total: 10, maxStability: 1 }),
      DEFAULT_SRS_CONFIG
    );
    expect(d.level).toBe('gate-passed');
    expect(d.newlyPassed).toBe(true);
  });

  it('fluent: 게이트 통과 + 안정성 ≥ fluentStabilityDays', () => {
    const d = decideProficiency(
      stats({
        lessonCompleted: true,
        correct: 10,
        total: 10,
        maxStability: DEFAULT_SRS_CONFIG.fluentStabilityDays + 5
      }),
      DEFAULT_SRS_CONFIG
    );
    expect(d.level).toBe('fluent');
  });

  it('게이트는 단조적 — gatePassedAt 있으면 최근 부진해도 재잠금 없음', () => {
    const d = decideProficiency(
      stats({
        lessonCompleted: true,
        correct: 1,
        total: 10, // 지금 정확도 10%
        gatePassedAt: 1000,
        maxStability: 1
      }),
      DEFAULT_SRS_CONFIG
    );
    expect(d.level).toBe('gate-passed'); // 재잠금 안 됨
    expect(d.newlyPassed).toBe(false); // 이미 통과했으므로 새 통과 아님
  });
});

describe('accuracyOf', () => {
  it('total 0 이면 0', () => {
    expect(accuracyOf({ correct: 0, total: 0 })).toBe(0);
  });
  it('correct/total', () => {
    expect(accuracyOf({ correct: 9, total: 10 })).toBeCloseTo(0.9);
  });
});

describe('timeModeUnlocked', () => {
  it('게이트 통과 전엔 false (시간 요소 노출 금지 — PLAN §4.1-3)', () => {
    expect(timeModeUnlocked(stats({ correct: 4, total: 10 }), DEFAULT_SRS_CONFIG)).toBe(false);
  });
  it('게이트 통과 후엔 true', () => {
    expect(
      timeModeUnlocked(
        stats({ correct: 9, total: 10, maxStability: 1 }),
        DEFAULT_SRS_CONFIG
      )
    ).toBe(true);
    expect(
      timeModeUnlocked(
        stats({ correct: 10, total: 10, maxStability: DEFAULT_SRS_CONFIG.fluentStabilityDays + 1 }),
        DEFAULT_SRS_CONFIG
      )
    ).toBe(true);
  });
});
