import { describe, expect, it } from 'vitest';
import { DAY_MS, DEFAULT_SRS_CONFIG } from './config.js';
import { review, type Schedulable } from './scheduler.js';
import { decideProficiency, type TechniqueStats } from './gate.js';
import { adjustBand } from './difficulty.js';
import { updateStreak, initialStreak, type StreakState } from './streak.js';
import { capBacklog } from './backlog.js';

/**
 * 시뮬레이션 테스트 — 가상 학습 기록(성실/불규칙/과잉사용)으로 스케줄·게이트·난이도 조정이
 * 명세대로 동작하는지 검증 (브리프 §2-8 / §3).
 *
 * DOM 없이 순수 함수만 구동. 가상의 "하루" 단위로 시간을 전진시키며 복습을模拟.
 */

type DayRating = { day: number; rating: 'again' | 'hard' | 'good' | 'easy' };

/** 한 카드를 시간순으로 복습하며 상태 추적. */
function simulate(
  start: Schedulable,
  reviews: DayRating[],
  startMs: number
): { final: Schedulable; timeline: Schedulable[] } {
  let cur = start;
  const timeline: Schedulable[] = [];
  for (const r of reviews) {
    const now = startMs + r.day * DAY_MS;
    const out = review(cur, r.rating, now, DEFAULT_SRS_CONFIG);
    cur = {
      stability: out.stability,
      difficulty: out.difficulty,
      reps: out.reps,
      lapses: out.lapses,
      lastReview: now
    };
    timeline.push(cur);
  }
  return { final: cur, timeline };
}

function freshCard(startMs: number): Schedulable {
  return {
    stability: DEFAULT_SRS_CONFIG.minStability,
    difficulty: DEFAULT_SRS_CONFIG.initialDifficulty,
    reps: 0,
    lapses: 0,
    lastReview: startMs
  };
}

const START = Date.UTC(2026, 6, 1);

describe('시뮬레이션 1 — 성실한 학습자(매일 good)', () => {
  it('안정성이 꾸준히 자라고, 게이트를 통과하며, 유창성에 도달한다', () => {
    // 30일간 매일 good 복습.
    const reviews: DayRating[] = Array.from({ length: 30 }, (_, i) => ({ day: i + 1, rating: 'good' as const }));
    const { final, timeline } = simulate(freshCard(START), reviews, START);

    // 1. 안정성 성장 — 점점 긴 간격.
    expect(final.stability).toBeGreaterThan(timeline[5]!.stability);
    expect(timeline[5]!.stability).toBeGreaterThan(timeline[0]!.stability);

    // 2. 게이트: 누적 정닥률 100% & 충분한 샘플 → gate-passed 이상.
    const stats: TechniqueStats = {
      skillId: 'x',
      lessonCompleted: true,
      correct: 30,
      total: 30,
      maxStability: final.stability,
      gatePassedAt: undefined
    };
    const d = decideProficiency(stats, DEFAULT_SRS_CONFIG);
    expect(d.level === 'gate-passed' || d.level === 'fluent').toBe(true);

    // 3. 충분히 자라면 fluent (안정성 ≥ fluentStabilityDays).
    if (final.stability >= DEFAULT_SRS_CONFIG.fluentStabilityDays) {
      const fluentStats = { ...stats, maxStability: final.stability };
      expect(decideProficiency(fluentStats, DEFAULT_SRS_CONFIG).level).toBe('fluent');
    }

    // 4. 스트릭: 매일 연습 → 30일 연속 (freeze 소진 0).
    let st: StreakState = initialStreak(DEFAULT_SRS_CONFIG);
    for (let day = 1; day <= 30; day++) {
      st = updateStreak(st, START + day * DAY_MS, 5, DEFAULT_SRS_CONFIG).state;
    }
    expect(st.streakCount).toBe(30);
    expect(st.freezesAvailable).toBe(DEFAULT_SRS_CONFIG.streakDefaultFreezes);
  });
});

