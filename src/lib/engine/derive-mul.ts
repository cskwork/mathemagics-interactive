/**
 * 곱셈 + 제곱 스텝 파생 — 순수 함수. book-content-map.md §2(2장)·§3(3장) 규칙.
 *
 * 기법(method) 선택 자체가 학습 내용(PLAN §3.2). 다섯 갈래를 같은 `deriveSteps` 인터페이스로:
 * - mul-running(2×1·3×1): 피연산자를 자리별로 쪼개 좌→우로 부분곱 + 누계(running total).
 * - mul-add(2×2 덧셈법): 한 수를 (십+일)로 쪼개 2×1 두 번 + 덧셈.
 * - mul-sub(2×2 뺄셈법): 한 수를 (올린 값 − 초과)로 취해 곱하고 초과분 곱을 뺀다.
 * - mul-factor(2×2 인수분해법): 한 수를 1자리 인수 둘로 분해해 연쇄 곱.
 * - mul-11(11 곱셈): 두 자릿수 합을 사이에 끼워 넣고 올림 처리.
 * - square(2/3자리 제곱): A²=(A+d)(A−d)+d², X-다이어그램. d² 가 2자리 제곱이면 **재귀 중첩**.
 *
 * 모든 결과는 독립 산술(a*b / a*a)과 대조해 테스트한다. narration 은 규칙 기반 자체 생성문
 * (원문 문장 복제 금지 — PLAN §10-1).
 */
import type { LocalizedText } from '../content/localized.js';
import type {
  Grid,
  PartialProduct,
  Problem,
  SquareDiagram,
  Step
} from './types.js';
import { deriveGrid, writeAnswerLTR } from './derive-internals.js';

const L = (ko: string, en?: string): LocalizedText => (en === undefined ? { ko } : { ko, en });

// ── 부분곱(롤링 카운터용 순수 데이터) ──────────────────────────────────────────

/**
 * 기법별 부분곱 목록 생성(RollingCounter 컴포넌트가 소비). 순수 함수.
 * mul-running/mul-add/mul-sub/mul-factor 만 의미있는 부분곱을 낸다(나머지는 빈 배열).
 */
export function partialProducts(problem: Problem): PartialProduct[] {
  const [a, b] = problem.operands;
  const m = problem.method;
  if (m === 'mul-running') return decomposePlaceProducts(a, b);
  if (m === 'mul-add') return additionMethodParts(a, b);
  if (m === 'mul-sub') return subtractionMethodParts(a, b);
  if (m === 'mul-factor') return factoringMethodParts(a, b);
  return [];
}

/** 2×1/3×1: a 를 자리별로 쪼개 b 와 곱. 큰 자리부터(좌→우). */
function decomposePlaceProducts(a: number, b: number): PartialProduct[] {
  const places = placesOf(a);
  const out: PartialProduct[] = [];
  let running = 0;
  for (const { value, place } of places) {
    if (value === 0) continue;
    const chunk = value * 10 ** place;
    const product = chunk * b;
    running += product;
    out.push({ factor: chunk, unit: b, product, sign: '+', runningTotal: running });
  }
  return out;
}

/** 덧셈법: b 를 (십+일)로 쪼개 a 와 곱. */
function additionMethodParts(a: number, b: number): PartialProduct[] {
  const places = placesOf(b);
  const out: PartialProduct[] = [];
  let running = 0;
  for (const { value, place } of places) {
    if (value === 0) continue;
    const chunk = value * 10 ** place;
    const product = chunk * a;
    running += product;
    out.push({ factor: chunk, unit: a, product, sign: '+', runningTotal: running });
  }
  return out;
}

/** 뺄셈법: a 를 가까운 10의 배수로 올려 곱하고 초과분 곱을 뺀다. */
function subtractionMethodParts(a: number, b: number): PartialProduct[] {
  const { base, excess } = roundUpTo(a);
  const hiProduct = base * b;
  const exProduct = excess * b;
  return [
    { factor: base, unit: b, product: hiProduct, sign: '+', runningTotal: hiProduct },
    { factor: excess, unit: b, product: exProduct, sign: '-', runningTotal: hiProduct - exProduct }
  ];
}

/** 인수분해법: b 를 두 1자리 인수로 분해해 연쇄 곱. */
function factoringMethodParts(a: number, b: number): PartialProduct[] {
  const factors = factorIntoSingleDigits(b);
  if (factors.length < 2) return [];
  const out: PartialProduct[] = [];
  let cur = a;
  for (const f of factors) {
    const prev = cur;
    cur = cur * f;
    out.push({ factor: f, unit: prev, product: cur, sign: '+', runningTotal: cur });
  }
  return out;
}

// ── 제곱 ±d 다이어그램(재귀) ───────────────────────────────────────────────────

