/**
 * 엔진 공용 순수 보조 함수 — derive.ts(add/sub)·derive-mul.ts·derive-div.ts·derive-est.ts 가 공유.
 * 여기에 두어 순환 의존(derive ↔ derive-mul)을 끊는다.
 */
import type { CellId, ColId, Grid, GridRow, Problem } from './types.js';

const placeNamesKo = ['일', '십', '백', '천', '만', '십만'];
const placeNamesEn = ['units', 'tens', 'hundreds', 'thousands', 'ten-thousands', 'hundred-thousands'];

/** 숫자를 자릿수 배열로. 일의 자리가 인덱스 0. `348 -> [8,4,3]`, `0 -> [0]`. */
export function digitsOf(n: number): number[] {
  if (n === 0) return [0];
  const out: number[] = [];
  let m = n;
  while (m > 0) {
    out.push(m % 10);
    m = Math.floor(m / 10);
  }
  return out;
}

/** 자릿값 이름("일"/"십"/…). 5자리(만)까지 지원. */
export function placeName(place: number): { ko: string; en: string } {
  const idx = Math.max(0, Math.min(place, placeNamesKo.length - 1));
  return { ko: `${placeNamesKo[idx]}의 자리`, en: `${placeNamesEn[idx]} place` };
}

/** 그리드에서 자릿값 place(0=일의 자리) 에 해당하는 열 id. */
export function colAtPlace(grid: Grid, place: number): ColId {
  const col = grid.cols[grid.digitCols - place];
  if (!col) throw new Error(`place ${place} out of range for grid with ${grid.digitCols} digit cols`);
  return col;
}

/** 연산의 정확(또는 대표) 답. div 는 몫, sqrt 는 정수 제곱근. */
export function answerOf(op: Problem['op'], a: number, b: number): number {
  switch (op) {
    case 'add':
      return a + b;
    case 'sub':
      return a - b;
    case 'mul':
      return a * b;
    case 'div':
      return Math.floor(a / b);
    case 'est':
      return a;
    case 'sqrt':
      return Math.floor(Math.sqrt(a));
  }
}

/** 연산 표시 부호. */
export function opSign(op: Problem['op']): string {
  switch (op) {
    case 'add':
      return '+';
    case 'sub':
      return '−';
    case 'mul':
      return '×';
    case 'div':
      return '÷';
    case 'est':
      return '≈';
    case 'sqrt':
      return '√';
  }
}

/**
 * 2-피연산자 문제의 피연산자 쌍을 안전하게 가져온다. M5 가 operands 를
 * `readonly number[]` 로 넓혀 `noUncheckedIndexedAccess` 가 걸리므로, 2-피연산자 기법
 * (add/sub/mul/div/est/square) 는 이 접근자로 [a, b] 를 얻는다. 누락 시 0.
 */
export function pairOf(problem: Problem): [number, number] {
  return [problem.operands[0] ?? 0, problem.operands[1] ?? 0];
}

/** i 번째 피연산자(없으면 0). 열 덧셈 등 다-피연산자 기법이 사용. */
export function operandAt(problem: Problem, i: number): number {
  return problem.operands[i] ?? 0;
}

/**
 * 문제 → 세로셈 그리드 레이아웃. add/sub/mul 은 열 그리드. div/est 는 전용 컴포넌트를 쓰지만
 * 여기서도 최소 그리드(답 자릿수 맞춤)를 만들어 dispatch 가 깨지지 않게 한다.
 * `answerOverride`(선택) 로 답 자릿수를 강제 — 어림셈(estimate 가 피연산자보다 자릿수가 큰 경우) 용.
 */
export function deriveGrid(problem: Problem, answerOverride?: number): Grid {
  const [a, b] = pairOf(problem);
  const answer = answerOverride ?? answerOf(problem.op, a, b);
  const digitCols = Math.max(String(a).length, String(b).length, String(answer).length, 1);

  const cols: ColId[] = ['c1'];
  for (let i = 0; i < digitCols; i++) cols.push(`c${i + 2}`);

  const placeValueOf: Record<ColId, number> = {};
  cols.forEach((c, idx) => {
    placeValueOf[c] = idx === 0 ? -1 : digitCols - idx;
  });

  const numberCells = (n: number): Partial<Record<ColId, string>> => {
    const cells: Partial<Record<ColId, string>> = {};
    digitsOf(n).forEach((d, place) => {
      const col = cols[digitCols - place];
      if (col) cells[col] = String(d);
    });
    return cells;
  };

  const op2Cells: Partial<Record<ColId, string>> = {
    c1: opSign(problem.op),
    ...numberCells(b)
  };

  const rows: GridRow[] = [
    { id: 'carry', cells: {} },
    { id: 'op1', cells: numberCells(a) },
    { id: 'op2', cells: op2Cells, underline: true },
    { id: 'answer', cells: {}, input: true }
  ];

  if (problem.op === 'div' && problem.method !== 'divisibility') {
    const quotientRows: GridRow[] = [
      { id: 'op1', cells: numberCells(a) },
      { id: 'op2', cells: op2Cells, underline: true },
      { id: 'quotient', cells: {}, input: true, label: { ko: '몫', en: 'Quotient' } }
    ];
    if (a % b !== 0 && problem.method === 'div-1') {
      quotientRows.push({ id: 'remainder', cells: {}, input: true, label: { ko: '나머지', en: 'Remainder' } });
    }
    return { cols, rows: quotientRows, digitCols, placeValueOf };
  }

  return { cols, rows, digitCols, placeValueOf };
}

/** 답을 앞자리(큰 자리)부터 한 자리씩 write 스텝으로. 모든 곱셈 기법이 답을 좌→우로 확정. */
export function writeAnswerLTR(answer: number, grid: Grid): import('./types.js').Step[] {
  const steps: import('./types.js').Step[] = [];
  const ansStr = String(answer);
  for (let i = 0; i < ansStr.length; i++) {
    const place = ansStr.length - 1 - i;
    const col = colAtPlace(grid, place);
    const digit = Number(ansStr[i]);
    steps.push({
      t: 'write',
      cell: `answer.${col}` as CellId,
      value: String(digit),
      expect: true
    });
  }
  return steps;
}
