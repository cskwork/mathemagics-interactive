/**
 * SRS 도메인 타입 — rating, proficiency, 복습 결과.
 * 저장소 타입(SrsCard)은 storage/types.ts 에 있고, 여기는 스케줄러 순수 로직용.
 */
import type { Method, Op } from '../engine/types.js';

/**
 * 복습 등급. FSRS 의 4단(Again/Hard/Good/Easy)을 아동 앱에 맞게 그대로 쓴다.
 * 연습 화면은 정답 여부 + (게이트 통과 후) 속도 + 힌트 사용 여부로 이 rating 을 유도한다.
 * - 'again': 틀림(lapse). stability 축소.
 * - 'hard': 맞았지만 헤맴(힌트 사용 등).
 * - 'good': 보통 정답.
 * - 'easy': 빠르고 확실한 정답(게이트 통과 후에만 속도로 판정).
 */
export type Rating = 'again' | 'hard' | 'good' | 'easy';

export const RATING_ORDER: readonly Rating[] = ['again', 'hard', 'good', 'easy'];

/**
 * 기법별 숙련도(PLAN §4.1-3 정확도 게이트 + 유창성).
 * - pre-learning: 레슨 미완료(카드 없음).
 * - learning: 레슨 완료했으나 정확도 < 게이트 또는 샘플 부족.
 * - gate-passed: 정확도 ≥ 90% & 충분한 샘플 → 시간 모드(M5) 해금.
 * - fluent: 게이트 통과 + 안정성 충분히 자람(긴 간격 = 안정 기억).
 */
export type ProficiencyLevel = 'pre-learning' | 'learning' | 'gate-passed' | 'fluent';

/**
 * 카드 식별에서 기법 × 난이도 밴드 (브리프 §2-1 "카드 = 기법 × 난이도 밴드").
 * 밴드 → {digits, carry} 매핑은 difficulty.ts 의 bandToParams.
 */
export interface CardSpec {
  readonly skillId: string;
  readonly op: Op;
  readonly method: Method;
  readonly difficultyBand: number;
  readonly digits: number;
  readonly carry: boolean;
}

/** 한 번의 복습 입력(순수 함수에 먹이는 값 객체). */
export interface ReviewInput {
  readonly rating: Rating;
  readonly now: number;
}

/** 복습 결과 — UI 가 다음 due/상태를 저장하는 데 쓴다. */
export interface ReviewOutcome {
  readonly due: number;
  readonly stability: number;
  readonly difficulty: number;
  readonly reps: number;
  readonly lapses: number;
  readonly intervalDays: number;
  readonly retrievabilityBefore: number;
}
