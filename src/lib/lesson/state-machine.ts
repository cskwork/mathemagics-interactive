/**
 * 레슨 5단계 상태머신 — 순수 리듀서. PLAN §3.3 / docs/briefs/M2.md 산출물 2.
 *
 * 상태 전이를 컴포넌트에서 분리해 단위테스트한다(브리프 §2-2 요구). 플레이어는 이 리듀서에
 * 이벤트를 먹일 뿐이다. 힌트 사다리 논리(에스컬레이션)·남용 감지·잠금/선행 판정도 여기에 둔다.
 *
 * 5단계: ① hook → ② example → ③ fading → ④ practice → ⑤ done.
 * 이벤트는 판별 합합(discriminated union) — `t` 로 좁힌다.
 */
import type { HintTier, StrategyChoice } from './types.js';

/** 레슨 단계. storage ProgressRecord.lessonStepReached 에 문자열로 저장된다. */
export type LessonPhase = 'hook' | 'example' | 'fading' | 'practice' | 'done';

/** 상태머신이 단계 전환을 위해 알아야 할 각 단계의 문제 수. */
export interface LessonCounts {
  readonly hook: number;
  readonly example: number;
  readonly fading: number;
  readonly practice: number;
}

/** 플레이어의 전체 레슨 상태. */
export interface LessonState {
  readonly phase: LessonPhase;
  /** 현재 단계 안의 문제 인덱스(0-base). */
  readonly index: number;
  /** 연습 단계 누적 시도(정답·오답·힌트-풀이 포함). */
  readonly attempts: number;
  /** 연습 단계 독립 정답 수(bottom-out 제외). */
  readonly correct: number;
  /** 연습 단계 누적 힌트 사용 로그. */
  readonly hintsUsed: readonly HintTier[];
  /** 연습 단계 bottom-out 사용 횟수. */
  readonly bottomOuts: number;
  /** 연속 bottom-out 사용 횟수(정답 시 0 리셋). 남용 감지용. */
  readonly consecutiveBottomOut: number;
  /** 남용 감지 시 true → 플레이어가 예제 복귀 권유를 띄운다. */
  readonly suggestReview: boolean;
  readonly strategyCounts: Readonly<Record<StrategyChoice, number>>;
  readonly startedAt: number;
}

export function createLessonState(now: number): LessonState {
  return {
    phase: 'hook',
    index: 0,
    attempts: 0,
    correct: 0,
    hintsUsed: [],
    bottomOuts: 0,
    consecutiveBottomOut: 0,
    suggestReview: false,
    strategyCounts: { 'this-technique': 0, 'other-technique': 0, 'just-knew': 0 },
    startedAt: now
  };
}

/** 연속 bottom-out 횟수가 이 값 이상이면 예제 복귀를 부드럽게 권유(PLAN §4.1-6, 리서치 §3.2). */
export const BOTTOM_OUT_ABUSE_THRESHOLD = 2;

/** 레슨 이벤트 — 판별 합합. */
export type LessonEvent =
  | { readonly t: 'skip-hook' }
  | { readonly t: 'next' }
  | { readonly t: 'solved-correct' }
  | { readonly t: 'bottom-out' }
  | { readonly t: 'hint'; readonly tier: HintTier }
  | { readonly t: 'strategy'; readonly choice: StrategyChoice }
  | { readonly t: 'review-accepted' }
  | { readonly t: 'review-dismissed' };

/** 현재 단계의 남은 문제 수(지나치면 다음 단계). */
function phaseCount(phase: LessonPhase, counts: LessonCounts): number {
  switch (phase) {
    case 'hook':
      return counts.hook;
    case 'example':
      return counts.example;
    case 'fading':
      return counts.fading;
    case 'practice':
      return counts.practice;
    case 'done':
      return 0;
  }
}

/**
 * 순수 리듀서 — (state, event, counts) → state. 부작용 없음.
 * practice 단계의 'next' 는 문제 풀이 이벤트(solved-correct/bottom-out)가 전환을 담당하므로
 * 'next' 가 practice 에서 무시함(의도적 — 플레이어가 풀어야 넘어감).
 */