/**
 * 제곱의 ±d 분기 다이어그램 생성(재귀 중첩 지원). 순수 함수. book-content-map §2-3/§3-5.
 * A² = (A+d)(A−d) + d². d 를 가까운 10/100 의 배수까지의 거리로 잡는다.
 * d² 가 다시 11~96 범위(2자리 제곱이 의미있는 범위)면 nested 다이어그램을 재귀 생성.
 * (3자리 제곱의 d² 가 2자리 제곱이 되는 것이 재귀 중첩의 핵심 구조 — §3-5 예: 636² 의 d=36.)
 */
export function squareDiagram(base: number): SquareDiagram {
  const target = nearestRoundingBase(base);
  const ad = Math.abs(target - base);
  const high = base + ad;
  const low = base - ad;
  const product = high * low;
  const dSquared = ad * ad;
  const answer = product + dSquared;
  const nested = dSquared >= 100 && ad >= 11 && ad <= 96 ? squareDiagram(ad) : undefined;
  // exactOptionalPropertyTypes: undefined 를 optional 에 직접 대입 불가 → 조건부 spread.
  return nested === undefined
    ? { base, d: ad, high, low, product, dSquared, answer }
    : { base, d: ad, high, low, product, dSquared, nested, answer };
}

/** base 에 가장 가까운 10(또는 100)의 배수. 2자리면 10 단위, 3자리면 100 단위. */
function nearestRoundingBase(base: number): number {
  if (base >= 100) return Math.round(base / 100) * 100;
  return Math.round(base / 10) * 10;
}

// ── 메인 디스패치 ─────────────────────────────────────────────────────────────

/** 곱셈/제곱 문제 → 스텝. method 로 기법을 나눈다. */
export function deriveMulSteps(problem: Problem): Step[] {
  const [a, b] = problem.operands;
  const grid = deriveGrid(problem);
  switch (problem.method) {
    case 'mul-running':
      return runningTotalSteps(a, b, grid, L(`${a} × ${b}을(를) 자리별로 쪼개 큰 자리부터 곱해요.`));
    case 'mul-add':
      return additionMethodSteps(a, b, grid);
    case 'mul-sub':
      return subtractionMethodSteps(a, b, grid);
    case 'mul-factor':
      return factoringMethodSteps(a, b, grid);
    case 'mul-11':
      return elevenRuleSteps(a, b, grid);
    case 'square':
      return squareSteps(a, grid);
    default:
      throw new Error(`deriveMulSteps: 지원하지 않는 method '${problem.method}'`);
  }
}

/** 부분곱 + 누계(running) 스텝 + 답 좌→우 write. */
function runningTotalSteps(a: number, b: number, grid: Grid, intro: LocalizedText): Step[] {
  const steps: Step[] = [{ t: 'highlight', narration: intro }];
  for (const p of decomposePlaceProducts(a, b)) {
    steps.push({ t: 'highlight', narration: L(`${p.factor} × ${p.unit} = ${p.product}`) });
    steps.push({ t: 'running', total: p.runningTotal, delta: p.product });
  }
  const answer = a * b;
  steps.push({ t: 'highlight', narration: L(`누계가 ${answer}이(가) 돼요. 답을 앞자리부터 말해요.`) });
  steps.push(...writeAnswerLTR(answer, grid));
  return steps;
}

function additionMethodSteps(a: number, b: number, grid: Grid): Step[] {
  const steps: Step[] = [
    { t: 'highlight', narration: L(`${b}를 십의 자리와 일의 자리로 쪼개 ${a}에 곱해요.`) }
  ];
  for (const p of additionMethodParts(a, b)) {
    steps.push({ t: 'highlight', narration: L(`${p.factor} × ${p.unit} = ${p.product}`) });
    steps.push({ t: 'running', total: p.runningTotal, delta: p.product });
  }
  const answer = a * b;
  steps.push({ t: 'highlight', narration: L(`모두 합쳐 ${answer}. 앞자리부터 써요.`) });
  steps.push(...writeAnswerLTR(answer, grid));
  return steps;
}

function subtractionMethodSteps(a: number, b: number, grid: Grid): Step[] {
  const { base, excess } = roundUpTo(a);
  const steps: Step[] = [
    { t: 'highlight', narration: L(`${a}를 ${base} − ${excess}로 보고 곱해요.`) }
  ];
  for (const p of subtractionMethodParts(a, b)) {
    const verb = p.sign === '+' ? '더하고' : '빼고';
    steps.push({
      t: 'highlight',
      narration: L(`${p.factor} × ${p.unit} = ${p.product}을(를) ${verb} → ${p.runningTotal}`)
    });
    steps.push({ t: 'running', total: p.runningTotal, delta: p.product });
  }
  const answer = a * b;
  steps.push({ t: 'highlight', narration: L(`답 ${answer}. 앞자리부터 써요.`) });
  steps.push(...writeAnswerLTR(answer, grid));
  return steps;
}

