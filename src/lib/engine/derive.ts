/**
 * 스텝 파생 엔진 — 순수 함수. PLAN.md §5.2 / book-content-map.md §2 제1장 규칙.
 *
 * 두 방향을 모두 지원한다(브리프 §2-2):
 * - **rtl(학교식)**: 자릿값을 오른쪽(일의 자리)부터 처리. **올림/빌림 표기**(carry 행 · op1 취소선)를
 *   스텝에 명시적으로 포함. 답 칸도 오른쪽부터 채운다.
 * - **ltr(벤저민식)**: 자릿값을 왼쪽(큰 자리)부터 처리. **올림/빌림 표기 없이** 머릿속 running-total 로
 *   답을 앞자리부터 확정(book-content-map §1). 뒤 자릿수의 올림으로 앞자리가 바뀌는 "수정 처리"는
 *   narration 으로 설명하고 그리드 답 칸은 최종값으로 왼쪽부터 채운다.
 *
 * 보수(complement) 뺄셈 변형: ltr 뺄셈에서 빌림이 필요한 자리가 있으면 narration 이 "올려 빼고
 * 되돌려주기" 분기로 설명한다(1장 §1-5/§1-6). 계산 결과는 동일.
 *
 * 그리드 레이아웃도 순수 함수 {@link deriveGrid} 로 분리 — 스텝과 같은 좌표계를 공유.
 * 모든 결과는 `a+b`/`a-b` 독립 계산과 대조해 테스트한다(derive.test.ts).
 */
import type { LocalizedText } from '../content/localized.js';
import type {
  CellId,
  ColId,
  Grid,
  GridRow,
  Problem,
  Step
} from './types.js';
import { deriveMulSteps } from './derive-mul.js';
import { deriveDivSteps } from './derive-div.js';
import { deriveEstSteps } from './derive-est.js';
import { derivePaperSteps } from './derive-paper.js';
import { pairOf } from './derive-internals.js';

/** 로케일 키 객체 생성 헬퍼(ko 필수, en 선택 → 누락 시 content/localized.ts 가 ko 폴백). */
const L = (ko: string, en?: string): LocalizedText => (en === undefined ? { ko } : { ko, en });

/** 연산의 표시 부호. */
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

/** 문제의 정확(또는 대표) 답. div 는 몫, est 는 어림 대표값, sqrt 는 정수 제곱근. 순수 함수. */
export function computeAnswer(problem: Problem): number {
  const [a, b] = pairOf(problem);
  switch (problem.op) {
    case 'add':
      // 열 덧셈(paper-column-add) 은 모든 피연산자의 합.
      if (problem.method === 'paper-column-add') return problem.operands.reduce((s, n) => s + n, 0);
      return a + b;
    case 'sub':
      return a - b;
    case 'mul':
      return a * b;
    case 'div':
      return Math.floor(a / b);
    case 'est':
      return a; // est 의 "대표값"은 컴포넌트가 EstimationBand.estimate 로 별도 산출.
    case 'sqrt':
      return Math.floor(Math.sqrt(a));
  }
}

/** 숫자를 자릿수 배열로. 일의 자리가 인덱스 0. `348 -> [8,4,3]`, `0 -> [0]`. */
function digitsOf(n: number): number[] {
  if (n === 0) return [0];
  const out: number[] = [];
  let m = n;
  while (m > 0) {
    out.push(m % 10);
    m = Math.floor(m / 10);
  }
  return out;
}

const placeNamesKo = ['일', '십', '백', '천', '만'];
const placeNamesEn = ['units', 'tens', 'hundreds', 'thousands', 'ten-thousands'];

/** 자릿값 이름("일"/"십"/…). 한국식 표기. 4자리(천)까지 지원 — M1 범위. */
function placeName(place: number): LocalizedText {
  const idx = Math.max(0, Math.min(place, placeNamesKo.length - 1));
  return L(`${placeNamesKo[idx]}의 자리`, `${placeNamesEn[idx]} place`);
}

// ── 그리드 파생 ─────────────────────────────────────────────────────────────

