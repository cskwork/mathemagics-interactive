/**
 * 정확도 게이트 — 기법별 90% 도달 전 시간 요소 노출 금지. PLAN §4.1-3 / teaching-trends §1.1.
 *
 * McNeil et al. 2025 산술 유창성 합의 리뷰의 핵심 권고: "정확도 확보 후에만 시간제한 도입".
 * 게이트 통과 시 유창성 훈련(M5 공연 모드 전제) 해금.
 *
 * 숙련도 4단계:
 *   pre-learning → learning → gate-passed → fluent
 * 게이트는 단조적(monotonic) — 한 번 통과하면 gatePassedAt 으로 고정(최근 부진으로
 * 재잠금 없음 — 아동 친화, 손실 압박 금지 PLAN §4.2-11).
 */
import type { SrsConfig } from './config.js';
import type { ProficiencyLevel } from './types.js';

/** 게이트 판정에 들어가는 한 기법의 집계 통계. */
export interface TechniqueStats {
  readonly skillId: string;
  /** 레슨 완료 여부(completedAt 존재). */
  readonly lessonCompleted: boolean;
  /** 누적 정답 수(연습 + 복습). */
  readonly correct: number;
  /** 누적 시도 수. */
  readonly total: number;
  /** 기법 카드 중 최대 안정성(일). fluent 판정용. */
  readonly maxStability: number;
  /** 게이트 통과 시각(ProgressRecord.gatePassedAt). 단조 잠금. */
  readonly gatePassedAt: number | undefined;
}

export interface GateDecision {
  readonly level: ProficiencyLevel;
  /** 게이트를 이번에 새로 통과했는가(→ 호출자가 gatePassedAt 저장). */
  readonly newlyPassed: boolean;
  readonly accuracy: number;
}

/**
 * 숙련도 + 게이트 판정. 순수 함수.
 *
 * - pre-learning: 레슨 미완료.
 * - learning: 완료했으나 (샘플 부족 OR 정확도 < 게이트) 그리고 gatePassedAt 없음.
 * - gate-passed: 게이트 조건 충족 OR 이미 gatePassedAt 있음(fluent 아닐 때).
 * - fluent: gate 통과 + maxStability ≥ fluentStabilityDays(긴 간격 = 안정 기억).
 */
export function decideProficiency(stats: TechniqueStats, config: SrsConfig): GateDecision {
  if (!stats.lessonCompleted) {
    return { level: 'pre-learning', newlyPassed: false, accuracy: accuracyOf(stats) };
  }
  const acc = accuracyOf(stats);
  const enough = stats.total >= config.gateMinReviews;
  const meetsGate = enough && acc >= config.gateAccuracy;

  const alreadyPassed = stats.gatePassedAt !== undefined;
  const newlyPassed = !alreadyPassed && meetsGate;
  const passed = alreadyPassed || meetsGate;

  if (passed && stats.maxStability >= config.fluentStabilityDays) {
    return { level: 'fluent', newlyPassed, accuracy: acc };
  }
  if (passed) {
    return { level: 'gate-passed', newlyPassed, accuracy: acc };
  }
  return { level: 'learning', newlyPassed: false, accuracy: acc };
}

/** 정확도 = correct/total (시도 0이면 0). */
export function accuracyOf(stats: { correct: number; total: number }): number {
  if (stats.total <= 0) return 0;
  return stats.correct / stats.total;
}

/** 시간 요소(속도 모드) 노출 가능 여부 — 게이트 통과한 기법만. */
export function timeModeUnlocked(stats: TechniqueStats, config: SrsConfig): boolean {
  const { level } = decideProficiency(stats, config);
  return level === 'gate-passed' || level === 'fluent';
}
