/**
 * 지필(세로셈) 트랙 스텝 파생 + 레이아웃 — 순수 함수. book-content-map.md §6(6장) 규칙.
 *
 * **6장만 유일하게 오른쪽→왼쪽·종이에 쓰는 계산**이다(§4-2). ltr(벤저민식 앞자리부터) 계열과
 * 방향이 반대. 네 기법을 같은 `deriveSteps` 인터페이스로:
 * - paper-column-add(열 덧셈): 여러 수를 세로로 오른쪽 열부터 더한다. 올림 위첨자.
 * - paper-cross-mult(크리스크로스): 두 수를 위아래로 쓰고 **대각선 교차곱**을 더해 답을 오른쪽부터
 *   한 자리씩 쓴다. **곱 개수 패턴 1-2-…-min-…-2-1**(3×3이면 1,2,3,2,1) — 이 리듬이 애니메이션 리듬.
 * - paper-sqrt(지필 제곱근): 근호 아래 수를 두 자리씩 그룹핑, 자리별 추정(8_ × _ 형태).
 * - mod-sum-check(모드섬 검산): 9 버리기·11 버리기로 답 검증. {@link modsum.ts} 참조.
 *
 * 모든 결과는 독립 산술(합·곱·isqrt)과 대조해 테스트한다. narration 은 규칙 기반 자체 생성문
 * (원문 문장 복제 금지 — PLAN §10-1). 크로스크로스의 대각선 리듬은 derive-paper.test.ts 가 단언.
 */
import type { LocalizedText } from '../content/localized.js';
import type {
  CellId,
  ColumnAddLayout,
  CrossMultLayout,
  Problem,
  SquareRootLayout,
  Step
} from './types.js';
import { checkModSum } from './modsum.js';
import { colAtPlace, deriveGrid, digitsOf, pairOf } from './derive-internals.js';

const L = (ko: string, en?: string): LocalizedText => (en === undefined ? { ko } : { ko, en });