/**
 * 문제 → 세로셈 그리드 레이아웃. 순수 함수.
 *
 * 자릿값 열 수 = max(두 피연산자 자릿수, 답 자릿수) — `999+1=1000` 처럼 답 자릿수가 늘어나는
 * 경우까지 커버. 피연산자는 자릿값 열 안에서 **오른쪽 정렬**(일의 자리가 가장 오른쪽 열).
 *
 * add/sub/mul 은 열 그리드(ColumnGrid) 로 렌더. div/est 는 전용 컴포넌트(DivisionBracket /
 * SubstitutionChain) 를 쓰므로 여기서는 선형 표시용 최소 그리드만 만든다(부호 + 답 한 줄).
 */
export function deriveGrid(problem: Problem): Grid {
  const [a, b] = pairOf(problem);
  const answer = computeAnswer(problem);
  const digitCols = Math.max(String(a).length, String(b).length, String(answer).length);

  // c1(부호) + c2..c(digitCols+1)
  const cols: ColId[] = ['c1'];
  for (let i = 0; i < digitCols; i++) cols.push(`c${i + 2}`);

  const placeValueOf: Record<ColId, number> = {};
  cols.forEach((c, idx) => {
    placeValueOf[c] = idx === 0 ? -1 : digitCols - idx;
  });

  /** 숫자 n 의 각 자리를 op 행의 cells 로(오른쪽 정렬). */
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

  return { cols, rows, digitCols, placeValueOf };
}

/** 그리드에서 자릿값 place(0=일의 자리) 에 해당하는 열 id. */
function colAtPlace(grid: Grid, place: number): ColId {
  const col = grid.cols[grid.digitCols - place];
  if (!col) throw new Error(`place ${place} out of range for grid with ${grid.digitCols} digit cols`);
  return col;
}

// ── RTL(학교식) ──────────────────────────────────────────────────────────────

/** rtl 덧셈: 오른쪽부터. 받아올림 표기 포함. */
function deriveAddRTL(a: number, b: number, grid: Grid): Step[] {
  const steps: Step[] = [];
  const aD = digitsOf(a);
  const bD = digitsOf(b);
  const ansDigits = String(a + b).length;
  let carry = 0;

  for (let place = 0; place < grid.digitCols; place++) {
    const da = aD[place] ?? 0;
    const db = bD[place] ?? 0;
    const sum = da + db + carry;
    const digit = sum % 10;
    carry = Math.floor(sum / 10);

    // 답 자릿수보다 높은 자리(선행 0)는 쓰지 않는다 — 1000-1=999 가 4열 그리드에서 0999 로 보이지 않게.
    if (place >= ansDigits) continue;

    const col = colAtPlace(grid, place);
    const pn = placeName(place);
    steps.push({
      t: 'highlight',
      col,
      narration: L(
        `${pn.ko}를 더합니다: ${da} + ${db}${carry > 0 || sum >= 10 ? ` + 올림 ${Math.floor(sum / 10)}` : ''}`,
        pn.en !== undefined ? `Add the ${placeNamesEn[Math.min(place, 4)]}: ${da} + ${db}` : undefined
      )
    });
    steps.push({
      t: 'write',
      cell: `answer.${col}` as CellId,
      value: String(digit),
      expect: true,
      narration: L(`${pn.ko} 답: ${digit}`)
    });
    if (carry > 0) {
      const carryCol = colAtPlace(grid, place + 1);
      steps.push({
        t: 'carry',
        cell: `carry.${carryCol}` as CellId,
        value: String(carry),
        narration: L(`${sum} → ${digit} 쓰고 ${carry} 올림`, `${sum} → write ${digit}, carry ${carry}`)
      });
    }
  }
  return steps;
}

