/**
 * 관대한 스트릭 — 순수 함수. PLAN §4.2-11 / teaching-trends §2.1·§2.2.
 *
 * 스트릭은 효과 근거가 있으나 손실 회피 압박은 내적 동기 잠식·다크패턴 경계선
 * (teaching-trends §2.2). 그래서:
 *  - 하루 최소량 낮게(streakMinDailyReviews, 기본 1).
 *  - freeze 기본 제공(streakDefaultFreezes, 자동 적용) — 공백 하루가 스트릭을 끊지 않음.
 *  - 손실 위협 연출 금지 — UI 는 "N일 연속" 표시만, "잃을 뻔했어요!" 같은 프레임 없음.
 */
import type { SrsConfig } from './config.js';
import { daysBetween, startOfDay } from './config.js';

/** 프로필 스트릭 상태(Settings 에 optional 로 저장). */
export interface StreakState {
  readonly streakCount: number;
  readonly lastStreakDayMs: number;
  readonly freezesAvailable: number;
}

export interface StreakUpdate {
  readonly state: StreakState;
  /** 이번 갱신으로 일어난 일(UI 피드백용, 손실 프레임 아님). */
  readonly event: 'same-day' | 'continued' | 'freeze-used' | 'fresh-start';
  /** freeze 가 소진된 일 수(계산/표시용). */
  readonly freezesUsed: number;
}

/** 초기 스트릭 — 아직 연습 안 함. freeze 는 기본 제공. */
export function initialStreak(config: SrsConfig): StreakState {
  return {
    streakCount: 0,
    lastStreakDayMs: 0,
    freezesAvailable: config.streakDefaultFreezes
  };
}

/**
 * 오늘의 연습을 마친 뒤 스트릭 갱신. 순수 함수.
 *
 * @param prev 이전 상태.
 * @param todayNow 오늘 기준 시각(ms).
 * @param reviewsDoneToday 오늘 한 복습 수(최소량 충족 여부).
 * @param config
 */
export function updateStreak(
  prev: StreakState,
  todayNow: number,
  reviewsDoneToday: number,
  config: SrsConfig
): StreakUpdate {
  // 최소량 못 채웠으면 스트릭 변화 없음(손실도 없음 — 그냥 미적용).
  if (reviewsDoneToday < config.streakMinDailyReviews) {
    return { state: prev, event: 'same-day', freezesUsed: 0 };
  }

  const today = startOfDay(todayNow);

  // 첫 연습.
  if (prev.streakCount === 0 || prev.lastStreakDayMs === 0) {
    return {
      state: { streakCount: 1, lastStreakDayMs: today, freezesAvailable: prev.freezesAvailable },
      event: 'fresh-start',
      freezesUsed: 0
    };
  }

  const gap = daysBetween(prev.lastStreakDayMs, todayNow); // 1 = 어제 연속, 2+ = 공백 있음

  // 같은 날 또 연습 — 카운트 변화 없음.
  if (gap <= 0) {
    return { state: prev, event: 'same-day', freezesUsed: 0 };
  }

  // 어제 연속 → 스트릭 +1.
  if (gap === 1) {
    return {
      state: {
        streakCount: prev.streakCount + 1,
        lastStreakDayMs: today,
        freezesAvailable: prev.freezesAvailable
      },
      event: 'continued',
      freezesUsed: 0
    };
  }

  // gap >= 2: 빠진 날 gap−1 개. freeze 로 일부 덮기.
  const missedDays = gap - 1;
  const freezesUsed = Math.min(missedDays, prev.freezesAvailable);

  // freeze 로 모든 빠진 날을 덮으면 스트릭 연장.
  if (freezesUsed === missedDays) {
    return {
      state: {
        streakCount: prev.streakCount + 1,
        lastStreakDayMs: today,
        freezesAvailable: prev.freezesAvailable - freezesUsed
      },
      event: freezesUsed > 0 ? 'freeze-used' : 'continued',
      freezesUsed
    };
  }

  // freeze 부족 → 새 출발(손실 프레임 없이 그냥 "새로 시작").
  return {
    state: {
      streakCount: 1,
      lastStreakDayMs: today,
      freezesAvailable: config.streakDefaultFreezes
    },
    event: 'fresh-start',
    freezesUsed: prev.freezesAvailable
  };
}
