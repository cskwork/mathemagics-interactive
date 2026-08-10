/**
 * 문제 생성기(기초) — 시드 기반 결정적 생성. 브리프 §2-7 / PLAN §3.4.
 *
 * add/sub 용: 자릿수·올림/빌림 포함 여부 파라미터로 문제를 만든다. M2 레슨에서 사용.
 * 시드 기반이므로 동일 시드→동일 문제(테스트 가능).
 *
 * PRNG 는 mulberry32(공개 도메인, ~10줄, 의존성 0). 품질은 암호학 용도가 아니라
 * 교육용 산술 문제 생성에 충분하고 결정적이다.
 */
import type { Method, Op, Problem } from './types.js';

export interface GenerateOptions {
  op: Op;
  /** 피연산자 자릿수. op별 의미가 다름(자체 JSDoc 참조). */
  digits: number;
  /** true 면 올림/빌림이 발생하는 문제를 만든다. div 에선 나머지 유무, mul-sub 에선 90대 유도. */
  carry: boolean;
  method: Method;
  level?: number;
  /** op='est' 일 때 어림 대상 연산. */
  estOf?: 'add' | 'sub' | 'mul' | 'div';
  /** M5 paper-column-add: 더할 피연산자 수(기본 3). */
  operandCount?: number;
  /** divisibility 세트 전개에서 2–11 규칙을 균등하게 배정하는 내부 override. */
  divisor?: number;
}

/** mulberry32 — 시드 → 결정적 32비트 PRNG. [0,1) 실수를 돌려준다. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** [min, max] 구간 정수. */
function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** 자릿수가 정확히 `digits` 인 양수 생성(최상위 자리 0 아님). digits=1 이면 0~9. */
function numberWithDigits(rng: () => number, digits: number): number {
  if (digits <= 1) return randInt(rng, 0, 9);
  const hi = randInt(rng, 1, 9);
  let n = hi;
  for (let i = 1; i < digits; i++) n = n * 10 + randInt(rng, 0, 9);
  return n;
}

function positiveRangeForDigits(digits: number): readonly [number, number] {
  return digits <= 1 ? [1, 9] : [10 ** (digits - 1), 10 ** digits - 1];
}

/** 두 수의 같은 자리 합 중 올림이 발생하는 자리가 하나라도 있으면 true. */
function hasAddCarry(a: number, b: number): boolean {
  let carry = 0;
  while (a > 0 || b > 0 || carry > 0) {
    const sum = (a % 10) + (b % 10) + carry;
    if (sum >= 10) return true;
    carry = 0;
    a = Math.floor(a / 10);
    b = Math.floor(b / 10);
  }
  return false;
}

/** a-b 에서 받아내림(어느 자리에서 a 의 자리값 < b 의 자리값)이 발생하면 true. a >= b 가정. */
function hasSubBorrow(a: number, b: number): boolean {
  let borrow = 0;
  while (a > 0 || b > 0) {
    const da = (a % 10) - borrow;
    const db = b % 10;
    if (da < db) return true;
    borrow = 0;
    a = Math.floor(a / 10);
    b = Math.floor(b / 10);
  }
  return false;
}

/**
 * 시드로 문제 1개 생성. 옵션 조건(자릿수·올림/빌림)이 맞을 때까지 다시 뽑는다(최대 시도 제한).
 * sub 의 경우 항상 `operands[0] >= operands[1]`(음수 결과 방지).
 *
 * op별 digits 해석:
 * - add/sub: 양쪽 같은 자릿수.
 * - mul-running: a=digits자리, b=1자리.  mul-add/sub/factor: 양쪽 2자리.  mul-11: a=digits자리, b=11.
 * - square: a=digits자리, b=a(operands=[a,a]).
 * - div: a(피제수)=digits자리, b(제수)=1자리(1~9).
 * - est: 양쪽 digits자리.
 *
 * @throws 조건을 만족하는 문제를 찾지 못한 경우.
 */
