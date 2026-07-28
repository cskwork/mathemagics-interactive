/**
 * 8장 고급 곱셈 스텝 파생 — 순수 함수. book-content-map.md §8 규칙.
 *
 * 공통 뼈대(book-content-map §8 서두): **분배법칙 분해 + "어려운 부분 먼저" + 니모닉(메모리 슬롯) 저장
 * + 자리올림 선예측(5장 어림) 후 앞자리부터 발화**.
 *
 * 다섯 기법(PLAN §3.2 — [3]+[5]+[7] 선행):
 * - square-4digit(§8-2): A²=(A+d)(A−d)+d², d=1000단위. d²≤250,000 → 750,000 임계 자리올림 선예측.
 * - mul-3x2(§8-3~8-5): 2자리 수를 (십+일)로 쪼개 3×1 두 번 + 덧셈(덧셈법 기본; 분해/인수법은 method 선택).
 * - square-5digit(§8-6): (a·1000+b)²=a²·10⁶+2ab·10³+b² 3항. 가운데 항 먼저 → 메모리 슬롯.
 * - mul-3x3(§8-8): 근접수법 (z+a)(z+b)=z(z+a+b)+ab.
 * - mul-5x5(§8-11): (a·1000+b)(c·1000+d)=ac·10⁶+(ad+cb)·10³+bd 4분할.
 *
 * 모든 결과는 독립 산술(a*a, a*b)과 대조해 테스트한다(derive-adv.test.ts).
 * narration 은 규칙 기반 자체 생성문(원문 문장 복제 금지 — PLAN §10-1).
 * 중간값은 memory 스텝(7장 음성 코드 단어 카드) 으로 저장한다.
 */
import type { LocalizedText } from '../content/localized.js';
import type {
  CarryPrediction,
  Mul3x2Layout,
  Mul3x3Layout,
  Mul5x5Layout,
  Problem,
  Square4Layout,
  Square5Layout,
  Step
} from './types.js';
import { deriveGrid, pairOf, writeAnswerLTR } from './derive-internals.js';
import { squareDiagram } from './derive-mul.js';

const L = (ko: string, en?: string): LocalizedText => (en === undefined ? { ko } : { ko, en });

const MILLION = 1_000_000;
const THOUSAND = 1_000;

// ── 레이아웃(순수 데이터) ────────────────────────────────────────────────────────

/**
 * 4자리 제곱 레이아웃. A²=(A+d)(A−d)+d². d=가까운 1000까지 거리.
 * 자리올림 선예측: d≤500 → d²≤250,000. lowPart(product%1e6)+d² 가 1e6 을 넘으면 백만 자리 올림.
 */
export function square4Layout(base: number): Square4Layout {
  const z = Math.round(base / THOUSAND) * THOUSAND;
  const d = Math.abs(z - base);
  const high = base + d;
  const low = base - d;
  const product = high * low;
  const dSquared = d * d;
  const answer = product + dSquared;
  const lowPart = product % MILLION;
  const willCarry = lowPart + dSquared >= MILLION;
  return {
    base,
    d,
    high,
    low,
    product,
    dSquared,
    answer,
    carry: { lowPart, addition: dSquared, willCarry, threshold: 750_000 }
  };
}

/** 3×2 곱셈 레이아웃(덧셈법). b(2자리)를 (십+일)로 쪼개 a 와 곱해 더한다. */
export function mul3x2Layout(a: number, b: number): Mul3x2Layout {
  const tens = Math.floor(b / 10) * 10;
  const units = b % 10;
  const tensProduct = tens * a;
  const unitsProduct = units * a;
  return { a, b, tens, units, tensProduct, unitsProduct, answer: a * b };
}

/**
 * 5자리 제곱 3항 레이아웃. (a·1000+b)²=a²·10⁶+2ab·10³+b².
 * base 를 a(천 단위 이상) 와 b(하위 3자리) 로 분해.
 */
export function square5Layout(base: number): Square5Layout {
  const a = Math.floor(base / THOUSAND);
  const b = base % THOUSAND;
  const aSquared = a * a;
  const twoAB = 2 * a * b;
  const bSquared = b * b;
  return {
    base,
    a,
    b,
    aSquared,
    twoAB,
    bSquared,
    answer: aSquared * MILLION + twoAB * THOUSAND + bSquared
  };
}