/** rtl 뺄셈: 오른쪽부터. 받아내림(취소선) 표기 포함. a >= b 가정. */
function deriveSubRTL(a: number, b: number, grid: Grid): Step[] {
  const steps: Step[] = [];
  const aD = digitsOf(a);
  const bD = digitsOf(b);
  const ansDigits = String(a - b).length;
  // 받아내림으로 줄어드는 op1 의 현재 자릿값(쓰기 가능하게 여분 자리 0 패딩).
  const top: number[] = [];
  for (let i = 0; i < grid.digitCols; i++) top.push(aD[i] ?? 0);

  for (let place = 0; place < grid.digitCols; place++) {
    const bot = bD[place] ?? 0;
    let t = top[place] ?? 0;
    const col = colAtPlace(grid, place);
    const pn = placeName(place);

    if (place >= ansDigits) continue; // 선행 0 답 칸은 생략

    steps.push({ t: 'highlight', col, narration: L(`${pn.ko}를 뺍니다`) });

    if (t < bot) {
      // 받아내림: 한 자리 위에서 1 빌려온다. 그 자리(op1)에 취소선.
      const borrowCol = colAtPlace(grid, place + 1);
      t += 10;
      const next = top[place + 1];
      if (next !== undefined) top[place + 1] = next - 1;
      steps.push({
        t: 'strike',
        cell: `op1.${borrowCol}` as CellId,
        narration: L(`${t - 10}은(는) ${bot}보다 작아 받아내림: ${t}으로 계산`, `Borrow: ${t - 10} < ${bot}, use ${t}`)
      });
    }

    const digit = t - bot;
    steps.push({
      t: 'write',
      cell: `answer.${col}` as CellId,
      value: String(digit),
      expect: true,
      narration: L(`${t} − ${bot} = ${digit}`)
    });
  }
  return steps;
}

// ── LTR(벤저민식) ─────────────────────────────────────────────────────────────

/** ltr 덧셈: 앞자리(큰 자리)부터 running-total 로 답 확정. 올림 표기 없음. */
function deriveAddLTR(a: number, b: number, grid: Grid): Step[] {
  const steps: Step[] = [];
  const answer = a + b;
  const ansDigits = String(answer).length;
  const aD = digitsOf(a);
  const bD = digitsOf(b);

  // 각 자리의 순수 합과 올림입력(carryIn) 을 오른쪽부터 한 번 계산해 둔다(정확한 답 확정용).
  const carryIn: number[] = new Array(grid.digitCols).fill(0);
  let c = 0;
  for (let place = 0; place < grid.digitCols; place++) {
    carryIn[place] = c;
    c = Math.floor(((aD[place] ?? 0) + (bD[place] ?? 0) + c) / 10);
  }

  // 1) 분해 + running-total narration (book-content-map §1: 큰 덩어리부터 더한다)
  steps.push({
    t: 'highlight',
    narration: L(
      `${a}에 ${b}를 더합니다. 큰 자리부터 더해요.`,
      `Add ${b} to ${a}, starting from the biggest place.`
    )
  });
  let running = a;
  for (let place = bD.length - 1; place >= 0; place--) {
    const db = bD[place] ?? 0;
    if (db === 0) continue;
    const chunk = db * 10 ** place;
    const next = running + chunk;
    steps.push({
      t: 'highlight',
      narration: L(`${running} + ${chunk} = ${next}`, `${running} + ${chunk} = ${next}`)
    });
    running = next;
  }

  // 2) 답을 앞자리부터 한 자리씩 확정·공개(digit-reveal). 뒤 자릿수 올림으로 값이 바뀐 자리는
  //    narration 으로 "수정"을 명시(벤저민식 "뒤 자릿수로 인한 수정 처리").
  steps.push({
    t: 'highlight',
    narration: L(`답을 앞자리부터 말해요: ${answer}`, `Say the answer from the left: ${answer}`)
  });
  for (let place = ansDigits - 1; place >= 0; place--) {
    const col = colAtPlace(grid, place);
    const da = aD[place] ?? 0;
    const db = bD[place] ?? 0;
    const naive = (da + db) % 10;
    const final = (da + db + (carryIn[place] ?? 0)) % 10;
    const pn = placeName(place);
    const revised = (carryIn[place] ?? 0) > 0;
    steps.push({
      t: 'write',
      cell: `answer.${col}` as CellId,
      value: String(final),
      expect: true,
      narration: revised
        ? L(
            `${pn.ko} ${naive}에서 올림 ${carryIn[place]}을(를) 받아 ${final}`,
            `${pn.en}: ${naive} + carry ${carryIn[place]} = ${final}`
          )
        : L(`${pn.ko}: ${da} + ${db} = ${final}`)
    });
  }
  return steps;
}

