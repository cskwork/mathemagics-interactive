/**
 * FSRS 영감 간격 반복 스케줄러 — **모든 파라미터 외부화** (PLAN §4.3).
 *
 * 아동 + 수학 사실(math facts) 대상 FSRS 직접 검증 연구는 존재하지 않는다
 * (teaching-trends §1.2 "미검증 영역"). 그래서 모든 상수를 이 파일 한 곳에 두고
 * 보수적 기본값 + 조정 가능하게 만든다(PLAN §10-3 리스크 대응).
 *
 * 채택 모델: FSRS-4.5 의 핵심 역학(검색 가능도 retrievability, 안정성 stability,
 * 난이도 difficulty, 망각 시 lapses)을 간결하게 재구현한 "FSRS-inspired" 스케줄러.
 * ts-fsrs 미채택 사유는 docs/briefs/M3-RESULT.md §2.1 에 기록.
 *
 * 모든 함수는 순수函数로, UI/저장소와 분리된다(PLAN §9). 시간 단위: ms(epoch) 입력,
 * 내부 계산은 일(day) 단위.
 */

export const DAY_MS = 86_400_000;

/**
 * 스케줄러 전체 파라미터. 아동 증거가 약해 **보수적**으로 잡았다(PLAN §4.3).
 * 각 필드의 근거를 주석으로 단다. 값만 바꾸면 전체 스케줄이 조정된다.
 */
export interface SrsConfig {
  /** retrievability 망각곡선의 시간 정규화 계수 (FSRS=9). 클수록 느리게 잊음. */
  readonly retrievabilityFactor: number;
  /** 망각곡선 지수 (FSRS DECAY=-0.5). R=(1+t/(k*S))^exp. */
  readonly retrievabilityExp: number;

  /** 최소 안정성(일). lapses 후에도 0이 되지 않게(완전 초기화 회피). */
  readonly minStability: number;
  /** 최대 안정성(일) — 사실상 영구 기억 상한(~6개월). */
  readonly maxStability: number;
  /** lapses 시 안정성 축소 비율(0~1). 낮을수록 가혹(PLAN §4.3 보수). 0.4=60% 망각. */
  readonly lapseStabilityFactor: number;

  /**
   * 정답 시 안정성 성장 기본 배수(log-scale 기여).
   * rating 별로 harder → easier: hard<good<easy. FSRS 의 w15/w16/w17 에 대응.
   */
  readonly growthByRating: Readonly<Record<'hard' | 'good' | 'easy', number>>;
  /** 검색 가능도가 낮을 때(방금 잊힐 때) 복습이 더 강화되는 정도(바람직한 어려움). */
  readonly retrievalBoostWeight: number;

  /** 초기 난이도(1~10). 중간~살짝 어려움에서 시작. */
  readonly initialDifficulty: number;
  /** 난이도 최소/최대 범위. */
  readonly minDifficulty: number;
  readonly maxDifficulty: number;
  /** 한 복습당 난이도 이동량(rating 1단계당). */
  readonly difficultyStep: number;
  /** 난이도 평균 회귀 비율(0~1). SM-2 "ease hell" 방지(teaching-trends §1.2). */
  readonly difficultyMeanReversion: number;

  /** 간격 퍼지(±비율) — 같은 날 카드가 몰리는 것 방지. */
  readonly intervalFuzz: number;
  /** 최소 간격(일). 첫 복습이 너무 빨리 오지 않게. */
  readonly minIntervalDays: number;

  /** 정확도 게이트 통과 역치(PLAN §4.1-3, McNeil 2025 — 90%). */
  readonly gateAccuracy: number;
  /** 게이트 판정에 필요한 최소 복습 수(샘플 부족 시 통과 불가). */
  readonly gateMinReviews: number;
  /** 유창성(fluent) 판정 — 안정성(일)이 이 값 이상이면 "안정된 기억". */
  readonly fluentStabilityDays: number;

  /** 밀린 카드 폭탄 방지 — 한 세션에 한번에 꺼내는 최대 카드 수(PLAN §4.3 불규칙 사용 견고성). */
  readonly maxBacklog: number;
  /** 밀린 카드(overflow)를 며칠에 걸쳐 분산시킬지. */
  readonly backlogSpreadDays: number;

  /** 적응 난이도 ZPD 밴드(PLAN §4.2-7). 이 범위 밖이면 한 눈금 조정. */
  readonly zpdLow: number;
  readonly zpdHigh: number;
  /** 적응 난이도 최대 밴드 인덱스(기법별). */
  readonly maxDifficultyBand: number;

  /** 관대한 스트릭 — 하루 최소 복습 수(PLAN §4.2-11, 낮게). */
  readonly streakMinDailyReviews: number;
  /** 기본 제공 freeze 수(무료, 자동 적용, 손실 압박 없음). */
  readonly streakDefaultFreezes: number;
}

/**
 * 보수적 기본값. FSRS 성인 벤치마크값보다 간격이 짧고 성장이 느리다 —
 * 아동 증거 부족(PLAN §4.3)을 "더 자주 복습"으로 대응.
 */
export const DEFAULT_SRS_CONFIG: SrsConfig = {
  retrievabilityFactor: 9,
  retrievabilityExp: -0.5,
  minStability: 0.2,
  maxStability: 180,
  lapseStabilityFactor: 0.4,
  growthByRating: { hard: 1.2, good: 2.5, easy: 4.0 },
  retrievalBoostWeight: 0.4,
  initialDifficulty: 5.5,
  minDifficulty: 1,
  maxDifficulty: 10,
  difficultyStep: 0.8,
  difficultyMeanReversion: 0.15,
  intervalFuzz: 0.08,
  minIntervalDays: 0.04, // ~1시간 — 첫 복습은 같은 날에도 올 수 있게(학습 밀집)
  gateAccuracy: 0.9,
  gateMinReviews: 5,
  fluentStabilityDays: 21,
  maxBacklog: 12,
  backlogSpreadDays: 3,
  zpdLow: 0.8,
  zpdHigh: 0.9,
  maxDifficultyBand: 4,
  streakMinDailyReviews: 1,
  streakDefaultFreezes: 2
};

/** 날짜(자정 기준) — 스트릭·간격 "일 수" 계산용. 로컬 타임존. */
export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** 두 timestamp 사이의 자정 기준 일 수 (양수/음수/0). */
export function daysBetween(aMs: number, bMs: number): number {
  return Math.round((startOfDay(bMs) - startOfDay(aMs)) / DAY_MS);
}