export function generateProblem(seed: number, opts: GenerateOptions): Problem {
  const { op, digits, carry, method, level = 1, estOf, operandCount = 3, divisor: requestedDivisor } = opts;
  const rng = mulberry32(seed);
  const MAX_TRIES = 2000;

  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    // M5 지필 트랙: 열 덧셈(여러 피연산자).
    if (method === 'paper-column-add') {
      const addends: number[] = [];
      for (let i = 0; i < operandCount; i++) addends.push(numberWithDigits(rng, digits));
      return { op: 'add', operands: addends, method, level };
    }
    // M5 지필 트랙: 크리스크로스 곱셈(두 수 모두 digits 자리).
    if (method === 'paper-cross-mult') {
      const a = numberWithDigits(rng, digits);
      const b = numberWithDigits(rng, digits);
      return { op: 'mul', operands: [a, b], method, level };
    }
    // M5 지필 트랙: 지필 제곱근(완전제곱수). digits = 근의 자릿수, 근호 아래 수 = root².
    if (method === 'paper-sqrt') {
      const root = numberWithDigits(rng, digits);
      return { op: 'sqrt', operands: [root * root], method, level };
    }
    // M5 지필 트랙: 모드섬 검산(곱셈 결과 검증).
    if (method === 'mod-sum-check') {
      const a = numberWithDigits(rng, digits);
      const b = numberWithDigits(rng, digits);
      return { op: 'mul', operands: [a, b], method, level };
    }

    if (op === 'add' || op === 'sub') {
      const a = numberWithDigits(rng, digits);
      const b = numberWithDigits(rng, digits);
      const [hi, lo] = a >= b ? [a, b] : [b, a];
      if (op === 'add') {
        const ok = carry ? hasAddCarry(a, b) : !hasAddCarry(a, b);
        if (!ok) continue;
        return { op, operands: [a, b], method, level };
      }
      if (hi === lo) continue;
      const ok = carry ? hasSubBorrow(hi, lo) : !hasSubBorrow(hi, lo);
      if (!ok) continue;
      return { op, operands: [hi, lo], method, level };
    }

    if (op === 'mul') {
      if (method === 'square') {
        const a = numberWithDigits(rng, digits);
        return { op, operands: [a, a], method, level };
      }
      // M6 고급 곱셈(8장).
      if (method === 'square-4digit') {
        const a = numberWithDigits(rng, 4);
        return { op, operands: [a, a], method, level };
      }
      if (method === 'square-5digit') {
        const a = numberWithDigits(rng, 5);
        return { op, operands: [a, a], method, level };
      }
      if (method === 'mul-3x2') {
        const a = numberWithDigits(rng, 3);
        const b = numberWithDigits(rng, 2);
        return { op, operands: [a, b], method, level };
      }
      if (method === 'mul-3x3') {
        // 근접수법이 실제로 유용하도록 같은 100의 배수에서 ±49 안에 두 수를 둔다.
        const base = randInt(rng, 2, 9) * 100;
        const a = base + randInt(rng, -49, 49);
        const b = base + randInt(rng, -49, 49);
        return { op, operands: [a, b], method, level };
      }
      if (method === 'mul-5x5') {
        const a = numberWithDigits(rng, 5);
        const b = numberWithDigits(rng, 5);
        return { op, operands: [a, b], method, level };
      }
      if (method === 'mul-running') {
        // 2×1 / 3×1: a=digits자리, b=1자리(2~9).
        const a = numberWithDigits(rng, digits);
        const b = randInt(rng, 2, 9);
        return { op, operands: [a, b], method, level };
      }
      if (method === 'mul-11') {
        const a = numberWithDigits(rng, Math.max(2, digits));
        return { op, operands: [a, 11], method, level };
      }
      // mul-add/mul-sub/mul-factor: 양쪽 2자리.
      const a = numberWithDigits(rng, 2);
      const b = numberWithDigits(rng, 2);
      // 뺄셈법은 끝자리 8/9 또는 90대가 자연스럽다 — carry 플래그로 90대 유도.
      if (method === 'mul-sub' && carry && attempt < MAX_TRIES / 2) {
        const aUp = randInt(rng, 1, 9) * 10 + randInt(rng, 8, 9);
        return { op, operands: [aUp, b], method, level };
      }
      // 인수분해법은 b 가 1자리 인수로 쪼개지는 2자리수가 좋다.
      if (method === 'mul-factor') {
        const f1 = randInt(rng, 2, 9);
        const f2 = randInt(rng, 2, 9);
        if (f1 * f2 < 10) continue;
        return { op, operands: [numberWithDigits(rng, 2), f1 * f2], method, level };
      }
      return { op, operands: [a, b], method, level };
    }

    if (op === 'div') {
      const [minDividend, maxDividend] = positiveRangeForDigits(digits);

      if (method === 'div-simplify') {
        const factor = randInt(rng, 2, 9);
        const reducedDivisor = randInt(rng, 2, 9);
        const divisor = factor * reducedDivisor;
        const minQuotient = Math.ceil(minDividend / divisor);
        const maxQuotient = Math.floor(maxDividend / divisor);
        if (minQuotient > maxQuotient) continue;
        const quotient = randInt(rng, minQuotient, maxQuotient);
        return { op, operands: [divisor * quotient, divisor], method, level };
      }

      if (method === 'divisibility') {
        const divisor = requestedDivisor ?? randInt(rng, 2, 11);
        if (divisor < 2 || divisor > 11 || !Number.isInteger(divisor)) {
          throw new Error(`generateProblem: divisibility divisor must be an integer from 2 to 11, got ${divisor}`);
        }
        const shouldDivide = rng() < 0.5;
        if (shouldDivide) {
          const minQuotient = Math.ceil(minDividend / divisor);
          const maxQuotient = Math.floor(maxDividend / divisor);
          if (minQuotient > maxQuotient) continue;
          const quotient = randInt(rng, minQuotient, maxQuotient);
          return { op, operands: [divisor * quotient, divisor], method, level };
        }
        const dividend = randInt(rng, minDividend, maxDividend);
        if (dividend % divisor === 0) continue;
        return { op, operands: [dividend, divisor], method, level };
      }

      const divisor = randInt(rng, 2, 9);
      const dividend = randInt(rng, minDividend, maxDividend);
      const hasRemainder = dividend % divisor !== 0;
      if (hasRemainder !== carry) continue; // carry = 나머지 유무
      return { op, operands: [dividend, divisor], method, level };
    }

    // est
    {
      const a = numberWithDigits(rng, digits);
      const b = numberWithDigits(rng, digits);
      if (method === 'est-band') {
        const aFactor = 10 ** (Math.floor(Math.log10(Math.abs(a))) - 1);
        const bFactor = 10 ** (Math.floor(Math.log10(Math.abs(b))) - 1);
        // 중앙 추정이 실제로 첫 수를 올리고 둘째 수를 내리는 연습이 되게 한다.
        if (a % aFactor === 0 || b % bFactor === 0) continue;
      }
      const operands = estOf === 'sub' && a < b ? [b, a] : [a, b];
      return { op: 'est', operands, method, level, estOf: estOf ?? 'add' };
    }
  }
  throw new Error(
    `generateProblem: ${MAX_TRIES}회 시도 안에 조건(op=${op}, digits=${digits}, carry=${carry})을 만족하는 문제를 찾지 못했습니다.`
  );
}

/** 시드 목록으로 여러 문제를 한 번에 생성(레슨 세트 등). 중복 피함. */
export function generateProblems(seed: number, opts: GenerateOptions, count: number): Problem[] {
  const rng = mulberry32(seed);
  const out: Problem[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (out.length < count && guard < count * 50 + 100) {
    guard++;
    // 각 문제마다 파생 시드(연속 소비) — 순서대로 결정적.
    const subSeed = Math.floor(rng() * 0xffffffff);
    const problemOptions =
      opts.method === 'divisibility'
        ? { ...opts, divisor: 2 + ((seed + out.length) % 10) }
        : opts;
    const p = generateProblem(subSeed, problemOptions);
    const key = `${p.operands[0]}_${p.operands[1]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  if (out.length < count) {
    throw new Error(`generateProblems: 요청 ${count}개 중 ${out.length}개만 생성(중복 한계).`);
  }
  return out;
}