/** 3×3 근접수법 레이아웃. (z+a)(z+b)=z(z+a+b)+ab. z=가까운 100의 배수. 편차는 음수 가능. */
export function mul3x3Layout(a: number, b: number): Mul3x3Layout {
  const z = Math.round(a / 100) * 100;
  const da = a - z;
  const db = b - z;
  const mid = a + db; // = b + da = z + da + db
  const zTimesMid = z * mid;
  const deviationProduct = da * db;
  return {
    a,
    b,
    z,
    da,
    db,
    mid,
    zTimesMid,
    deviationProduct,
    answer: zTimesMid + deviationProduct
  };
}

/** 5×5 4분할 레이아웃. (a·1000+b)(c·1000+d)=ac·10⁶+(ad+cb)·10³+bd. */
export function mul5x5Layout(a: number, b: number, c: number, d: number): Mul5x5Layout {
  const ac = a * c;
  const ad = a * d;
  const cb = c * b;
  const bd = b * d;
  const middle = ad + cb;
  return { a, b, c, d, ac, ad, cb, bd, middle, answer: ac * MILLION + middle * THOUSAND + bd };
}

/** 숫자를 음성 코드용 3자리 문자열로(앞 0 포함). MemorySlot 표시용. */
function digits3(n: number): string {
  return String(n).padStart(3, '0').slice(-3);
}

// ── 자리올림 선예측 헬퍼 ──────────────────────────────────────────────────────────

/** carry prediction 이 "올림 확정"인지 아닌지 narration. */
function carryNarration(carry: CarryPrediction, place: string): LocalizedText {
  return carry.willCarry
    ? L(
        `하위 합이 ${carry.lowPart.toLocaleString()} + ${carry.addition.toLocaleString()} ≥ 1,000,000 → ${place} 자리에 올림. ${place} 자리를 먼저 말해요.`,
        `Lower part ${carry.lowPart.toLocaleString()} + ${carry.addition.toLocaleString()} ≥ 1,000,000 → carry into the ${place} place. Say ${place} first.`
      )
    : L(
        `하위 합이 ${carry.lowPart.toLocaleString()} + ${carry.addition.toLocaleString()} < ${carry.threshold.toLocaleString()}(기준) → ${place} 자리 확정. 먼저 말해요.`,
        `Lower sum stays under threshold → ${place} place is fixed. Say it first.`
      );
}

// ── 메인 디스패치 ─────────────────────────────────────────────────────────────

/** 8장 고급 곱셈 문제 → 스텝. method 로 기법을 나눈다. */
export function deriveAdvSteps(problem: Problem): Step[] {
  const m = problem.method;
  if (m === 'square-4digit') {
    const [a] = pairOf(problem);
    return square4Steps(a, deriveGrid(problem));
  }
  if (m === 'mul-3x2') {
    const [a, b] = pairOf(problem);
    return mul3x2Steps(a, b, deriveGrid(problem));
  }
  if (m === 'square-5digit') {
    const [a] = pairOf(problem);
    return square5Steps(a, deriveGrid(problem));
  }
  if (m === 'mul-3x3') {
    const [a, b] = pairOf(problem);
    return mul3x3Steps(a, b, deriveGrid(problem));
  }
  if (m === 'mul-5x5') {
    const a0 = problem.operands[0] ?? 0;
    const b0 = problem.operands[1] ?? 0;
    return mul5x5Steps(a0, b0, deriveGrid(problem));
  }
  throw new Error(`deriveAdvSteps: 지원하지 않는 method '${m}'`);
}