/** 답 칸을 오른쪽(일의 자리)부터 한 자리씩 write(지필 = 우→좌). */
function writeAnswerRTL(answer: number, grid: import('./types.js').Grid): Step[] {
  const steps: Step[] = [];
  const ansStr = String(answer);
  for (let i = ansStr.length - 1; i >= 0; i--) {
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

// ── 열 덧셈(paper-column-add) ──────────────────────────────────────────────────

/** 열 덧셈 레이아웃. 순수 함수. ColumnAddGrid 컴포넌트가 소비. */
export function columnAddLayout(problem: Problem): ColumnAddLayout {
  const addends = [...problem.operands];
  const digitCols = addends.reduce((m, n) => Math.max(m, String(n).length), 1);
  const sum = addends.reduce((s, n) => s + n, 0);
  const carries: number[] = new Array(Math.max(digitCols, String(sum).length)).fill(0);
  const addendDigits = addends.map((n) => {
    const d = digitsOf(n);
    while (d.length < digitCols) d.push(0);
    return d;
  });
  let carry = 0;
  for (let place = 0; place < digitCols; place++) {
    const colSum = addendDigits.reduce((s, digs) => s + (digs[place] ?? 0), 0) + carry;
    carries[place] = Math.floor(colSum / 10); // 이 자리에서 다음 자리로 넘기는 올림
    carry = carries[place] ?? 0;
  }
  return { addends, digitCols, sum, carries };
}

/** 열 덧셈 스텝: 오른쪽 열부터 누적 + 올림 위첨자 + 합 write(우→좌). */
function deriveColumnAddSteps(problem: Problem): Step[] {
  const layout = columnAddLayout(problem);
  const grid = deriveGrid(problem, layout.sum);
  const steps: Step[] = [
    {
      t: 'highlight',
      narration: L(
        `${layout.addends.length}개 수를 오른쪽 열부터 더해요. 끝자리를 적고 올림은 다음 열로.`
      )
    }
  ];
  const addendDigits = layout.addends.map((n) => {
    const d = digitsOf(n);
    while (d.length < layout.digitCols) d.push(0);
    return d;
  });
  const answerDigits = String(layout.sum).length; // 합 자릿수(올림으로 늘어난 자리 포함)
  let carry = 0;
  for (let place = 0; place < answerDigits; place++) {
    const col = colAtPlace(grid, place);
    const colSum = addendDigits.reduce((s, digs) => s + (digs[place] ?? 0), 0) + carry;
    const digit = colSum % 10;
    const carryOut = Math.floor(colSum / 10);
    steps.push({
      t: 'highlight',
      col,
      narration: L(`이 열의 합 ${colSum}: ${digit}을(를) 적고 ${carryOut} 올림`)
    });
    steps.push({
      t: 'write',
      cell: `answer.${col}` as CellId,
      value: String(digit),
      expect: true
    });
    if (carryOut > 0 && place + 1 < answerDigits) {
      const carryCol = colAtPlace(grid, place + 1);
      steps.push({
        t: 'carry',
        cell: `carry.${carryCol}` as CellId,
        value: String(carryOut),
        narration: L(`${carryOut} 올림`)
      });
    }
    carry = carryOut;
  }
  return steps;
}

// ── 크리스크로스 곱셈(paper-cross-mult) ─────────────────────────────────────────

/**
 * 크리스크로스 곱셈 레이아웃. 순수 함수. CrossMultDiagram 이 소비.
 * 결과 자리 p(0=일의 자리)에 기여하는 대각선 = {(i,j) : i+j=p, 0≤i<a자리수, 0≤j<b자리수}.
 * **대각선별 곱 개수 = 1,2,…,min(a,b),…,2,1**(브리프 §3 핵심 리듬 단언 대상).
 */
export function crossMultLayout(problem: Problem): CrossMultLayout {
  const [a, b] = pairOf(problem);
  const aD = digitsOf(a);
  const bD = digitsOf(b);
  const aLen = aD.length;
  const bLen = bD.length;
  const diagonals: import('./types.js').CrossMultDiagonal[] = [];
  let carry = 0;
  for (let p = 0; p <= aLen + bLen - 2; p++) {
    const pairs: {
      aPlace: number;
      aDigit: number;
      bPlace: number;
      bDigit: number;
    }[] = [];
    let rawSum = carry;
    for (let i = 0; i <= p; i++) {
      const j = p - i;
      if (i < aLen && j < bLen) {
        const aDigit = aD[i] ?? 0;
        const bDigit = bD[j] ?? 0;
        pairs.push({ aPlace: i, aDigit, bPlace: j, bDigit });
        rawSum += aDigit * bDigit;
      }
    }
    const writeDigit = rawSum % 10;
    const carryOut = Math.floor(rawSum / 10);
    diagonals.push({ resultPlace: p, pairs, rawSum, writeDigit, carryOut });
    carry = carryOut;
  }
  // 가장 큰 자리의 올림이 남으면 답 자릿수가 하나 더 늘어난다(carry 가 마지막 writeDigit 이 됨).
  return { a, b, product: a * b, diagonals };
}

/** 크리스크로스 스텝: 대각선마다 하이라이트(해당 자릿값 쌍) + 답 한 자리 write(우→좌). */
function deriveCrossMultSteps(problem: Problem): Step[] {
  const layout = crossMultLayout(problem);
  const grid = deriveGrid(problem, layout.product);
  const steps: Step[] = [
    {
      t: 'highlight',
      narration: L(
        `${layout.a} × ${layout.b} 을(를) 대각선으로 교차해 곱해요. 답이 오른쪽부터 한 자리씩 나와요.`
      )
    }
  ];
  let finalCarry = 0;
  for (const diag of layout.diagonals) {
    const col = colAtPlace(grid, diag.resultPlace);
    const pairTxt = diag.pairs.map((p) => `${p.aDigit}×${p.bDigit}`).join(' + ');
    steps.push({
      t: 'highlight',
      col,
      cells: diag.pairs.map(
        (p) => `op1.${colAtPlace(grid, p.aPlace)}` // 시선 유도용(정확한 쌍은 컴포넌트가 대각선으로 그림)
      ),
      narration: L(
        `이 자리의 대각선: ${pairTxt}${diag.rawSum >= 10 ? ` = ${diag.rawSum}` : ''} → ${diag.writeDigit} 적기`
      )
    });
    steps.push({
      t: 'write',
      cell: `answer.${col}` as CellId,
      value: String(diag.writeDigit),
      expect: true
    });
    finalCarry = diag.carryOut;
  }
  // 마지막 대각선 뒤 남은 올림 = 가장 큰 자리(들). multi-digit 일 수 있어 자리별로 write.
  if (finalCarry > 0) {
    const carryStr = String(finalCarry);
    const basePlace = layout.diagonals.length; // 다음 자리부터
    for (let i = 0; i < carryStr.length; i++) {
      const place = basePlace + (carryStr.length - 1 - i);
      const col = colAtPlace(grid, place);
      steps.push({
        t: 'write',
        cell: `answer.${col}` as CellId,
        value: carryStr[i] ?? '0',
        expect: true
      });
    }
  }
  return steps;
}

// ── 지필 제곱근(paper-sqrt) ─────────────────────────────────────────────────────

/** 정수부를 오른쪽에서 두 자리씩 그룹핑. 예: 529 → [5,29], 19 → [19], 5 → [5], 1234 → [12,34]. */
function groupsOf(radicand: number): number[] {
  const s = String(Math.trunc(radicand));
  const groups: number[] = [];
  for (let i = s.length; i > 0; i -= 2) {
    const start = Math.max(0, i - 2);
    groups.unshift(Number(s.slice(start, i)));
  }
  return groups;
}

/**
 * 지필 제곱근 레이아웃. 순수 함수. SquareRootDiagram 이 소비. book-content-map §6-4.
 * (1) 첫 그룹에서 제곱이 넘지 않는 최대 수 x → 첫 몫. (2) 제곱을 빼고 두 자리 내림.
 * (3) 현재 몫×2 에 빈칸을 붙여 `trialBase_ × _ ≤ 나머지` 만족 최대 d. (4) 반복.
 */
export function squareRootLayout(problem: Problem): SquareRootLayout {
  const radicand = problem.operands[0] ?? 0;
  const groups = groupsOf(radicand);
  const steps: import('./types.js').SquareRootStep[] = [];
  const first = groups[0] ?? 0;
  const firstRoot = Math.floor(Math.sqrt(first));
  let remainder = first - firstRoot * firstRoot;
  let root = firstRoot;
  steps.push({
    rootSoFar: root,
    trialBase: 0,
    digit: root,
    product: root * root,
    remainder,
    broughtDown: first
  });
  for (let g = 1; g < groups.length; g++) {
    const group = groups[g] ?? 0;
    const broughtDown = remainder * 100 + group;
    const trialBase = root * 2; // "현재 몫의 2배" — 빈칸을 붙여 trialBase×10+d
    let digit = 9;
    while (digit > 0 && (trialBase * 10 + digit) * digit > broughtDown) digit--;
    const product = (trialBase * 10 + digit) * digit;
    remainder = broughtDown - product;
    root = root * 10 + digit;
    steps.push({ rootSoFar: root, trialBase, digit, product, remainder, broughtDown });
  }
  return { radicand, groups, root, steps };
}

/** 지필 제곱근 스텝: 그룹 하이라이트 + 자리별 추정 + 몹 write(좌→우, 답은 근호 위). */
function deriveSquareRootSteps(problem: Problem): Step[] {
  const layout = squareRootLayout(problem);
  const grid = deriveGrid(problem, layout.root);
  const steps: Step[] = [
    {
      t: 'highlight',
      narration: L(`${layout.radicand} 의 제곱근. 숫자를 두 자리씩 묶어요.`)
    }
  ];
  for (let i = 0; i < layout.steps.length; i++) {
    const st = layout.steps[i]!;
    if (i === 0) {
      steps.push({
        t: 'highlight',
        narration: L(`첫 묶음 ${st.broughtDown}: 제곱이 넘지 않는 가장 큰 수 ${st.digit} (${st.digit}²=${st.product})`)
      });
    } else {
      steps.push({
        t: 'highlight',
        narration: L(
          `${st.trialBase}_ × _ 를 ${st.broughtDown}에 맞춰 ${st.digit}(${st.trialBase}${st.digit}×${st.digit}=${st.product})`
        )
      });
    }
    // 몫 자리를 좌→우로 확정(근호 위에 적는 자리).
    const place = layout.steps.length - 1 - i;
    const col = colAtPlace(grid, place);
    steps.push({
      t: 'write',
      cell: `answer.${col}` as CellId,
      value: String(st.digit),
      expect: true
    });
  }
  return steps;
}

// ── 모드섬 검산(mod-sum-check) ──────────────────────────────────────────────────

/** 모드섬 검산 스텝: 계산 결과 하이라이트 + 9/11 버리기 검산 과정 narration. */
function deriveModSumCheckSteps(problem: Problem): Step[] {
  const [a, b] = pairOf(problem);
  const op: 'add' | 'sub' | 'mul' = problem.op === 'mul' ? 'mul' : 'add';
  const answer = op === 'mul' ? a * b : a + b;
  const result = checkModSum(op, [a, b], answer);
  const grid = deriveGrid(problem, answer);
  const steps: Step[] = [
    { t: 'highlight', narration: L(`${a}${op === 'mul' ? '×' : '+'}${b} = ${answer}. 이게 맞는지 검산해요.`) },
    {
      t: 'highlight',
      narration: L(
        `9 버리기: ${result.mod9Operands.join(op === 'mul' ? '×' : '+')} → ${result.mod9Expected}, 답의 모드섬 ${result.mod9Answer} ${result.mod9Match ? '✓ 같아요' : '✗ 달라요(틀림)'}`
      )
    },
    {
      t: 'highlight',
      narration: L(
        `11 버리기: 예측 ${result.mod11Expected}, 답 ${result.mod11Answer} ${result.mod11Match ? '✓' : '✗'}`
      )
    }
  ];
  steps.push(...writeAnswerRTL(answer, grid));
  return steps;
}

// ── 메인 디스패치 ─────────────────────────────────────────────────────────────

/** 지필 트랙 문제 → 스텝. method 로 기법을 나눈다(6장 전용). */
export function derivePaperSteps(problem: Problem): Step[] {
  switch (problem.method) {
    case 'paper-column-add':
      return deriveColumnAddSteps(problem);
    case 'paper-cross-mult':
      return deriveCrossMultSteps(problem);
    case 'paper-sqrt':
      return deriveSquareRootSteps(problem);
    case 'mod-sum-check':
      return deriveModSumCheckSteps(problem);
    default:
      throw new Error(`derivePaperSteps: 지원하지 않는 method '${problem.method}'`);
  }
}