function factoringMethodSteps(a: number, b: number, grid: Grid): Step[] {
  const factors = factorIntoSingleDigits(b);
  const steps: Step[] = [
    { t: 'highlight', narration: L(`${b}를 ${factors.join(' × ')}로 인수분해해 ${a}부터 차례로 곱해요.`) }
  ];
  for (const p of factoringMethodParts(a, b)) {
    steps.push({ t: 'highlight', narration: L(`${p.unit} × ${p.factor} = ${p.product}`) });
    steps.push({ t: 'running', total: p.runningTotal, delta: p.product });
  }
  const answer = a * b;
  steps.push({ t: 'highlight', narration: L(`답 ${answer}. 앞자리부터 써요.`) });
  steps.push(...writeAnswerLTR(answer, grid));
  return steps;
}

/** 11 곱셈: 두 자릿수 합을 사이에 끼워 넣는다. 올림 처리 포함. */
function elevenRuleSteps(a: number, b: number, grid: Grid): Step[] {
  const answer = a * b;
  const steps: Step[] = [
    { t: 'highlight', narration: L(`${a}의 두 숫자 사이에 두 자릿수의 합을 끼워 넣어요.`) }
  ];
  const dStr = String(a);
  const d1 = Number(dStr[0]);
  const d2 = Number(dStr[1]);
  const sum = d1 + d2;
  steps.push({ t: 'highlight', narration: L(`${d1} + ${d2} = ${sum}`) });
  if (sum >= 10) {
    steps.push({ t: 'highlight', narration: L(`합이 ${sum}(이)라 10이 넘어요. 앞자리에 1을 올려요.`) });
  }
  steps.push({ t: 'highlight', narration: L(`답 ${answer}. 앞자리부터 써요.`) });
  steps.push(...writeAnswerLTR(answer, grid));
  return steps;
}

/** 제곱(±d): X-다이어그램 분기(branch) 스텝 + d² + 답. */
function squareSteps(base: number, grid: Grid): Step[] {
  const diag = squareDiagram(base);
  const steps: Step[] = [
    {
      t: 'highlight',
      narration: L(`${base}² 을(를) 가까운 ${diag.high}까지 ${diag.d}만큼 올리고 같은 만큼 내려요.`)
    },
    // ±d 분기(branch 스텝) — XDiagram 컴포넌트가 소비.
    { t: 'branch', from: base, to: diag.high, label: `+${diag.d}`, narration: L(`올린 수: ${diag.high}`) },
    { t: 'branch', from: base, to: diag.low, label: `−${diag.d}`, narration: L(`내린 수: ${diag.low}`) },
    { t: 'highlight', narration: L(`${diag.high} × ${diag.low} = ${diag.product}`) },
    {
      t: 'highlight',
      narration: diag.nested
        ? L(`${diag.d}² = ${diag.dSquared} (이 안에서 다시 제곱 기법!)`)
        : L(`${diag.d}² = ${diag.dSquared}`)
    },
    { t: 'highlight', narration: L(`${diag.product} + ${diag.dSquared} = ${diag.answer}`) },
    { t: 'running', total: diag.answer }
  ];
  steps.push(...writeAnswerLTR(diag.answer, grid));
  return steps;
}

// ── 보조 순수 함수 ─────────────────────────────────────────────────────────────

interface PlaceDigit {
  value: number;
  place: number;
}

/** 숫자를 자릿값으로 분해. 큰 자리부터 반환. 예: 326 → [{3,2},{2,1},{6,0}]. */
function placesOf(n: number): PlaceDigit[] {
  const out: PlaceDigit[] = [];
  const s = String(n);
  for (let i = 0; i < s.length; i++) {
    out.push({ value: Number(s[i]), place: s.length - 1 - i });
  }
  return out;
}

/** a 를 가까운 10(또는 100)의 배수로 올린다. {base, excess} — a = base − excess. */
function roundUpTo(a: number): { base: number; excess: number } {
  if (a >= 100) {
    const base = Math.ceil(a / 100) * 100;
    return { base, excess: base - a };
  }
  const base = Math.ceil(a / 10) * 10;
  return { base, excess: base - a };
}

/** n 을 1자리 인수들(또는 11)로 분해. 분해 불가면 빈 배열. */
function factorIntoSingleDigits(n: number): number[] {
  if (n === 11) return [11];
  for (let f = 9; f >= 2; f--) {
    if (n % f === 0) {
      const other = n / f;
      if (other <= 9) return [f, other];
      const sub = factorIntoSingleDigits(other);
      if (sub.length > 0) return [f, ...sub];
    }
  }
  return [];
}

// writeAnswerLTR 내부에서 colAtPlace/CellId 를 쓰지만 이 파일에선 grid 만 넘기면 됨.
