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

/**
 * 연산. M1 은 add/sub. M4 가 mul/div/est 를 추가한다.
 * - mul: 곱셈(2×1·3×1·2×2·제곱). operands[0] × operands[1].
 * - div: 나눗셈. operands = [피제수(나뉘는 수), 제수(나누는 수)]. 답 = 몫 + 나머지.
 * - est: 어림셈. operands = 어림할 두 수. {@link Problem.estOf} 가 실제 연산을 가리킨다.
 */
export type Op = 'add' | 'sub' | 'mul' | 'div' | 'est';

/**
 * 풀이 방법/방향 — 기법(technique) 식별자. method 선택 자체가 학습 내용의 일부(PLAN §3.2).
 * - ltr/rtl: add/sub 방향(M1). ltr=벤저민식(앞자리부터), rtl=학교식(뒷자리부터, 올림/빌림 표기).
 * - mul-running: 2×1·3×1 기본 곱셈(좌→우 부분곱 + 누계).
 * - mul-add/mul-sub/mul-factor/mul-11: 2×2 곱셈 4가지 방법(book-content-map §3).
 * - square: 2/3자리 제곱(±d 기법, X-다이어그램).
 * - div-1: 1자리 나눗셈(좌→우, 나머지).
 * - est-digit/est-band: 어림셈(자릿수 어림 / 반올림 밴드).
 */
export type Method =
  | 'ltr'
  | 'rtl'
  | 'mul-running'
  | 'mul-add'
  | 'mul-sub'
  | 'mul-factor'
  | 'mul-11'
  | 'square'
  | 'div-1'
  | 'est-digit'
  | 'est-band';

/**
 * 시맨틱 문제 스키마(PLAN §5.2 후보 A).
 * `operands[0] op operands[1]` 을 표현. sub 의 경우 `operands[0] >= operands[1]`
 * (아동 대상 — 음수 결과 없음, generate.ts 가 보장). 제곱은 `operands = [a, a]` 로 인코딩.
 */
export interface Problem {
  id?: string;
  op: Op;
  operands: [number, number];
  method: Method;
  level: number;
  hints?: LocalizedText;
  /** op='est' 일 때 어림할 실제 연산. 그 외 op 에선 무시된다. */
  estOf?: 'add' | 'sub' | 'mul' | 'div';
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

/**
 * running: 누계 롤링 카운터(RollingCounter 컴포넌트)에 값을 설정한다.
 * 곱셈의 부분곱 누적(300×7=2100 → +140 → 2240 …) 단계에서 매번 갱신된다.
 * ColumnGrid 렌더러는 이 스텝을 무시한다(별도 컴포넌트가 소비).
 */
export interface RunningStep {
  readonly t: 'running';
  /** 롤링 카운터가 보여줄 현재 누계. */
  readonly total: number;
  /** 이번에 더한/뺀 부분. 표시용(롤링 효과의 방향 힌트). */
  readonly delta?: number;
  readonly narration?: LocalizedText;
}

/**
 * branch: X-다이어그램의 ±d 분기처럼 한 단계가 두 갈래(또는 한 값의 변형)로 갈라짐을 표시.
 * XDiagram·SubstitutionChain 컴포넌트가 소비. ColumnGrid 는 무시.
 */
export interface BranchStep {
  readonly t: 'branch';
  /** 분기의 두 갈래 값(예: 위로 +d, 아래로 −d). 치환 체인이면 [원래, 치환] 한 쌍. */
  readonly from: number;
  readonly to: number;
  /** 분기 라벨(예: "+d", "−4"). */
  readonly label?: string;
  readonly narration?: LocalizedText;
}

/** 파생된 순차 연출 단위. 판별 합합(discriminated union) — `t` 로 좁힌다. */
export type Step = HighlightStep | WriteStep | CarryStep | StrikeStep | RevealStep | RunningStep | BranchStep;

/** ColumnGrid 셀의 시각 상태. */
export type CellState = 'idle' | 'highlight' | 'filled' | 'correct' | 'wrong';

// ── M4 시각화 데이터 모델(컴포넌트가 소비, 순수 함수가 생성) ──────────────────

/**
 * 제곱의 ±d 분기 다이어그램(book-content-map §2-3/§3-5, §4-1 X-다이어그램).
 * A² = (A+d)(A−d) + d². **재귀 중첩**: d² 가 다시 2자리 제곱이면 내부에 또 다이어그램이 들어간다
 * (3자리 제곱의 d² 가 2자리 제곱이 되는 구조). XDiagram 컴포넌트가 재귀적으로 렌더.
 */
export interface SquareDiagram {
  /** 제곱할 수 A. */
  readonly base: number;
  /** 가까운 10(또는 100)의 배수까지의 거리 d. */
  readonly d: number;
  /** 올린 수 A+d. */
  readonly high: number;
  /** 내린 수 A−d. */
  readonly low: number;
  /** (A+d)(A−d) 곱. */
  readonly product: number;
  /** d². 2자리 제곱이면 내부에 축소 다이어그램이 중첩된다(재귀). */
  readonly dSquared: number;
  /** d² 가 2자리 제곱 기법으로 풀리면 그 내부 다이어그램(없으면 undefined). */
  readonly nested?: SquareDiagram;
  /** 최종 답 A². */
  readonly answer: number;
}

/**
 * 곱셈의 부분곱 한 줄(RollingCounter 컴포넌트가 세로 나열).
 * `factor × unit = product`, 누계에 product 를 더하거나 뺀다.
 */
export interface PartialProduct {
  /** 이번에 곱한 덩어리(예: 40, 2 / 또는 인수 9). */
  readonly factor: number;
  /** 곱해진 단위(예: 7). */
  readonly unit: number;
  /** 부분곱 결과. */
  readonly product: number;
  /** 누계에 더하는지(+) 빼는지(−). 뺄셈법 곱셈에서 − 등장. */
  readonly sign: '+' | '-';
  /** 이 부분곱 후의 누계(running total). */
  readonly runningTotal: number;
}

/**
 * 나눗셈 브래킷 레이아웃(DivisionBracket 컴포넌트).
 * 긴나눗셈을 좌→우로 한 자리씩: `7)179` → 몫 25, 나머지 4.
 */
export interface DivisionDigit {
  /** 몫의 한 자리(좌→우 확정 순서). */
  readonly digit: number;
  /** 이 자리에서의 곱(제수 × digit). 예: 7×2=14. */
  readonly product: number;
  /** 이 자리 처리 후 남은 나머지(다음 자리 숫자를 내려받기 전). */
  readonly remainder: number;
  /** 이 자리로 내려온 피제수 일부(예: 첫 자리 17, 다음 39). */
  readonly broughtDown: number;
}

export interface DivisionLayout {
  readonly dividend: number;
  readonly divisor: number;
  readonly quotient: number;
  readonly remainder: number;
  /** 몫의 각 자리를 좌→우 확정 순서로. 빈 몫 자리는 포함하지 않는다(선행 0 생략). */
  readonly digits: readonly DivisionDigit[];
}

/**
 * 어림셈 결과(EstimationBand). 정답이 **범위**가 될 수 있다(브리프 §2 "정답이 범위인 문제 유형").
 */
export interface EstimationBand {
  /** 어림한 대표값(반올림한 수로 계산한 추정치). */
  readonly estimate: number;
  /** 허용 하한(밴드). */
  readonly low: number;
  /** 허용 상한(밴드). */
  readonly high: number;
  /** 실제 정확값(참고용). */
  readonly exact: number;
  /** 어림에 사용한 반올림 표현(예: "23.9백만 + 7.4백만"). */
  readonly roundingNote: LocalizedText;
}