/** 4자리 제곱: 1000 단위 ±d + 자리올림 선예측 + 중간값 메모리 슬롯. */
function square4Steps(base: number, grid: import('./types.js').Grid): Step[] {
  const lay = square4Layout(base);
  const diag = squareDiagram(lay.d); // d² 안의 작은 제곱(재귀, M4 재사용)
  const steps: Step[] = [
    { t: 'highlight', narration: L(`${base}² 을(를) 가까운 ${lay.high}까지 ${lay.d}만큼 올리고 내려요.`) },
    { t: 'branch', from: base, to: lay.high, label: `+${lay.d}` },
    { t: 'branch', from: base, to: lay.low, label: `−${lay.d}` },
    { t: 'highlight', narration: L(`${lay.high} × ${lay.low} = ${lay.product.toLocaleString()}`) }
  ];
  // 중간값(천 단위 3자리) 을 음성 코드 단어 카드로 저장(7장).
  const mid3 = lay.product % MILLION;
  const highPart = Math.floor(lay.product / MILLION);
  steps.push({
    t: 'memory',
    action: 'store',
    slot: 'high',
    value: mid3,
    digits: digits3(mid3),
    narration: L(`앞자리 ${highPart} million을(를) 먼저 말하고, ${mid3}은(는) 단어 카드에 저장해요.`)
  });
  steps.push({
    t: 'highlight',
    narration: L(`${lay.d}² = ${lay.dSquared.toLocaleString()}`)
  });
  if (diag) {
    steps.push({
      t: 'highlight',
      narration: L(`(d² 안의 작은 제곱: ${lay.d}² 은(는) ±d 기법으로 풀어요)`)
    });
  }
  // 자리올림 선예측(5장 어림이 부품).
  steps.push({ t: 'highlight', narration: carryNarration(lay.carry, 'million') });
  steps.push({ t: 'memory', action: 'recall', slot: 'high', value: mid3, digits: digits3(mid3) });
  steps.push({
    t: 'highlight',
    narration: L(`${mid3.toLocaleString()} + ${lay.dSquared.toLocaleString()} = ${(mid3 + lay.dSquared).toLocaleString()}`)
  });
  steps.push({ t: 'running', total: lay.answer });
  steps.push(...writeAnswerLTR(lay.answer, grid));
  return steps;
}

/** 3×2 곱셈(덧셈법): b 를 (십+일)로 쪼개 a 에 곱해 더한다. */
function mul3x2Steps(a: number, b: number, grid: import('./types.js').Grid): Step[] {
  const lay = mul3x2Layout(a, b);
  const steps: Step[] = [
    { t: 'highlight', narration: L(`${b}를 ${lay.tens} + ${lay.units}로 쪼개 ${a}에 곱해요.`) },
    { t: 'highlight', narration: L(`${lay.tens} × ${a} = ${lay.tensProduct.toLocaleString()}`) },
    { t: 'running', total: lay.tensProduct, delta: lay.tensProduct }
  ];
  steps.push({
    t: 'memory',
    action: 'store',
    slot: 'tens',
    value: lay.tensProduct,
    narration: L(`${lay.tensProduct.toLocaleString()}을(를) 카드에 저장.`)
  });
  steps.push({ t: 'highlight', narration: L(`${lay.units} × ${a} = ${lay.unitsProduct.toLocaleString()}`) });
  steps.push({ t: 'memory', action: 'recall', slot: 'tens', value: lay.tensProduct });
  steps.push({
    t: 'highlight',
    narration: L(`${lay.tensProduct.toLocaleString()} + ${lay.unitsProduct.toLocaleString()} = ${lay.answer.toLocaleString()}`)
  });
  steps.push({ t: 'running', total: lay.answer });
  steps.push(...writeAnswerLTR(lay.answer, grid));
  return steps;
}

/** 5자리 제곱: 3항(a²·10⁶ + 2ab·10³ + b²). 가운데 항 먼저 → 메모리 슬롯. */
function square5Steps(base: number, grid: import('./types.js').Grid): Step[] {
  const lay = square5Layout(base);
  const steps: Step[] = [
    {
      t: 'highlight',
      narration: L(`${base} = ${lay.a}천 + ${lay.b} 로 쪼개요. 세 항으로 분해해요.`)
    },
    { t: 'highlight', narration: L(`가운데 항(가장 어려움)부터: 2 × ${lay.a} × ${lay.b} = ${lay.twoAB.toLocaleString()}`) }
  ];
  steps.push({
    t: 'memory',
    action: 'store',
    slot: 'mid',
    value: lay.twoAB,
    digits: digits3(lay.twoAB % THOUSAND),
    narration: L(`${lay.twoAB.toLocaleString()}을(를) 카드에 저장.`)
  });
  steps.push({ t: 'highlight', narration: L(`${lay.a}² = ${lay.aSquared.toLocaleString()} → 백만 자리.`) });
  steps.push({ t: 'memory', action: 'recall', slot: 'mid', value: lay.twoAB });
  steps.push({ t: 'highlight', narration: L(`${lay.b}² = ${lay.bSquared.toLocaleString()}`) });
  steps.push({
    t: 'highlight',
    narration: L(
      `${lay.aSquared.toLocaleString()}·10⁶ + ${lay.twoAB.toLocaleString()}·10³ + ${lay.bSquared.toLocaleString()} = ${lay.answer.toLocaleString()}`
    )
  });
  steps.push({ t: 'running', total: lay.answer });
  steps.push(...writeAnswerLTR(lay.answer, grid));
  return steps;
}

