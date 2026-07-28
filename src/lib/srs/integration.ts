/**
 * SRS 통합 계층 — 순수 스케줄러(src/lib/srs/*) 와 저장소 타입(SrsCard) 사이의 다리.
 *
 * LessonPlayer(레슨 완료 시 카드 생성) 와 Practice 라우트(복습 세션) 가 이 모듈을 통해
 * 스케줄러를 호출한다. 카드의 optional M3 필드를 채우고, 게이트·숙련도·백로그·혼합 세트를
 * SrsCard 단위로 엮는다. 저장소 I/O 는 여기 없다 — 순수 데이터 변환만.
 */
import { adjustBand, bandToParams, paramsToBand } from './difficulty.js';
import { decideProficiency } from './gate.js';
import type { TechniqueStats } from './gate.js';
import { capBacklog } from './backlog.js';
import { interleave } from './session.js';
import { review as reviewPure, initialDue, initialSchedulable } from './scheduler.js';
import type { SrsConfig } from './config.js';
import type { Rating } from './types.js';
import type { ProgressRecord, SrsCard } from '../storage/types.js';
import type { Method, Op } from '../engine/types.js';

/** factId = `${skillId}#${band}` (Dexie 복합키 [profileId+factId] 와 정합). */
export function makeFactId(skillId: string, band: number): string {
  return `${skillId}#${band}`;
}

export function factIdParts(factId: string): { skillId: string; band: number } | undefined {
  const idx = factId.lastIndexOf('#');
  if (idx < 0) return undefined;
  const band = Number(factId.slice(idx + 1));
  if (!Number.isInteger(band)) return undefined;
  return { skillId: factId.slice(0, idx), band };
}

/**
 * 레슨 완료 시 초기 카드 생성. 밴드는 레슨 practice 세트 파라미터에서 유도.
 * due = now(곧 복습 대상). stability/difficulty 는 보수적 초기값.
 */
export function createCardFromLesson(args: {
  profileId: string;
  skillId: string;
  op: Op;
  method: Method;
  practiceDigits: number;
  practiceCarry: boolean;
  now: number;
  config: SrsConfig;
}): SrsCard {
  const { profileId, skillId, op, method, practiceDigits, practiceCarry, now, config } = args;
  const band = Math.min(
    config.maxDifficultyBand,
    paramsToBand({ digits: practiceDigits, carry: practiceCarry })
  );
  const params = bandToParams(band, config);
  const sched = initialSchedulable(config, now);
  return {
    profileId,
    skillId,
    factId: makeFactId(skillId, band),
    difficultyBand: band,
    digits: params.digits,
    carry: params.carry,
    op,
    method,
    due: initialDue(now),
    stability: sched.stability,
    difficulty: sched.difficulty,
    reps: sched.reps,
    lapses: sched.lapses,
    lastReview: sched.lastReview,
    correct: 0,
    total: 0
  };
}

function hashFact(factId: string): number {
  let h = 0;
  for (let i = 0; i < factId.length; i++) h = (Math.imul(31, h) + factId.charCodeAt(i)) | 0;
  return h;
}

/**
 * 카드 1장 복습 처리 → 갱신된 SrsCard(새 due/stability/...). 정답 카운트도 갱신.
 * 부작용 없음 — 호출자가 upsertCard.
 */
export function reviewCard(card: SrsCard, rating: Rating, now: number, config: SrsConfig): SrsCard {
  const sched = {
    stability: card.stability,
    difficulty: card.difficulty,
    reps: card.reps,
    lapses: card.lapses,
    lastReview: card.lastReview
  };
  const outcome = reviewPure(sched, rating, now, config, Math.floor(now ^ hashFact(card.factId)));
  const isCorrect = rating !== 'again';
  return {
    ...card,
    due: outcome.due,
    stability: outcome.stability,
    difficulty: outcome.difficulty,
    reps: outcome.reps,
    lapses: outcome.lapses,
    lastReview: now,
    correct: (card.correct ?? 0) + (isCorrect ? 1 : 0),
    total: (card.total ?? 0) + 1
  };
}

