/**
 * 보호자 리포트 생성 — 순수 함수. PLAN §2(보호자 페르소나) / §4.5 / teaching-trends §4.5.
 *
 * 대시보드는 비교·감시 도구가 되면 역효과. 자녀 비교·순위 대신 "이번 주 배운 전략 +
 * 집에서 해볼 대화 한 가지" 같은 행동 지향 정보를 제공한다(teaching-trends §4.5).
 *
 * 대화 소재 생성: 가장 최근 배운 기법으로 샘플 문제를 만들고, "아이에게 {문제}를 어떻게
 * 풀었는지 물어보세요" 형태의 Localized 문장을 만든다. 텍스트는 {ko, en} 객체(PLAN §6.2).
 */
import { generateProblem } from '../engine/generate.js';
import type { LocalizedText } from '../content/localized.js';
import type { Method, Op } from '../engine/types.js';
import { DAY_MS, startOfDay } from './config.js';

/** 보호자 리포트 입력(진도 기록 요약). */
export interface LearnedTechnique {
  readonly skillId: string;
  readonly title: LocalizedText;
  readonly rule: LocalizedText;
  readonly completedAt: number;
  readonly op: Op;
  readonly method: Method;
  /** 어림셈인 경우 어림 대상 연산. */
  readonly estOf?: 'add' | 'sub' | 'mul' | 'div';
  /** 대화 소재용 샘플 문제 생성 파라미터. */
  readonly sampleDigits: number;
  readonly sampleCarry: boolean;
}

export interface WeeklyReport {
  /** 이번 주(최근 7일) 배운 기법 목록(최신순). */
  readonly learnedThisWeek: readonly LearnedTechnique[];
  /** 대화 소재 1개. 배운 게 없으면 undefined. */
  readonly conversationStarter: ConversationStarter | undefined;
}

export interface ConversationStarter {
  /** 이 소재가 가리키는 기법. */
  readonly skillId: string;
  /** 샘플 문제(결정적 — 주 단위로 안정). */
  readonly operands: readonly [number, number];
  readonly op: Op;
  /** 아이에게 건넬 대화 문구(ko/en). */
  readonly prompt: LocalizedText;
}

/** "이번 주" = 최근 7일(completedAt 기준). */
export function isThisWeek(completedAt: number, now: number): boolean {
  return startOfDay(completedAt) >= startOfDay(now) - 7 * DAY_MS + 1;
}

/** 주(week) 식별용 정수 — 대화 소재 시드 안정화. */
function weekSeed(now: number): number {
  return Math.floor(startOfDay(now) / DAY_MS / 7);
}

/** 숫자 → 로케일 표현(ko/en). 큰 수는 천 단위 구분(일반적 가독성). */
function num(n: number): string {
  return String(n);
}

/**
 * 보호자 리포트 생성. 순수 함수.
 * @param all 모든 완료된 기법(completedAt 있는 것).
 * @param now 기준 시각.
 */
export function buildWeeklyReport(all: readonly LearnedTechnique[], now: number): WeeklyReport {
  const recent = all
    .filter((t) => isThisWeek(t.completedAt, now))
    .sort((a, b) => b.completedAt - a.completedAt);

  if (recent.length === 0) {
    return { learnedThisWeek: [], conversationStarter: undefined };
  }

  // 가장 최근 기법으로 대화 소재 1개.
  // 여러 개면 최신순 순회하며 샘플 생성 가능한 첫 기법 사용.
  for (const tech of recent) {
    const cs = tryMakeStarter(tech, now);
    if (cs) {
      return { learnedThisWeek: recent, conversationStarter: cs };
    }
  }
  return { learnedThisWeek: recent, conversationStarter: undefined };
}

function tryMakeStarter(tech: LearnedTechnique, now: number): ConversationStarter | undefined {
  // 주 단위 안정 시드 + 기법별 추가 엔트로피.
  const seed = (weekSeed(now) ^ hashStr(tech.skillId)) >>> 0;
  let problem;
  try {
    problem = generateProblem(seed >>> 0, {
      op: tech.op,
      digits: tech.sampleDigits,
      carry: tech.sampleCarry,
      method: tech.method
    });
  } catch {
    return undefined;
  }
  const [a, b] = problem.operands;
  const realOp = tech.op === 'est' ? tech.estOf ?? 'add' : tech.op;
  const sign = realOp === 'add' ? '+' : realOp === 'sub' ? '−' : realOp === 'mul' ? '×' : '÷';
  const expr = `${num(a)} ${sign} ${num(b)}`;

  // 대화 문구 — "아이에게 {문제}를 어떻게 풀었는지 물어보세요" (ko/en).
  const rule = tech.rule;
  const prompt: LocalizedText = {
    ko: `“${expr}”를 어떻게 구했는지 ${tech.title.ko}로 물어보세요. ${rule.ko}`,
    en:
      tech.title.en && rule.en
        ? `Ask how they worked out “${expr}” using ${tech.title.en}. ${rule.en}`
        : `Ask how they worked out “${expr}”. ${rule.ko}`
  };
  return { skillId: tech.skillId, operands: [a, b], op: tech.op, prompt };
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}
