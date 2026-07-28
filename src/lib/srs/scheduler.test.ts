import { describe, expect, it } from 'vitest';
import {
  DAY_MS,
  DEFAULT_SRS_CONFIG,
  type SrsConfig
} from './config.js';
import {
  fuzzInterval,
  initialSchedulable,
  isDue,
  nextDifficulty,
  nextStability,
  review,
  retrievability,
  type Schedulable
} from './scheduler.js';

const NOW = Date.UTC(2026, 6, 29, 9, 0, 0); // 고정 기준

function card(over: Partial<Schedulable> = {}): Schedulable {
  return { stability: 2, difficulty: 5.5, reps: 3, lapses: 0, lastReview: NOW, ...over };
}

describe('retrievability (FSRS 멱법 망각곡선)', () => {
  it('R=1 at t=0 (방금 복습한 직후엔 완전히 기억)', () => {
    expect(retrievability(0, 2, DEFAULT_SRS_CONFIG)).toBeCloseTo(1);
  });
  it('R 단조 감소 — 경과일이 길수록 기억 감소', () => {
    const c = DEFAULT_SRS_CONFIG;
    const r1 = retrievability(1, 2, c);
    const r5 = retrievability(5, 2, c);
    const r30 = retrievability(30, 2, c);
    expect(r1).toBeGreaterThan(r5);
    expect(r5).toBeGreaterThan(r30);
    expect(r30).toBeGreaterThan(0);
    expect(r30).toBeLessThan(1);
  });
  it('안정성이 크면 더 느리게 잊는다 (같은 t 에서 R 더 높음)', () => {
    const c = DEFAULT_SRS_CONFIG;
    expect(retrievability(5, 10, c)).toBeGreaterThan(retrievability(5, 1, c));
  });
  it('음수 elapsedDays 는 0 처리(미래 복습도 R=1)', () => {
    expect(retrievability(-3, 2, DEFAULT_SRS_CONFIG)).toBeCloseTo(1);
  });
});

describe('nextDifficulty (평균 회귀, ease-hell 방지)', () => {
  it('again 은 난이도 증가, easy 는 난이도 감소', () => {
    const c = DEFAULT_SRS_CONFIG;
    const d0 = 5.5;
    expect(nextDifficulty(d0, 'again', c)).toBeGreaterThan(d0);
    expect(nextDifficulty(d0, 'easy', c)).toBeLessThan(d0);
    expect(nextDifficulty(d0, 'hard', c)).toBeGreaterThan(d0); // hard 도 약간 증가
    expect(nextDifficulty(d0, 'good', c)).toBeCloseTo(d0, 1); // good 은 거의 유지
  });
  it('범위 [minDifficulty, maxDifficulty] 클램프', () => {
    const c = DEFAULT_SRS_CONFIG;
    const hi = nextDifficulty(9.9, 'again', c);
    const lo = nextDifficulty(1.1, 'easy', c);
    expect(hi).toBeLessThanOrEqual(c.maxDifficulty);
    expect(lo).toBeGreaterThanOrEqual(c.minDifficulty);
  });
  it('평균 회귀 — 극단적 난이도가 초기값 쪽으로 당겨져 ease-hell 지속 방지', () => {
    const c = DEFAULT_SRS_CONFIG;
    // 난이도 10 에서 good 만 계속 반복하면 점차 initialDifficulty 로 회귀.
    let d = 10;
    for (let i = 0; i < 20; i++) d = nextDifficulty(d, 'good', c);
    expect(d).toBeLessThan(7); // 10 보다 확실히 내려옴
  });
});

describe('nextStability', () => {
  it('again(lapse) 은 안정성을 축소한다(보수적 factor)', () => {
    const c = DEFAULT_SRS_CONFIG;
    const s = nextStability(5, 'again', 0.5, 5.5, c);
    expect(s).toBeLessThan(5);
    expect(s).toBeGreaterThanOrEqual(c.minStability);
    expect(s).toBeCloseTo(5 * c.lapseStabilityFactor);
  });
  it('정답(hard/good/easy) 순으로 안정성 성장이 커진다', () => {
    const c = DEFAULT_SRS_CONFIG;
    const R = 0.9;
    const sh = nextStability(2, 'hard', R, 5, c);
    const sg = nextStability(2, 'good', R, 5, c);
    const se = nextStability(2, 'easy', R, 5, c);
    expect(sh).toBeLessThan(sg);
    expect(sg).toBeLessThan(se);
    expect(sg).toBeGreaterThan(2); // good 은 성장
  });
  it('바람직한 어려움 — R 낮을 때(방금 잊힐 즈음) 정답이 더 크게 강화', () => {
    const c = DEFAULT_SRS_CONFIG;
    const sLowR = nextStability(2, 'good', 0.3, 5, c);
    const sHighR = nextStability(2, 'good', 0.95, 5, c);
    expect(sLowR).toBeGreaterThan(sHighR);
  });
  it('난이도 높은 카드는 더 천천히 자란다', () => {
    const c = DEFAULT_SRS_CONFIG;
    const sEasy = nextStability(2, 'good', 0.9, c.minDifficulty, c);
    const sHard = nextStability(2, 'good', 0.9, c.maxDifficulty, c);
    expect(sEasy).toBeGreaterThan(sHard);
  });
  it('최대 안정성 상한 클램프', () => {
    const c = DEFAULT_SRS_CONFIG;
    const s = nextStability(c.maxStability, 'easy', 0.5, c.minDifficulty, c);
    expect(s).toBeLessThanOrEqual(c.maxStability);
  });
});

