import { describe, expect, it } from 'vitest';
import { DAY_MS, DEFAULT_SRS_CONFIG, daysBetween, startOfDay } from './config.js';
import { initialStreak, updateStreak, type StreakState } from './streak.js';

const DAY = DAY_MS;
// startOfDay 는 로컬 타임존 자정 기준이므로, 테스트 상수도 로컬 자정에서 파생(타임존 독립).
const T0 = startOfDay(Date.UTC(2026, 6, 1));

function state(over: Partial<StreakState> = {}): StreakState {
  return { streakCount: 3, lastStreakDayMs: T0, freezesAvailable: DEFAULT_SRS_CONFIG.streakDefaultFreezes, ...over };
}

describe('startOfDay / daysBetween', () => {
  it('자정으로 floor', () => {
    const noon = T0 + 12 * 3600 * 1000;
    expect(startOfDay(noon)).toBe(T0);
  });
  it('daysBetween 정수 일 수', () => {
    expect(daysBetween(T0, T0 + DAY)).toBe(1);
    expect(daysBetween(T0, T0)).toBe(0);
    expect(daysBetween(T0, T0 + 3 * DAY)).toBe(3);
    expect(daysBetween(T0 + DAY, T0)).toBe(-1);
  });
});

describe('updateStreak (관대한 스트릭, 손실 압박 없음)', () => {
  it('최소량 미달 시 변화 없음(손실도 없음 — 그냥 미적용)', () => {
    const r = updateStreak(state(), T0 + DAY, 0, DEFAULT_SRS_CONFIG); // 0 복습
    expect(r.event).toBe('same-day');
    expect(r.state.streakCount).toBe(3);
  });

  it('같은 날 또 연습 → 카운트 변화 없음', () => {
    const r = updateStreak(state(), T0 + 6 * 3600 * 1000, 5, DEFAULT_SRS_CONFIG);
    expect(r.event).toBe('same-day');
    expect(r.state.streakCount).toBe(3);
  });

  it('어제 연속 → +1', () => {
    const r = updateStreak(state(), T0 + DAY, 5, DEFAULT_SRS_CONFIG);
    expect(r.event).toBe('continued');
    expect(r.state.streakCount).toBe(4);
    expect(r.state.lastStreakDayMs).toBe(T0 + DAY);
  });

  it('공백 1일 → freeze 자동 소진으로 연장(freezesAvailable 감소)', () => {
    // lastStreakDay = T0, 오늘 = T0+2DAY (어제(T0+DAY) 건넘뜀).
    const r = updateStreak(state({ freezesAvailable: 2 }), T0 + 2 * DAY, 5, DEFAULT_SRS_CONFIG);
    expect(r.event).toBe('freeze-used');
    expect(r.state.streakCount).toBe(4); // 연장
    expect(r.state.freezesAvailable).toBe(1); // 1 소진
  });

  it('공백이 freeze 보다 많으면 새 출발(손실 프레임 아닌 fresh-start)', () => {
    // lastStreakDay = T0, 오늘 = T0+5DAY (4일 건넘). freeze 2로는 못 덮음.
    const r = updateStreak(state({ freezesAvailable: 2 }), T0 + 5 * DAY, 5, DEFAULT_SRS_CONFIG);
    expect(r.event).toBe('fresh-start');
    expect(r.state.streakCount).toBe(1);
    expect(r.state.freezesAvailable).toBe(DEFAULT_SRS_CONFIG.streakDefaultFreezes); // 리셋
  });

  it('freeze 0 이고 공백 1일이어도 최소량 못 채우면 끊기지 않고 미적용', () => {
    const r = updateStreak(state({ freezesAvailable: 0 }), T0 + 2 * DAY, 0, DEFAULT_SRS_CONFIG);
    expect(r.event).toBe('same-day');
    expect(r.state.streakCount).toBe(3); // 변화 없음
  });

  it('첫 연습 → streakCount 1', () => {
    const r = updateStreak(initialStreak(DEFAULT_SRS_CONFIG), T0, 1, DEFAULT_SRS_CONFIG);
    expect(r.event).toBe('fresh-start');
    expect(r.state.streakCount).toBe(1);
  });
});
