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
 * 연산. M1 은 add/sub. M4 가 mul/div/est 를 추가한다. M5 가 sqrt 를 추가한다.
 * - mul: 곱셈(2×1·3×1·2×2·제곱). operands[0] × operands[1].
 * - div: 나눗셈. operands = [피제수(나뉘는 수), 제수(나누는 수)]. 답 = 몫 + 나머지.
 * - est: 어림셈. operands = 어림할 두 수. {@link Problem.estOf} 가 실제 연산을 가리킨다.
 * - sqrt: 지필 제곱근(M5, 6장). operands = [근호 아래 수]. 답 = 정수 제곱근(완전제곱수 기준).
 */
export type Op = 'add' | 'sub' | 'mul' | 'div' | 'est' | 'sqrt';

/**
 * 풀이 방법/방향 — 기법(technique) 식별자. method 선택 자체가 학습 내용의 일부(PLAN §3.2).
 * - ltr/rtl: add/sub 방향(M1). ltr=벤저민식(앞자리부터), rtl=학교식(뒷자리부터, 올림/빌림 표기).
 * - mul-running: 2×1·3×1 기본 곱셈(좌→우 부분곱 + 누계).
 * - mul-add/mul-sub/mul-factor/mul-11: 2×2 곱셈 4가지 방법(book-content-map §3).
 * - square: 2/3자리 제곱(±d 기법, X-다이어그램).
 * - div-1: 1자리 나눗셈(좌→우, 나머지).
 * - est-digit/est-band: 어림셈(자릿수 어림 / 반올림 밴드).
 *
 * M5 지필 트랙(6장 — **유일한 우→좌·쓰기 계열**, book-content-map §4-2):
 * - paper-column-add: 세로열 덧셈(여러 수 세로 합, 올림 위첨자).
 * - paper-cross-mult: 크리스크로스 곱셈(2×2~5×5, 1-2-…-2-1 대각선 리듬).
 * - paper-sqrt: 지필 제곱근(두 자리 그룹 나누기, 자리별 추정).
 * - mod-sum-check: 모드섬 검산(9 버리기·11 버리기 — 4장 배수판정과 연결).
 *
 * M6 고급 곱셈(8장 — book-content-map §8). 3장(2×2·제곱) + 5장(어림) + 7장(음성 코드) 을 선행.
 * - square-4digit: 4자리 제곱(1000 단위 ±d + 자리올림 선예측 750,000).
 * - mul-3x2: 3×2 곱셈(분해·반올림·인수분해 선택).
 * - square-5digit: 5자리 제곱(3항 분해 a²·2ab·b², 가운데 항 먼저).
 * - mul-3x3: 3×3 곱셈(근접수법 (z+a)(z+b)).
 * - mul-5x5: 5×5 곱셈(4분할 ac·(ad+cb)·bd). 8장 최종 보스.
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
  | 'est-band'
  | 'paper-column-add'
  | 'paper-cross-mult'
  | 'paper-sqrt'
  | 'mod-sum-check'
  | 'square-4digit'
  | 'mul-3x2'
  | 'square-5digit'
  | 'mul-3x3'
  | 'mul-5x5';

/**
 * 시맨틱 문제 스키마(PLAN §5.2 후보 A).
 * `operands[0] op operands[1]` 을 표현(대부분의 연산). sub 의 경우 `operands[0] >= operands[1]`
 * (아동 대상 — 음수 결과 없음, generate.ts 가 보장). 제곱은 `operands = [a, a]` 로 인코딩.
 *
 * M5: operands 를 `readonly number[]` 로 넓힌다(2개 이상 허용). 기존 2-피연산자 코드는
 * `[a, b] = operands` 구조분해로 그대로 동작(후속 요소 무시). **열 덧셈(paper-column-add)** 은
 * 3~5개의 피연산자를, **지필 제곱근(paper-sqrt)** 은 1개의 피연산자(근호 아래 수)를 가진다.
 */
