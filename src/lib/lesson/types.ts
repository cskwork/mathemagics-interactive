/**
 * 레슨 콘텐츠 스키마 + 런타임 타입 — PLAN §3.3(5단계 템플릿) · §3.4(콘텐츠 파이프라인) ·
 * docs/briefs/M2.md 산출물 1.
 *
 * 두 단계 포맷:
 * - {@link LessonFile}: 디스크 포맷(`content/lessons/*.json`). 문제는 M1 생성기
 *   파라미터({@link ProblemSet})로 정의 — 하드코딩된 피연산자가 아니라 시드 기반 생성.
 *   텍스트 필드는 전부 {@link LocalizedText}({ko, en}, ko 폴백).
 * - {@link Lesson}: 로더가 {@link ProblemSet}을 구체적 {@link Problem}[] 로 전개한 런타임 객체.
 *
 * 원문 문장 복제 금지(PLAN §10-1 저작권 방침) — title/rule/hint/intro 문장은 전부 자체 저작.
 * 엔진 파생 narration(derive.ts)도 책 문장이 아닌 규칙 기반 자동 생성문.
 */
import type { LocalizedText } from '../content/localized.js';
import type { Method, Op, Problem } from '../engine/types.js';

/**
 * 문제 생성 파라미터 — M1 generate.ts 의 GenerateOptions 와 1:1(시드 추가).
 * 레슨은 이 파라미터로 문제를 정의하고, 로더가 {@link buildLesson}에서 구체적 문제로 펼친다.
 * (브리프 §2-5 "문제는 M1 생성기 파라미터로 정의, 하드코딩 최소화".)
 */
export interface ProblemSet {
  readonly op: Op;
  readonly method: Method;
  /** 피연산자 자릿수(양쪽 같음). 2~4 권장. */
  readonly digits: number;
  /** true 면 올림/빌림이 발생하는 문제. */
  readonly carry: boolean;
  /** 생성할 문제 수. */
  readonly count: number;
  /** 결정적 시드 — 동일 시드→동일 문제(재현 가능). */
  readonly seed: number;
}

/** 3단 힌트 사다리 티어 — PLAN §4.1-6 / 리서치 §3·§4.2. */
export type HintTier = 'point' | 'teach' | 'bottom-out';

/** 기법별 힌트 텍스트(자체 저작). 각 티어의 안내 문구. */
export interface HintLadder {
  /** Point: 어느 셀에서 시작할지 지목(1줄). */
  readonly point: LocalizedText;
  /** Teach: 규칙 1줄 재설명(부분 시연은 플레이어가 수행). */
  readonly teach: LocalizedText;
  /** Bottom-out: 답을 공개하며 안내하는 문구. */
  readonly bottomOut: LocalizedText;
}

/**
 * 전략 카드 선택지 — PLAN §4.2-10(자기 설명의 저비용 구현).
 * 독립 연습 정답 후 "나는 이렇게 풀었어" 선택. 분석은 M3, 여기선 기록만.
 */
export type StrategyChoice = 'this-technique' | 'other-technique' | 'just-knew';

/** 레슨 콘텐츠 파일(content/lessons/*.json)의 디스크 포맷. */
export interface LessonFile {
  readonly id: string;
  /** 진도 기록 키(ProgressRecord.skillId 와 일치). */
  readonly skillId: string;
  readonly chapter: number;
  /** 장 내 순서. */
  readonly order: number;
  /** 선행 레슨 skillId 목록(잠금 사슬). */
  readonly prerequisites: readonly string[];
  readonly title: LocalizedText;
  readonly subtitle: LocalizedText;
  /** 기법 규칙 1줄(자체 저작 — 힌트 Teach 문구로도 쓰임). */
  readonly rule: LocalizedText;
  readonly hook: {
    readonly problemSet: ProblemSet;
    readonly intro: LocalizedText;
    readonly outro: LocalizedText;
    /** 자동 시연 시간 권고(3~10초 — PLAN §3.3). 플레이어는 애니메이션 종료 또는 이 시간 후 전환. */
    readonly autoPlayMs: number;
  };
  readonly example: {
    readonly problemSet: ProblemSet;
    readonly intro: LocalizedText;
  };
  readonly fading: {
    readonly problemSet: ProblemSet;
    readonly intro: LocalizedText;
  };
  readonly practice: {
    readonly problemSet: ProblemSet;
    readonly intro: LocalizedText;
    readonly hints: HintLadder;
    /** 통과 정확도(PLAN §4.1-3 — 시간 모드 해금은 M3, 여기선 별 산정에 사용). */
    readonly passAccuracy: number;
  };
  readonly strategyCards: {
    readonly thisTechnique: LocalizedText;
    readonly otherTechnique: LocalizedText;
    readonly justKnew: LocalizedText;
  };
}

/** 로더가 만든 런타임 레슨 — 각 단계의 문제 세트가 구체적 Problem[] 로 전개된 것. */
export interface Lesson {
  readonly file: LessonFile;
  readonly hookProblems: readonly Problem[];
  readonly exampleProblems: readonly Problem[];
  readonly fadingProblems: readonly Problem[];
  readonly practiceProblems: readonly Problem[];
}