describe('fuzzInterval', () => {
  it('minIntervalDays 이하 간격은 퍼즈 미적용', () => {
    const c = DEFAULT_SRS_CONFIG;
    expect(fuzzInterval(c.minIntervalDays, 12345, c)).toBe(c.minIntervalDays);
  });
  it('퍼즈 범위 내에 머무른다 (±intervalFuzz)', () => {
    const c = DEFAULT_SRS_CONFIG;
    const base = 10;
    for (let seed = 0; seed < 50; seed++) {
      const f = fuzzInterval(base, seed, c);
      expect(f).toBeGreaterThanOrEqual(base * (1 - c.intervalFuzz) - 1e-9);
      expect(f).toBeLessThanOrEqual(base * (1 + c.intervalFuzz) + 1e-9);
    }
  });
});

describe('review (통합)', () => {
  it('again 은 lapses 증가·reps 리셋, good 은 reps 증가', () => {
    const c = DEFAULT_SRS_CONFIG;
    const outAgain = review(card({ reps: 3, lapses: 1 }), 'again', NOW + DAY_MS, c);
    expect(outAgain.lapses).toBe(2);
    expect(outAgain.reps).toBe(0); // lapse 시 reps 리셋

    const outGood = review(card({ reps: 3, lapses: 1 }), 'good', NOW + DAY_MS, c);
    expect(outGood.reps).toBe(4);
    expect(outGood.lapses).toBe(1);
  });
  it('due 는 now 이후(미래) — 다음 복습 예정', () => {
    const c = DEFAULT_SRS_CONFIG;
    const out = review(card(), 'good', NOW + 5 * DAY_MS, c);
    expect(out.due).toBeGreaterThan(NOW + 5 * DAY_MS);
    expect(out.intervalDays).toBeGreaterThan(0);
  });
  it('첫 복습(initialSchedulable) 에서 good 은 안정성이 자라고 due 가 잡힌다', () => {
    const c = DEFAULT_SRS_CONFIG;
    const fresh = initialSchedulable(c, NOW);
    const out = review(fresh, 'good', NOW + DAY_MS, c);
    expect(out.stability).toBeGreaterThan(fresh.stability);
    expect(out.reps).toBe(1);
    expect(out.due).toBeGreaterThan(NOW + DAY_MS);
  });
});

describe('isDue', () => {
  it('due ≤ now 이면 true', () => {
    expect(isDue({ due: 100 }, 100)).toBe(true);
    expect(isDue({ due: 50 }, 100)).toBe(true);
    expect(isDue({ due: 101 }, 100)).toBe(false);
  });
});

describe('보수성 — 기본값이 FSRS 성인 기본값보다 자주 복습', () => {
  it('기본 config 에서 good 연속 시 며칠 간격으로 자란다(너무 길어지지 않음)', () => {
    const c: SrsConfig = DEFAULT_SRS_CONFIG;
    let s = initialSchedulable(c, NOW);
    let last = NOW;
    const intervals: number[] = [];
    for (let i = 0; i < 6; i++) {
      const out = review(s, 'good', last + 1 * DAY_MS, c);
      intervals.push(out.intervalDays);
      s = { stability: out.stability, difficulty: out.difficulty, reps: out.reps, lapses: out.lapses, lastReview: last + DAY_MS };
      last = last + DAY_MS;
    }
    // 간격이 단조 증가(성장) 하되 폭발하지 않는다(보수적).
    expect(intervals[intervals.length - 1]!).toBeGreaterThan(intervals[0]!);
    expect(intervals[intervals.length - 1]!).toBeLessThan(60); // 6회 만에 2달 넘지 않음
  });
});