export interface Problem {
  id?: string;
  op: Op;
  operands: readonly number[];
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

/**
 * memory: 계산 중간값을 "메모리 슬롯"(단어 카드/손가락) 에 저장하거나 되불러온다.
 * 7장 음성 코드(PLAN §7.1 메모리 슬롯) + 8장 고급 곱셈에서 사용. MemorySlot 컴포넌트가 소비.
 * - store: value 를 슬롯 slot 에 넣는다. digits/word 는 음성 코드로 변환한 힌트(선택).
 * - recall: 슬롯 slot 의 값을 되불러 합산에 쓴다.
 */
export interface MemoryStep {
  readonly t: 'memory';
  readonly action: 'store' | 'recall';
  /** 슬롯 식별자(예: "high", "mid"). */
  readonly slot: string;
  /** 저장/회수할 값. */
  readonly value: number;
  /** 음성 코드로 바꾼 숫자열(표시용, 선택). */
  readonly digits?: string;
  /** 사전에서 찾은 단어 후보(표시용, 선택). */
  readonly word?: string;
  readonly narration?: LocalizedText;
}

/** 파생된 순차 연출 단위. 판별 합합(discriminated union) — `t` 로 좁힌다. */
export type Step =
  | HighlightStep
  | WriteStep
  | CarryStep
  | StrikeStep
  | RevealStep
  | RunningStep
  | BranchStep
  | MemoryStep;

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

// ── M5 지필 트랙 시각화 데이터 모델(6장, 우→좌·쓰기 계열) ──────────────────────

/**
 * 세로열 덧셈 레이아웃(book-content-map §6-1). ColumnAddGrid 컴포넌트가 소비.
 * 여러 피연산자를 세로로 나열하고 오른쪽 열부터 더한다. 올림은 carry 행에 위첨자.
 */
export interface ColumnAddLayout {
  /** 더할 피연산자들(위→아래 순서). */
  readonly addends: readonly number[];
  /** 피연산수 최대 자릿수. */
  readonly digitCols: number;
  /** 합. */
  readonly sum: number;
  /** 자리별 올림(place 0=일의 자리 → 다음 자리로 넘길 올림). */
  readonly carries: readonly number[];
}

/**
 * 크리스크로스 곱셈의 한 대각선(book-content-map §6-5). CrossMultDiagram 이 소비.
 * 결과 자리 `resultPlace`(0=일의 자리)에 기여하는 자릿값 곱들의 모음.
 */
export interface CrossMultDiagonal {
  /** 결과 자리(0=일의 자리, 오른쪽부터). */
  readonly resultPlace: number;
  /** 이 대각선에서 곱해지는 자릿값 쌍들. [(a의 자리, a의 숫자, b의 자리, b의 숫자)]. */
  readonly pairs: readonly { readonly aPlace: number; readonly aDigit: number; readonly bPlace: number; readonly bDigit: number }[];
  /** 이 대각선의 곱-합(이전 올림 포함 전). */
  readonly rawSum: number;
  /** 이 자리에 쓰는 숫자(일의 자리). */
  readonly writeDigit: number;
  /** 다음 자리로 넘길 올림. */
  readonly carryOut: number;
}

/**
 * 크리스크로스 곱셈 레이아웃. **대각선 개수 = a자리수 + b자리수 − 1**, 곱 개수 패턴은
 * 1-2-…-min-…-2-1(3×3이면 1,2,3,2,1). CrossMultDiagram 컴포넌트가 SVG 대각선 오버레이로 렌더.
 */
export interface CrossMultLayout {
  readonly a: number;
  readonly b: number;
  readonly product: number;
  /** 대각선들을 결과의 일의 자리(인덱스 0)부터 나열. */
  readonly diagonals: readonly CrossMultDiagonal[];
}

/**
 * 지필 제곱근의 한 자리 단계(book-content-map §6-4). SquareRootDiagram 이 소비.
 * (현재 몫 × 2 에 빈칸을 붙인 `trial × d ≤ 나머지` 를 만족하는 최대 d 를 찾는 구조.)
 */
export interface SquareRootStep {
  /** 이 단계까지 확정된 몫(정수부). */
  readonly rootSoFar: number;
  /** 시험 제수의 "앞부분" = rootSoFar × 2. 빈칸(_)과 결합해 `trialBase_ × _` 형태. */
  readonly trialBase: number;
  /** 찾은 다음 자리 숫자. */
  readonly digit: number;
  /** 이 자리에서 빼는 곱(trialBase*10 + digit) × digit. */
  readonly product: number;
  /** 이 단계 처리 후 나머지(다음 두 자리 내려받기 전). */
  readonly remainder: number;
  /** 이 단계로 내려온(내려받은) 숫자 묶음. */
  readonly broughtDown: number;
}

/**
 * 지필 제곱근 레이아웃(book-content-map §6-4). SquareRootDiagram 컴포넌트가 소비.
 * 근호 아래 수를 소수점 기준 **두 자리씩 그룹핑**하고, 자리별로 몫을 확정한다.
 */
export interface SquareRootLayout {
  /** 근호 아래 수. */
  readonly radicand: number;
  /** 정수부 자릿수 그룹(왼→우). 예: 19 → [19], 502 → [5, 02]. */
  readonly groups: readonly number[];
  /** 정수 제곱근(완전제곱수 가정). */
  readonly root: number;
  /** 자리별 풀이 단계(왼→우). */
  readonly steps: readonly SquareRootStep[];
}

/**
 * 모드섬 검산 결과(book-content-map §6-2/§6-6). ModSumCheck 컴포넌트가 소비.
 * 9 버리기(자릿수 합 mod 9)·11 버리기(오른쪽부터 교대 ± mod 11) 두 채널.
 */
export interface ModSumResult {
  /** 검산 대상 연산. */
  readonly op: 'add' | 'sub' | 'mul';
  /** 9 버리기: 각 피연산자의 모드섬(0~8). */
  readonly mod9Operands: readonly number[];
  /** 9 버리기: 피연산자 모드섬들을 op 로 계산한 뒤 mod 9 한 예측값. */
  readonly mod9Expected: number;
  /** 9 버리기: 답의 실제 모드섬. */
  readonly mod9Answer: number;
  /** 9 버리기 통과 여부(mod9Expected === mod9Answer). */
  readonly mod9Match: boolean;
  /** 11 버리기 예측값(0~10). */
  readonly mod11Expected: number;
  /** 11 버리기 답 실제값. */
  readonly mod11Answer: number;
  /** 11 버리기 통과 여부. */
  readonly mod11Match: boolean;
}

// ── M6 고급 곱셈 시각화 데이터 모델(8장 — 분배법칙 분해 + 자리올림 선예측 + 메모리 슬롯) ────

/**
 * 자리올림 선예측(book-content-map §8-2). 5장 어림셈이 정밀 계산의 부품이 되는 지점.
 * 큰 자리부터 발화하기 위해 "다음 합이 다음 자리로 올림될까?"를 미리 판정한다.
 * 4자리 제곱 기준 임계값 750,000: d² ≤ 250,000 이므로 남은 하위 6자리 합이 750,000 미만이면
 * 백만 자리가 확정된다.
 */
export interface CarryPrediction {
  /** 예측 대상의 하위 부분합(product % 1_000_000). */
  readonly lowPart: number;
  /** 더해질 보정(d² 등). */
  readonly addition: number;
  /** 올림 발생 여부(lowPart + addition >= 1_000_000). */
  readonly willCarry: boolean;
  /** 임계값(book-content-map §8-2 의 750,000). */
  readonly threshold: number;
}

/**
 * 4자리 제곱 분해(book-content-map §8-2). A² = (A+d)(A−d) + d², d=1000 단위.
 * 자리올림 선예측({@link CarryPrediction}) + 중간값 메모리 슬롯 저장.
 */
export interface Square4Layout {
  readonly base: number;
  readonly d: number;
  readonly high: number;
  readonly low: number;
  readonly product: number;
  readonly dSquared: number;
  readonly answer: number;
  readonly carry: CarryPrediction;
}

/**
 * 3×2 곱셈 분해(book-content-map §8-3~8-5). 기법 선택(분해/반올림/인수분해) 중 덧셈법 기반.
 * b(2자리)를 (십+일)로 쪼개 a(3자리)에 두 번 곱해 더한다.
 */
export interface Mul3x2Layout {
  readonly a: number;
  readonly b: number;
  /** b 의 십의 자리 덩어리. */
  readonly tens: number;
  /** b 의 일의 자리. */
  readonly units: number;
  /** tens × a. */
  readonly tensProduct: number;
  /** units × a. */
  readonly unitsProduct: number;
  readonly answer: number;
}

/**
 * 5자리 제곱 3항 분해(book-content-map §8-6). (a·1000+b)² = a²·10⁶ + 2ab·10³ + b².
 * 가운데 항(2ab)을 먼저 계산해 메모리 슬롯에 저장 → a² → b² → 합산.
 */
export interface Square5Layout {
  readonly base: number;
  readonly a: number;
  readonly b: number;
  readonly aSquared: number;
  readonly twoAB: number;
  readonly bSquared: number;
  readonly answer: number;
}

/**
 * 3×3 근접수법 분해(book-content-map §8-8). (z+a)(z+b) = z(z+a+b) + ab.
 * 두 수가 같은 기준수 z(0 이 많은 수) 근처일 때 사용.
 */
export interface Mul3x3Layout {
  readonly a: number;
  readonly b: number;
  /** 기준수(가까운 100의 배수). */
  readonly z: number;
  /** a 의 편차(a − z). */
  readonly da: number;
  /** b 의 편차(b − z). */
  readonly db: number;
  /** z + da + db = a + db = b + da. */
  readonly mid: number;
  readonly zTimesMid: number;
  readonly deviationProduct: number;
  readonly answer: number;
}

/**
 * 5×5 4분할 분해(book-content-map §8-11). (a·1000+b)(c·1000+d) = ac·10⁶ + (ad+cb)·10³ + bd.
 * 어려운 3×2 두 개 → 메모리 슬롯 2개 저장 → 2×2 → 자리올림 예측 → 3×3.
 */
export interface Mul5x5Layout {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly ac: number;
  readonly ad: number;
  readonly cb: number;
  readonly bd: number;
  /** 천 단위 항(ad+cb). */
  readonly middle: number;
  readonly answer: number;
}
