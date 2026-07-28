/**
 * 밀린 카드 폭탄 방지 — 불규칙 사용 견고성 (PLAN §4.3 / teaching-trends §1.2).
 *
 * 아동이 며칠 쓰지 않다 돌아오면 due 카드가 한꺼번에 몰린다. 이걸 전부 한 세션에
 * 쏟는 것은 좌절의 원인(8–13세 톤 위반). 그래서:
 * 1. 세션에 한 번에 꺼내는 카드 수를 maxBacklog 로 제한.
 * 2. 넘치는(overflow) 카드는 며칠에 걸쳐 due 를 재분산 — 한 번에 다시 몰리지 않게.
 *
 * 카드 순서: 안정성이 가장 낮은(기억이 가장 취약한) 것부터 — 취약 기억을 먼저 보강.
 * 이 함수는 순수 — due 갱신된 카드 배열을 반환(호출자가 persist).
 */
import type { SrsConfig } from './config.js';
import { DAY_MS } from './config.js';

/** 백로그 캡이 조작할 최소 카드 형상. */
export interface BacklogCard {
  readonly factId: string;
  readonly due: number;
  readonly stability: number;
  readonly lastReview: number;
}

export interface BacklogResult<T extends BacklogCard> {
  /** 이번 세션에 꺼낼 카드(maxBacklog 개까지). */
  readonly session: readonly T[];
  /** 넘친 카드 — due 가 재분산됨(호출자가 저장해야 다음 세션에 몰리지 않음). */
  readonly deferred: readonly (T & { due: number })[];
}

/**
 * @param dueCards 지금 due(due ≤ now) 인 카드 전체.
 * @param now 기준 시각.
 */
export function capBacklog<T extends BacklogCard>(
  dueCards: readonly T[],
  now: number,
  config: SrsConfig
): BacklogResult<T> {
  if (dueCards.length <= config.maxBacklog) {
    return { session: dueCards, deferred: [] };
  }
  // 안정성 낮은 순(취약 기억 우선) → 같으면 가장 오래된(lastReview 오래된) 순.
  const sorted = [...dueCards].sort((a, b) => {
    if (a.stability !== b.stability) return a.stability - b.stability;
    return a.lastReview - b.lastReview;
  });
  const session = sorted.slice(0, config.maxBacklog);
  const overflow = sorted.slice(config.maxBacklog);

  // overflow 를 backlogSpreadDays 일에 걸쳐 균등 분산.
  const total = overflow.length;
  const stepMs = (config.backlogSpreadDays * DAY_MS) / Math.max(1, total);
  const deferred = overflow.map((c, i) => ({
    ...c,
    due: now + Math.round((i + 1) * stepMs)
  }));

  return { session, deferred };
}