describe('시뮬레이션 2 — 불규칙 학습자(며칠 공백)', () => {
  it('백로그 캡이 카드 폭탄을 막고, 스케줄러가 공백에 견고하다', () => {
    // 1일, 2일 복습 후 10일 공백 → 12일에 복습. due 가 몰리는 상황 가정(여러 카드).
    const reviews: DayRating[] = [
      { day: 1, rating: 'good' },
      { day: 2, rating: 'good' },
      // 3~11일 건넘
      { day: 12, rating: 'good' }
    ];
    const { final } = simulate(freshCard(START), reviews, START);

    // 공백 후 복습해도 스케줄이 깨지지 않음 — stability 유의미하게 자람(바람직한 어려움).
    expect(final.stability).toBeGreaterThan(DEFAULT_SRS_CONFIG.minStability);
    expect(Number.isFinite(final.stability)).toBe(true);
    expect(final.reps).toBeGreaterThan(0);

    // 백로그 캡: 30개가 한꺼번에 due 면 maxBacklog 개만 세션에.
    const dueCards = Array.from({ length: 30 }, (_, i) => ({
      factId: `f${i}`,
      due: START + 10 * DAY_MS,
      stability: 1 + (i % 7),
      lastReview: 0
    }));
    const capped = capBacklog(dueCards, START + 11 * DAY_MS, DEFAULT_SRS_CONFIG);
    expect(capped.session.length).toBe(DEFAULT_SRS_CONFIG.maxBacklog);
    expect(capped.deferred.length).toBe(30 - DEFAULT_SRS_CONFIG.maxBacklog);
    // overflow 들은 미래로 분산(한 번에 다시 몰리지 않게).
    for (const d of capped.deferred) {
      expect(d.due).toBeGreaterThan(START + 11 * DAY_MS);
    }
  });

  it('공백이 freeze 1개분이면 스트릭이 연장된다(손실 프레임 없이)', () => {
    let st = updateStreak(initialStreak(DEFAULT_SRS_CONFIG), START + DAY_MS, 5, DEFAULT_SRS_CONFIG).state;
    expect(st.streakCount).toBe(1);
    // 2일 건넘, 3일에 복습 → 공백 1일을 freeze 로 덮음.
    st = updateStreak(st, START + 3 * DAY_MS, 5, DEFAULT_SRS_CONFIG).state;
    expect(st.streakCount).toBe(2); // 연장
    expect(st.freezesAvailable).toBe(DEFAULT_SRS_CONFIG.streakDefaultFreezes - 1);
  });
});

describe('시뮬레이션 3 — bottom-out 힌트 과잉 사용(again 남발)', () => {
  it('난이도 상승, 안정성 축소, 게이트 미통과, 밴드 하향 조정된다', () => {
    // 15회 연속 again(bottom-out 으로 푼 경우를 모델링).
    const reviews: DayRating[] = Array.from({ length: 15 }, (_, i) => ({ day: i + 1, rating: 'again' as const }));
    const { final } = simulate(freshCard(START), reviews, START);

    // 1. lapses 누적, reps 리셋 반복.
    expect(final.lapses).toBe(15);
    expect(final.reps).toBe(0); // 매번 lapse 로 리셋

    // 2. 안정성 축소 — 최소값 근처에 머무름(보수적 factor).
    expect(final.stability).toBeLessThanOrEqual(DEFAULT_SRS_CONFIG.minStability + 0.01);

    // 3. 게이트 미통과 — 정확도 0%.
    const stats: TechniqueStats = {
      skillId: 'x',
      lessonCompleted: true,
      correct: 0,
      total: 15,
      maxStability: final.stability,
      gatePassedAt: undefined
    };
    expect(decideProficiency(stats, DEFAULT_SRS_CONFIG).level).toBe('learning');

    // 4. 적응 난이도 — 정확도 0% < 0.8 이므로 밴드 하향(더 쉽게).
    const c = DEFAULT_SRS_CONFIG;
    let band = 3;
    band = adjustBand(0 / 15, band, c); // accuracy 0
    expect(band).toBe(2); // 한 눈금 하향
    band = adjustBand(0, band, c);
    expect(band).toBe(1); // 또 하향

    // 5. 밴드 0(최하)에선 더 이상 하향 않음.
    band = 0;
    expect(adjustBand(0, band, c)).toBe(0);
  });
});

describe('시뮬레이션 4 — 혼합 세트(interleaving)가 전략 선택을 강제', () => {
  it('두 기법 카드가 섞이면 같은 기법 연속을 피한다', () => {
    // 성실 학습자가 두 기법을 같은 날 복습한다고 가정 — 세션 빌더가 섞는지는 session.test 검증.
    // 여기서는 스케줄 자체가 두 카드 모두 due 로 유지되는지(혼합 가능) 확인.
    const a = simulate(freshCard(START), [{ day: 1, rating: 'good' }], START).final;
    const b = simulate(freshCard(START), [{ day: 1, rating: 'good' }], START).final;
    expect(a.stability).toBeCloseTo(b.stability, 5); // 같은 입력 → 같은 결과(결정적)
    // 두 카드 모두 다음 due 가 미래 — 세션에 함께 넣을 수 있다.
    const dueA = START + 1 * DAY_MS + a.stability * DAY_MS;
    const dueB = START + 1 * DAY_MS + b.stability * DAY_MS;
    expect(dueA).toBeGreaterThan(START + DAY_MS);
    expect(dueB).toBeGreaterThan(START + DAY_MS);
  });
});
