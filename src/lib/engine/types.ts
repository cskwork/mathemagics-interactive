/**
 * 계산 코어의 시맨틱 타입 — PLAN.md §5.2 / 리서치 vertical-notation-editors.md §4.
 *
 * 두 포맷을 이원화한다(PLAN §5.2 결정):
 * - {@link Problem}(후보 A): 문제의 "의미"만 저장. 스텝은 deriveSteps 가 런타임 파생.
 *   벤저민식(ltr)/학교식(rtl) 전환이 필드 하나로 끝나고, 파생 엔진이 곧 채점기가 된다.
 * - {@link Step} / {@link Grid}(후보 B): 파생 결과물. 셀 좌표 + 순차 연출.
 *
 * narration(말풍선 + aria-live 낭독)은 로케일 키 객체({ko, en}, ko 폴백) —
 * PLAN §6.2 / content/localized.ts 규약. UI 문자열(Paraglide 메시지)과는 별개.
 *
 * 모든 계산은 순수 함수로, UI 와 분리된다(PLAN §9).
 */
import type { LocalizedText } from '../content/localized.js';

/** 연산. M1 은 add/sub. mul/div 는 M4. */
export type Op = 'add' | 'sub';

/** 풀이 방향. ltr = 벤저민식(앞자리부터 확정), rtl = 학교식(뒷자리부터, 올림/빌림 표기 포함). */
export type Method = 'ltr' | 'rtl';

/**
 * 시맨틱 문제 스키마(PLAN §5.2 후보 A).
 * `operands[0] op operands[1]` 을 표현. sub 의 경우 `operands[0] >= operands[1]`
 * (아동 대상 — 음수 결과 없음, generate.ts 가 보장).
 */
export interface Problem {
  id?: string;
  op: Op;
  operands: [number, number];
  method: Method;
  level: number;
  hints?: LocalizedText;
}

// ── 그리드(후보 B 의 레이아웃 부분) ──────────────────────────────────────────

/** 그리드 행 식별자. 위에서 아래 순: carry(받아올림) · op1(위 피연산자) · op2(아래 피연산자+부호) · answer(답). */
export type RowId = 'carry' | 'op1' | 'op2' | 'answer';

/** 열 식별자. `c1` = 부호 열(좌단), `c2..cN` = 자릿값 열(좌→우). */
export type ColId = string;

export interface GridRow {
  readonly id: RowId;
  /** colId -> 표시할 글자(숫자 한 자리, 또는 op2 의 `'+'`/`'−'`). 빈 칸은 키를 생략한다. */
  readonly cells: Partial<Record<ColId, string>>;
  /** 이 행 아래에 밑줄을 긋는다(op2 행). */
  readonly underline?: boolean;
  /** 학생 입력 대상 행(answer 행). */
  readonly input?: boolean;
}

export interface Grid {
  /** 좌→우 열 id. 예: `['c1','c2','c3','c4']`. */
  readonly cols: readonly ColId[];
  readonly rows: readonly GridRow[];
  /** 자릿값 열 수(`cols.length - 1`, 부호 열 제외). */
  readonly digitCols: number;
  /** colId -> 자릿값(0=일의 자리, 1=십의 자리, …). 부호 열 `c1` 은 -1. */
  readonly placeValueOf: Readonly<Record<ColId, number>>;
}

// ── 스텝(후보 B 의 연출 부분) ────────────────────────────────────────────────

/**
 * 셀 주소 = `"행.열"`(예: `"answer.c4"`). 리서치 §4 후보 B 와 1:1.
 * ColumnGrid 렌더러의 CSS Grid 좌표와 직접 대응한다.
 */
export type CellId = string;

/** highlight: 특정 열/셀에 시선을 유도(현재 계산 중인 자릿값). */
export interface HighlightStep {
  readonly t: 'highlight';
  readonly col?: ColId;
  readonly cells?: readonly CellId[];
  readonly narration?: LocalizedText;
}

/**
 * write: 셀에 값을 쓴다(답 칸 1개).
 * `expect: true` 면 **학생 입력 대기 지점**(연습 모드) — 애니메이션 모드에선 자동 재생.
 */
export interface WriteStep {
  readonly t: 'write';
  readonly cell: CellId;
  readonly value: string;
  readonly expect?: true;
  readonly narration?: LocalizedText;
}

/** carry: 받아올림 숫자를 carry 행의 해당 열에 표시(rtl 덧셈). */
export interface CarryStep {
  readonly t: 'carry';
  readonly cell: CellId;
  readonly value: string;
  readonly narration?: LocalizedText;
}

/** strike: 받아내림 — op1 셀에 취소선 사선(rtl 뺄셈). */
export interface StrikeStep {
  readonly t: 'strike';
  readonly cell: CellId;
  readonly narration?: LocalizedText;
}

/** reveal: 답 칸(여럿 가능)에 값을 한꺼번에 공개(LTR 최종 확정 등). */
export interface RevealStep {
  readonly t: 'reveal';
  readonly cells: readonly CellId[];
  readonly value: string;
  readonly narration?: LocalizedText;
}

/** 파생된 순차 연출 단위. 판별 합합(discriminated union) — `t` 로 좁힌다. */
export type Step = HighlightStep | WriteStep | CarryStep | StrikeStep | RevealStep;

/** ColumnGrid 셀의 시각 상태. */
export type CellState = 'idle' | 'highlight' | 'filled' | 'correct' | 'wrong';