/** ltr 뺄셈: 앞자리부터 running-total. 빌림이 필요한 자리는 narration 이 "올려 빼고 되돌려주기"로 분기. */
function deriveSubLTR(a: number, b: number, grid: Grid): Step[] {
  const steps: Step[] = [];
  const answer = a - b;
  const ansDigits = String(answer).length;
  const bD = digitsOf(b);
  const aD = digitsOf(a);

  steps.push({
    t: 'highlight',
    narration: L(
      `${a}에서 ${b}를 뺍니다. 큰 자리부터 뺘니다.`,
      `Subtract ${b} from ${a}, starting from the biggest place.`
    )
  });
  let running = a;
  for (let place = bD.length - 1; place >= 0; place--) {
    const db = bD[place] ?? 0;
    if (db === 0) continue;
    const chunk = db * 10 ** place;
    const next = running - chunk;
    // 이 단위에서 빌림이 필요한가? running 의 이 자리 값 < db 인지.
    const runningDigit = Math.floor(running / 10 ** place) % 10;
    const needsBorrow = runningDigit < db;
    const pn = placeName(place);
    if (needsBorrow) {
      steps.push({
        t: 'highlight',
        narration: L(
          `${running} − ${chunk}: ${pn.ko}가 부족해 올려 빼고 되돌려줍니다 → ${next}`,
          `${running} − ${chunk}: round up and add back → ${next}`
        )
      });
    } else {
      steps.push({
        t: 'highlight',
        narration: L(`${running} − ${chunk} = ${next}`, `${running} − ${chunk} = ${next}`)
      });
    }
    running = next;
  }

  steps.push({
    t: 'highlight',
    narration: L(`답을 앞자리부터 말해요: ${answer}`, `Say the answer from the left: ${answer}`)
  });
  for (let place = ansDigits - 1; place >= 0; place--) {
    const col = colAtPlace(grid, place);
    const da = aD[place] ?? 0;
    const db = bD[place] ?? 0;
    // 뺄셈은 빌림 여부와 무관하게 최종 자릿값을 확정한다(ltr 은 표기 없이 머릿속 처리).
    let digit = da - db;
    // 빌림 전파(정확한 최종값) — 오른쪽부터 한 번 계산
    // (간단히: answer 의 해당 자리 숫자를 직접 읽는다 — answer 가 이미 정확하므로)
    digit = Math.floor(answer / 10 ** place) % 10;
    const pn = placeName(place);
    steps.push({
      t: 'write',
      cell: `answer.${col}` as CellId,
      value: String(digit),
      expect: true,
      narration: L(`${pn.ko} 답: ${digit}`)
    });
  }
  return steps;
}

/**
 * 문제 → 스텝 배열. 순수 함수.
 * `method` 가 `ltr` 이면 벤저민식, `rtl` 이면 학교식. 결과 스텝의 마지막 답은 항상
 * `operands[0] op operands[1]` 의 독립 계산과 일치한다(derive.test.ts 가 대조).
 *
 * @throws `operands[0] < operands[1]` 인 sub 문제(음수 결과) — generate.ts 가 방지.
 */
export function deriveSteps(problem: Problem): Step[] {
  const [a, b] = pairOf(problem);
  if (problem.op === 'sub' && a < b) {
    throw new Error(`sub requires operands[0] >= operands[1]; got ${a} - ${b}`);
  }
  if (problem.op === 'add' || problem.op === 'sub') {
    const grid = deriveGrid(problem);
    const m = problem.method;
    if (problem.op === 'add') {
      // 열 덧셈(paper-column-add) 은 지필 트랙으로 위임.
      if (m === 'paper-column-add') return derivePaperSteps(problem);
      return m === 'ltr' ? deriveAddLTR(a, b, grid) : deriveAddRTL(a, b, grid);
    }
    return m === 'ltr' ? deriveSubLTR(a, b, grid) : deriveSubRTL(a, b, grid);
  }
  if (problem.op === 'mul') {
    if (problem.method === 'paper-cross-mult' || problem.method === 'mod-sum-check') {
      return derivePaperSteps(problem);
    }
    return deriveMulSteps(problem);
  }
  if (problem.op === 'div') return deriveDivSteps(problem);
  if (problem.op === 'sqrt') return derivePaperSteps(problem);
  return deriveEstSteps(problem);
}
