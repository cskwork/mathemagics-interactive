import { describe, expect, it } from 'vitest';
import { DAY_MS } from './config.js';
import { buildWeeklyReport, isThisWeek, type LearnedTechnique } from './report.js';

const NOW = Date.UTC(2026, 6, 29); // 2026-07-29

function tech(over: Partial<LearnedTechnique> = {}): LearnedTechnique {
  return {
    skillId: 'ltr-addition',
    title: { ko: '큰 자리부터 더하기', en: 'Add from the biggest place' },
    rule: { ko: '큰 덩어리부터 더합니다.', en: 'Add the biggest chunk first.' },
    completedAt: NOW - DAY_MS,
    op: 'add',
    method: 'ltr',
    sampleDigits: 2,
    sampleCarry: true,
    ...over
  };
}

describe('isThisWeek', () => {
  it('최근 7일 이내면 true', () => {
    expect(isThisWeek(NOW - DAY_MS, NOW)).toBe(true);
    expect(isThisWeek(NOW - 6 * DAY_MS, NOW)).toBe(true);
    expect(isThisWeek(NOW, NOW)).toBe(true);
  });
  it('8일 이상이면 false', () => {
    expect(isThisWeek(NOW - 8 * DAY_MS, NOW)).toBe(false);
    expect(isThisWeek(NOW - 30 * DAY_MS, NOW)).toBe(false);
  });
});

describe('buildWeeklyReport', () => {
  it('이번 주 배운 게 없으면 빈 리포트 + starter 없음', () => {
    const r = buildWeeklyReport([tech({ completedAt: NOW - 30 * DAY_MS })], NOW);
    expect(r.learnedThisWeek).toHaveLength(0);
    expect(r.conversationStarter).toBeUndefined();
  });

  it('이번 주 배운 기법이 최신순으로 정렬', () => {
    const list = [
      tech({ skillId: 'a', completedAt: NOW - 5 * DAY_MS }),
      tech({ skillId: 'b', completedAt: NOW - DAY_MS })
    ];
    const r = buildWeeklyReport(list, NOW);
    expect(r.learnedThisWeek.map((t) => t.skillId)).toEqual(['b', 'a']);
  });

  it('대화 소재 1개 생성 — 문제 + ko/en 문구', () => {
    const r = buildWeeklyReport([tech()], NOW);
    expect(r.conversationStarter).toBeDefined();
    const cs = r.conversationStarter!;
    expect(cs.skillId).toBe('ltr-addition');
    expect(cs.operands).toHaveLength(2);
    expect(cs.operands[0]).toBeGreaterThan(0);
    expect(cs.prompt.ko).toContain('+');
    expect(cs.prompt.ko).toContain('물어보세요');
    expect(cs.prompt.en).toContain('Ask');
  });

  it('같은 주면 대화 소재의 샘플 문제가 안정(같은 시드)', () => {
    const list = [tech()];
    const a = buildWeeklyReport(list, NOW).conversationStarter;
    const b = buildWeeklyReport(list, NOW + DAY_MS).conversationStarter; // 같은 주
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(a!.operands).toEqual(b!.operands);
  });

  it('보수 문구 — 빼기 기법은 − 기호', () => {
    const r = buildWeeklyReport([tech({ skillId: 'ltr-sub', op: 'sub' })], NOW);
    const cs = r.conversationStarter!;
    expect(cs.op).toBe('sub');
    expect(cs.prompt.ko).toContain('−');
  });
});
