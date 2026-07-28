import { describe, expect, it } from 'vitest';
import { DEFAULT_SRS_CONFIG } from './config.js';
import { interleave, type SessionCard } from './session.js';
import { capBacklog, type BacklogCard } from './backlog.js';

function cards(n: number, skill: string, startDue = 0): SessionCard[] {
  return Array.from({ length: n }, (_, i) => ({ factId: `${skill}#${i}`, skillId: skill, due: startDue, stability: 1, lastReview: 0 } as SessionCard & { due: number; stability: number; lastReview: number }));
}

describe('interleave (혼합 세트 — 전략 선택 훈련)', () => {
  it('빈/1개 입력은 그대로', () => {
    expect(interleave([], 1, DEFAULT_SRS_CONFIG)).toEqual([]);
    const one = cards(1, 'a');
    expect(interleave(one, 1, DEFAULT_SRS_CONFIG)).toEqual(one);
  });

  it('같은 시드면 같은 순서(결정적)', () => {
    const input = [...cards(3, 'A'), ...cards(3, 'B'), ...cards(2, 'C')];
    const a = interleave(input, 42, DEFAULT_SRS_CONFIG);
    const b = interleave(input, 42, DEFAULT_SRS_CONFIG);
    expect(a).toEqual(b);
  });

  it('모든 입력 카드가 정확히 한 번씩 등장(누락/중복 없음)', () => {
    const input = [...cards(3, 'A'), ...cards(3, 'B'), ...cards(2, 'C')];
    const out = interleave(input, 7, DEFAULT_SRS_CONFIG);
    expect(out).toHaveLength(input.length);
    expect(new Set(out.map((c) => c.factId)).size).toBe(input.length);
  });

  it('서로 다른 기법이 번갈아 나온다 — 연속 같은 skillId 최소화', () => {
    // A 4개, B 4개 — 이상적으로 ABABABAB (연속 중복 0).
    const input = [...cards(4, 'A'), ...cards(4, 'B')];
    const out = interleave(input, 3, DEFAULT_SRS_CONFIG);
    let adjacentDup = 0;
    for (let i = 1; i < out.length; i++) {
      if (out[i]!.skillId === out[i - 1]!.skillId) adjacentDup++;
    }
    expect(adjacentDup).toBe(0);
  });

  it('한 기법이 다수일 때도 연속 중복을 최소화', () => {
    // A 5, B 2 → 최소 2번 연속 A 발생 불가피하지만 최소화.
    const input = [...cards(5, 'A'), ...cards(2, 'B')];
    const out = interleave(input, 11, DEFAULT_SRS_CONFIG);
    let maxRun = 1;
    let run = 1;
    for (let i = 1; i < out.length; i++) {
      if (out[i]!.skillId === out[i - 1]!.skillId) {
        run++;
        maxRun = Math.max(maxRun, run);
      } else run = 1;
    }
    // A 5개를 B 2개로 쪼개면 최대 연속 2(AABABAA 패턴 가능). 5 미만이면 성공.
    expect(maxRun).toBeLessThan(5);
  });
});

describe('capBacklog (밀린 카드 폭탄 방지)', () => {
  function backlog(n: number): BacklogCard[] {
    return Array.from({ length: n }, (_, i) => ({
      factId: `f${i}`,
      due: 0,
      stability: 1 + (i % 5),
      lastReview: i
    }));
  }

  it('maxBacklog 이하면 전체 반환, overflow 없음', () => {
    const r = capBacklog(backlog(5), 1000, DEFAULT_SRS_CONFIG);
    expect(r.session).toHaveLength(5);
    expect(r.deferred).toHaveLength(0);
  });

  it('maxBacklog 초과 시 세션은 max 개, 나머지는 due 재분산', () => {
    const c = DEFAULT_SRS_CONFIG;
    const r = capBacklog(backlog(c.maxBacklog + 10), 1000, c);
    expect(r.session).toHaveLength(c.maxBacklog);
    expect(r.deferred).toHaveLength(10);
    // deferred 들은 now 이후로 분산됨.
    for (const d of r.deferred) {
      expect(d.due).toBeGreaterThan(1000);
    }
  });

  it('세션은 안정성 낮은(취약 기억) 카드 우선', () => {
    const c = DEFAULT_SRS_CONFIG;
    const input: BacklogCard[] = [
      { factId: 'strong', due: 0, stability: 50, lastReview: 0 },
      { factId: 'weak', due: 0, stability: 0.5, lastReview: 0 },
      { factId: 'mid', due: 0, stability: 5, lastReview: 0 }
    ];
    const r = capBacklog(input, 1000, { ...c, maxBacklog: 1 });
    expect(r.session[0]!.factId).toBe('weak'); // 가장 취약한 것 먼저
  });

  it('overflow due 가 며칠에 걸쳐 균등 분산(증가 순서)', () => {
    const c = { ...DEFAULT_SRS_CONFIG, maxBacklog: 2, backlogSpreadDays: 3 };
    const r = capBacklog(backlog(6), 1000, c); // 2 session, 4 deferred
    const dues = r.deferred.map((d) => d.due);
    for (let i = 1; i < dues.length; i++) {
      expect(dues[i]!).toBeGreaterThan(dues[i - 1]!);
    }
  });
});