export function reduce(state: LessonState, event: LessonEvent, counts: LessonCounts): LessonState {
  switch (event.t) {
    case 'skip-hook':
      if (state.phase !== 'hook') return state;
      return { ...state, phase: 'example', index: 0 };

    case 'next': {
      if (state.phase === 'done' || state.phase === 'practice') return state;
      const total = phaseCount(state.phase, counts);
      if (state.index + 1 < total) {
        return { ...state, index: state.index + 1 };
      }
      // 단계 종료 → 다음 단계로.
      const nextPhase: LessonPhase =
        state.phase === 'hook' ? 'example'
        : state.phase === 'example' ? 'fading'
        : state.phase === 'fading' ? 'practice'
        : 'done';
      return { ...state, phase: nextPhase, index: 0 };
    }

    case 'hint': {
      if (state.phase !== 'practice') return state;
      return { ...state, hintsUsed: [...state.hintsUsed, event.tier] };
    }

    case 'strategy': {
      const next: Record<StrategyChoice, number> = {
        ...state.strategyCounts,
        [event.choice]: state.strategyCounts[event.choice] + 1
      };
      return { ...state, strategyCounts: next };
    }

    case 'solved-correct': {
      if (state.phase !== 'practice') return state;
      const total = counts.practice;
      const advanced: LessonState = {
        ...state,
        attempts: state.attempts + 1,
        correct: state.correct + 1,
        consecutiveBottomOut: 0
      };
      if (advanced.index + 1 < total) return { ...advanced, index: advanced.index + 1 };
      return { ...advanced, phase: 'done', index: 0 };
    }

    case 'bottom-out': {
      if (state.phase !== 'practice') return state;
      const total = counts.practice;
      const consec = state.consecutiveBottomOut + 1;
      const advanced: LessonState = {
        ...state,
        attempts: state.attempts + 1,
        bottomOuts: state.bottomOuts + 1,
        consecutiveBottomOut: consec,
        hintsUsed: [...state.hintsUsed, 'bottom-out'],
        suggestReview: consec >= BOTTOM_OUT_ABUSE_THRESHOLD
      };
      if (advanced.index + 1 < total) return { ...advanced, index: advanced.index + 1 };
      return { ...advanced, phase: 'done', index: 0 };
    }

    case 'review-accepted':
      // 예제 단계로 부드럽게 복귀 — 남용 카운터 리셋.
      return {
        ...state,
        phase: 'example',
        index: 0,
        suggestReview: false,
        consecutiveBottomOut: 0
      };

    case 'review-dismissed':
      return { ...state, suggestReview: false };
  }
}

// ── 힌트 사다리 에스컬레이션(문제별) ──────────────────────────────────────────

const HINT_ORDER: readonly HintTier[] = ['point', 'teach', 'bottom-out'];

/**
 * 한 문제에서 이미 쓴 힌트 티어들을 받아 다음 티어를 돌려준다.
 * Point → Teach → Bottom-out 순. bottom-out 까지 썼으면 null(더 없음).
 * (PLAN §4.1-6 / 리서치 §4.2.)
 */
export function nextHintTier(usedThisProblem: readonly HintTier[]): HintTier | null {
  for (const tier of HINT_ORDER) {
    if (!usedThisProblem.includes(tier)) return tier;
  }
  return null;
}

// ── 잠금 / 선행 / 완료 판정 ──────────────────────────────────────────────────

/** 레슨이 열려 있는가 — 모든 선행 skillId 가 완료된 집합에 속해야. */
export function isLessonUnlocked(
  prerequisites: readonly string[],
  completedSkillIds: ReadonlySet<string>
): boolean {
  return prerequisites.every((p) => completedSkillIds.has(p));
}

// ── 정확도 / 별 산정 ─────────────────────────────────────────────────────────

/** 연습 정확도 = correct / attempts (시도 0이면 0). */
export function practiceAccuracy(state: LessonState): number {
  if (state.attempts === 0) return 0;
  return state.correct / state.attempts;
}

/**
 * 완료 시 별 산정(0~3). PLAN §4.1-3 정확도 우선.
 * - 3★: 정확도 100% & bottom-out 0회
 * - 2★: 정확도 ≥ 통과기준 & bottom-out 0회
 * - 1★: 완료함
 * - 0★: 미완료
 */
export function starsFor(state: LessonState, passAccuracy: number): 0 | 1 | 2 | 3 {
  if (state.phase !== 'done') return 0;
  const acc = practiceAccuracy(state);
  if (acc >= 1 && state.bottomOuts === 0) return 3;
  if (acc >= passAccuracy && state.bottomOuts === 0) return 2;
  return 1;
}