/**
 * 세션 종료 시 한 기법의 카드 밴드를 적응 조정. 최근 정확도 → 새 밴드 → digits/carry 갱신.
 * 밴드가 바뀌면 factId(밴드 인코딩) 도 바뀐다 — 호출자는 구 factId 카드를 지우고 새 카드를 upsert.
 */
export function rebandCard(
  card: SrsCard,
  recentAccuracy: number,
  config: SrsConfig
): { card: SrsCard; bandChanged: boolean } {
  const oldBand = card.difficultyBand ?? 0;
  const newBand = adjustBand(recentAccuracy, oldBand, config);
  if (newBand === oldBand) return { card, bandChanged: false };
  const params = bandToParams(newBand, config);
  const skillId = card.skillId ?? factIdParts(card.factId)?.skillId ?? '';
  return {
    card: {
      ...card,
      difficultyBand: newBand,
      digits: params.digits,
      carry: params.carry,
      factId: makeFactId(skillId, newBand)
    },
    bandChanged: true
  };
}

/**
 * due 카드 전체 → 백로그 캡 + interleave 적용한 세션 순서. 순수 함수.
 * 반환: { session: 세션에 보여줄 순서, deferred: due 재분산된 overflow(저장 필요) }
 */
export function buildSession(
  dueCards: readonly SrsCard[],
  now: number,
  config: SrsConfig,
  seed: number
): { session: readonly SrsCard[]; deferred: readonly SrsCard[] } {
  const capped = capBacklog(
    dueCards.map((c) => ({
      factId: c.factId,
      due: c.due,
      stability: c.stability,
      lastReview: c.lastReview
    })),
    now,
    config
  );
  const sessionFactIds = new Set(capped.session.map((c) => c.factId));
  const sessionCards = dueCards.filter((c) => sessionFactIds.has(c.factId));
  const ordered = interleave(
    sessionCards.map((c) => ({ factId: c.factId, skillId: c.skillId ?? '', raw: c })),
    seed,
    config
  ).map((w) => w.raw);

  const deferredMap = new Map(capped.deferred.map((c) => [c.factId, c.due]));
  const deferred = dueCards
    .filter((c) => deferredMap.has(c.factId))
    .map((c) => ({ ...c, due: deferredMap.get(c.factId) ?? c.due }));

  return { session: ordered, deferred };
}

/**
 * 한 기법의 숙련도 산출용 통계 집계. 게이트(gate.ts) 에 먹인다.
 * 카드가 없으면 0/maxStability 0. 레슨 진도(attempts/correct) 와 복습 누적을 합산.
 */
export function techniqueStats(
  skillId: string,
  cards: readonly SrsCard[],
  progress: ProgressRecord | undefined
): TechniqueStats {
  const techCards = cards.filter((c) => (c.skillId ?? '') === skillId);
  const lessonCorrect = progress?.correct ?? 0;
  const lessonTotal = progress?.attempts ?? 0;
  const practiceCorrect = progress?.practiceCorrect ?? 0;
  const practiceTotal = progress?.practiceAttempts ?? 0;

  let cardCorrect = 0;
  let cardTotal = 0;
  let maxStability = 0;
  for (const c of techCards) {
    cardCorrect += c.correct ?? 0;
    cardTotal += c.total ?? 0;
    if (c.stability > maxStability) maxStability = c.stability;
  }

  return {
    skillId,
    lessonCompleted: progress?.completedAt !== undefined,
    correct: lessonCorrect + practiceCorrect + cardCorrect,
    total: lessonTotal + practiceTotal + cardTotal,
    maxStability,
    gatePassedAt: progress?.gatePassedAt
  };
}

/** 숙련도 레벨 한 방에 산출(진도 화면·보고서용 편의). */
export function proficiencyOf(
  skillId: string,
  cards: readonly SrsCard[],
  progress: ProgressRecord | undefined,
  config: SrsConfig
) {
  return decideProficiency(techniqueStats(skillId, cards, progress), config);
}