/** 3×3 근접수법: (z+a)(z+b) = z(z+a+b) + ab. */
function mul3x3Steps(a: number, b: number, grid: import('./types.js').Grid): Step[] {
  const lay = mul3x3Layout(a, b);
  const steps: Step[] = [
    {
      t: 'highlight',
      narration: L(`${a}와(과) ${b}의 기준수 z = ${lay.z}. 편차 ${lay.da}, ${lay.db}.`)
    },
    { t: 'highlight', narration: L(`${lay.z} × (${lay.mid}) = ${lay.zTimesMid.toLocaleString()}`) },
    { t: 'running', total: lay.zTimesMid, delta: lay.zTimesMid }
  ];
  steps.push({
    t: 'memory',
    action: 'store',
    slot: 'base',
    value: lay.zTimesMid,
    narration: L(`${lay.zTimesMid.toLocaleString()}을(를) 카드에 저장.`)
  });
  steps.push({
    t: 'highlight',
    narration: L(`편차끼리 곱: ${lay.da} × ${lay.db} = ${lay.deviationProduct}`)
  });
  steps.push({ t: 'memory', action: 'recall', slot: 'base', value: lay.zTimesMid });
  steps.push({
    t: 'highlight',
    narration: L(`${lay.zTimesMid.toLocaleString()} + ${lay.deviationProduct} = ${lay.answer.toLocaleString()}`)
  });
  steps.push({ t: 'running', total: lay.answer });
  steps.push(...writeAnswerLTR(lay.answer, grid));
  return steps;
}

/** 5×5 4분할: (a·1000+b)(c·1000+d)=ac·10⁶+(ad+cb)·10³+bd. 어려운 3×2 두 개 → 슬롯 2개. */
function mul5x5Steps(n: number, m: number, grid: import('./types.js').Grid): Step[] {
  const a = Math.floor(n / THOUSAND);
  const b = n % THOUSAND;
  const c = Math.floor(m / THOUSAND);
  const d = m % THOUSAND;
  const lay = mul5x5Layout(a, b, c, d);
  const steps: Step[] = [
    {
      t: 'highlight',
      narration: L(`${n} = ${a}천+${b}, ${m} = ${c}천+${d} 로 네 덩어리로 쪼개요.`)
    },
    { t: 'highlight', narration: L(`어려운 3×2 먼저: ${a} × ${d} = ${lay.ad.toLocaleString()}`) },
    { t: 'memory', action: 'store', slot: 'ad', value: lay.ad, digits: digits3(lay.ad) },
    { t: 'highlight', narration: L(`다른 3×2: ${c} × ${b} = ${lay.cb.toLocaleString()}`) },
    { t: 'memory', action: 'store', slot: 'cb', value: lay.cb, digits: digits3(lay.cb) },
    {
      t: 'highlight',
      narration: L(`천 단위 항 = ${lay.ad.toLocaleString()} + ${lay.cb.toLocaleString()} = ${lay.middle.toLocaleString()}`)
    },
    { t: 'highlight', narration: L(`2×2: ${a} × ${c} = ${lay.ac.toLocaleString()} → 십억 자리.`) },
    { t: 'highlight', narration: L(`3×3: ${b} × ${d} = ${lay.bd.toLocaleString()}`) },
    {
      t: 'highlight',
      narration: L(
        `${lay.ac.toLocaleString()}·10⁶ + ${lay.middle.toLocaleString()}·10³ + ${lay.bd.toLocaleString()} = ${lay.answer.toLocaleString()}`
      )
    },
    { t: 'running', total: lay.answer },
    { t: 'memory', action: 'recall', slot: 'ad', value: lay.ad },
    { t: 'memory', action: 'recall', slot: 'cb', value: lay.cb }
  ];
  steps.push(...writeAnswerLTR(lay.answer, grid));
  return steps;
}
