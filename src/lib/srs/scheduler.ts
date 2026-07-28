/**
 * FSRS-inspired 스케줄러 본체 — 순수 함수. PLAN §4.1-4 / §4.3 / teaching-trends §1.2.
 *
 * 입력/출력이 저장소 타입(SrsCard)에 의존하지 않는다 — 최소 형상만 다룬다.
 * 호출자(integration)가 SrsCard ↔ 이 모듈의 값 객체를 매핑한다. 그래야 단위테스트가
 * IndexedDB 없이 돈다(PLAN §9: 스케줄러는 UI/저장소와 분리).
 *
 * 역학(config.ts 주석 참고):
 * 1. 검색 가능도 R = (1 + t/(k·S))^exp  — FSRS 멱법 망각곡선.
 * 2. 정답 시 안정성 성장(바람직한 어려움: R 낮을수록 더 자람).
 * 3. 난이도 평균 회귀 — SM-2 ease hell 방지(teaching-trends §1.2).
 * 4. lapses 시 안정성 축소(보수적 factor).
 */
import type { SrsConfig } from './config.js';
import { DAY_MS } from './config.js';
import type { Rating, ReviewOutcome } from './types.js';

/** 스케줄러가 다루는 최소 카드 형상(저장소 SrsCard 의 부분집합). */
export interface Schedulable {
  readonly stability: number;
  readonly difficulty: number;
  readonly reps: number;
  readonly lapses: number;
  readonly lastReview: number;
}

/** 첫 복습용 초기 카드 상태. 레슨 완료 시 카드를 이 값으로 만든다. */
export function initialSchedulable(config: SrsConfig, now: number): Schedulable {
  return {
    stability: config.minStability,
    difficulty: config.initialDifficulty,
    reps: 0,
    lapses: 0,
    lastReview: now
  };
}

/** 첫 due = now(레슨 직후 곧 복습 대상). 레슨 완료 시 카드 생성에 쓴다. */
export function initialDue(now: number): number {
  return now;
}

/**
 * 검색 가능도 R ∈ (0,1]. FSRS 멱법 망각곡선.
 * @param elapsedDays lastReview 이후 경과 일 수(음수 방지 → 0 처리).
 * @param stability 안정성(일 단위).
 */
export function retrievability(elapsedDays: number, stability: number, config: SrsConfig): number {
  const t = Math.max(0, elapsedDays);
  const s = Math.max(config.minStability, stability);
  const base = 1 + t / (config.retrievabilityFactor * s);
  return Math.pow(base, config.retrievabilityExp);
}

/** rating → 수치(again=1 … easy=4). 난이도 이동용. */
function ratingValue(r: Rating): number {
  switch (r) {
    case 'again':
      return 1;
    case 'hard':
      return 2;
    case 'good':
      return 3;
    case 'easy':
      return 4;
  }
}

/** config 범위로 클램프. */
function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * 난이도 갱신 — 평균 회귀(mean reversion).
 * D_next = meanRevert(D + step·(3 − ratingValue), 초기D, μ).
 * 'again'(1) 은 D 증가, 'easy'(4) 는 D 감소. μ 만큼 초기D 로 끌려돌아가 ease hell 방지.
 */
export function nextDifficulty(prev: number, rating: Rating, config: SrsConfig): number {
  const raw = prev + config.difficultyStep * (3 - ratingValue(rating));
  return clamp(
    config.difficultyMeanReversion * config.initialDifficulty +
      (1 - config.difficultyMeanReversion) * raw,
    config.minDifficulty,
    config.maxDifficulty
  );
}

/**
 * 안정성 갱신 — 복습 등급에 따라.
 * - again(lapse): stability *= lapseStabilityFactor (보수적 축소).
 * - hard/good/easy: stability *= growthByRating · (1 + w·(1−R)) · difficultyDamp.
 *   R 이 낮을수록(방금 잊힐 즈음) 성장이 크다 = 바람직한 어려움(desirable difficulty).
 *   난이도 높을수록 성장 둔화.
 */
export function nextStability(
  prev: number,
  rating: Rating,
  R: number,
  difficulty: number,
  config: SrsConfig
): number {
  if (rating === 'again') {
    return Math.max(config.minStability, prev * config.lapseStabilityFactor);
  }
  const growth = config.growthByRating[rating];
  const retrievalBoost = 1 + config.retrievalBoostWeight * (1 - R);
  // difficulty ∈ [1,10] → damp ∈ (0.11, 1]. 어려운 카드는 더 천천히 자란다.
  const damp = (config.maxDifficulty - difficulty) / (config.maxDifficulty - config.minDifficulty);
  const factor = growth * retrievalBoost * damp;
  return clamp(prev * factor, config.minStability, config.maxStability);
}

/** 간격(일)에 작은 퍼지를 준다 — 같은 날 카드 몰림 방지. 결정적(시드 기반). */
export function fuzzInterval(intervalDays: number, seed: number, config: SrsConfig): number {
  if (intervalDays <= config.minIntervalDays) return intervalDays;
  // 시드 → [-fuzz, +fuzz]. mulberry32 단순화(하위 비트).
  const r = ((seed * 2654435761) >>> 0) / 0xffffffff;
  const delta = (r * 2 - 1) * config.intervalFuzz;
  return Math.max(config.minIntervalDays, intervalDays * (1 + delta));
}

/**
 * 한 번의 복습을 처리 — (card, rating, now) → outcome. 순수 함수.
 * outcome.due 는 다음 복습 예정 시각(ms). 부작용 없음.
 */
export function review(
  card: Schedulable,
  rating: Rating,
  now: number,
  config: SrsConfig,
  fuzzSeed: number = now
): ReviewOutcome {
  const elapsedDays = Math.max(0, (now - card.lastReview) / DAY_MS);
  const R = retrievability(elapsedDays, card.stability, config);

  const newDifficulty = nextDifficulty(card.difficulty, rating, config);
  const newStability = nextStability(card.stability, rating, R, card.difficulty, config);

  const isLapse = rating === 'again';
  const newReps = isLapse ? 0 : card.reps + 1;
  const newLapses = isLapse ? card.lapses + 1 : card.lapses;

  // 간격 = 새 안정성(일). 첫 복습(reps 0→1)은 minIntervalDays 근처에서 시작.
  const baseInterval = newStability;
  const interval = fuzzInterval(Math.max(config.minIntervalDays, baseInterval), fuzzSeed, config);
  const due = now + interval * DAY_MS;

  return {
    due,
    stability: newStability,
    difficulty: newDifficulty,
    reps: newReps,
    lapses: newLapses,
    intervalDays: interval,
    retrievabilityBefore: R
  };
}

/** 카드가 "지금 복습 예정"인가(due ≤ now). UI/세션 빌더용 단순 판정. */
export function isDue(card: { due: number }, now: number): boolean {
  return card.due <= now;
}
