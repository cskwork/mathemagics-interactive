/**
 * 나눗셈 스텝 파생 + 브래킷 레이아웃 — 순수 함수. book-content-map.md §4(4장) 규칙.
 *
 * 1자리 나눗셈(div-1): 긴나눗셈을 머릿속에서 좌→우로. 답(몫)이 앞자리부터 확정.
 * 각 자리에서 "제수가 이 묶음에 몇 번?" → 곱해서 빼고 다음 자리 숫자를 내려받는다.
 * 나머지를 포함한 답(예: "25와 4/7").
 *
 * DivisionBracket 컴포넌트가 {@link deriveDivisionLayout} 결과를 SVG 로 렌더(좌 괄호형,
 * 몫 digit-reveal). 답 칸 write 스텝은 ColumnGrid 용이지만 div 는 브래킷이 주 무대.
 *
 * 모든 결과는 독립 산술(floor(a/b), a mod b)과 대조해 테스트한다.
 */
import type { LocalizedText } from '../content/localized.js';
import type { DivisionDigit, DivisionLayout, Problem, Step } from './types.js';
import { colAtPlace, deriveGrid, pairOf } from './derive-internals.js';

const L = (ko: string, en?: string): LocalizedText => (en === undefined ? { ko } : { ko, en });

/**
 * 나눗셈 브래킷 레이아웃 생성. 순수 함수. DivisionBracket 컴포넌트가 소비.
 * 피제수 ÷ 제수 → 몫(좌→우 한 자리씩) + 나머지.
 */
export function deriveDivisionLayout(problem: Problem): DivisionLayout {
  const [dividend, divisor] = pairOf(problem);
  if (divisor === 0) throw new Error('deriveDivisionLayout: divisor is 0');
  const quotient = Math.floor(dividend / divisor);
  const remainder = dividend - quotient * divisor;
  const digits = longDivisionDigits(dividend, divisor);
  if (problem.method === 'div-simplify') {
    const factor = simplificationFactor(dividend, divisor);
    return {
      dividend,
      divisor,
      quotient,
      remainder,
      digits,
      simplification: { factor, dividend: dividend / factor, divisor: divisor / factor }
    };
  }
  if (problem.method === 'divisibility') {
    return {
      dividend,
      divisor,
      quotient,
      remainder,
      digits: [],
      divisibility: divisibilityDecision(dividend, divisor)
    };
  }
  return { dividend, divisor, quotient, remainder, digits };
}

function simplificationFactor(dividend: number, divisor: number): number {
  for (let factor = 9; factor >= 2; factor--) {
    if (dividend % factor === 0 && divisor % factor === 0 && divisor / factor >= 2) return factor;
  }
  throw new Error(`deriveDivisionLayout: ${dividend} ÷ ${divisor} has no useful single-digit simplification factor`);
}

function digitSum(n: number): number {
  return String(Math.abs(n)).split('').reduce((sum, digit) => sum + Number(digit), 0);
}

function alternatingSum(n: number): number {
  return String(Math.abs(n)).split('').reduce((sum, digit, index) => sum + (index % 2 === 0 ? 1 : -1) * Number(digit), 0);
}

function divisibilityDecision(dividend: number, divisor: number): NonNullable<DivisionLayout['divisibility']> {
  const divides = dividend % divisor === 0;
  const last = Math.abs(dividend) % 10;
  const lastTwo = Math.abs(dividend) % 100;
  const lastThree = Math.abs(dividend) % 1000;
  const sum = digitSum(dividend);
  const alt = alternatingSum(dividend);
  const result = divides ? L('나누어 떨어져요.', 'It is divisible.') : L('나누어 떨어지지 않아요.', 'It is not divisible.');
  switch (divisor) {
    case 2:
      return { divides, rule: L('끝자리가 짝수인지 봐요.', 'Check whether the last digit is even.'), evidence: L(`끝자리 ${last}. ${result.ko}`, `Last digit ${last}. ${result.en}`) };
    case 3:
      return { divides, rule: L('자릿수 합이 3의 배수인지 봐요.', 'Check whether the digit sum is a multiple of 3.'), evidence: L(`자릿수 합 ${sum}. ${result.ko}`, `Digit sum ${sum}. ${result.en}`) };
    case 4:
      return { divides, rule: L('끝 두 자리가 4의 배수인지 봐요.', 'Check whether the last two digits form a multiple of 4.'), evidence: L(`끝 두 자리 ${lastTwo}. ${result.ko}`, `Last two digits ${lastTwo}. ${result.en}`) };
    case 5:
      return { divides, rule: L('끝자리가 0 또는 5인지 봐요.', 'Check whether the last digit is 0 or 5.'), evidence: L(`끝자리 ${last}. ${result.ko}`, `Last digit ${last}. ${result.en}`) };
    case 6:
      return { divides, rule: L('2와 3의 판정을 모두 통과해야 해요.', 'It must pass both the rules for 2 and 3.'), evidence: L(`끝자리 ${last}, 자릿수 합 ${sum}. ${result.ko}`, `Last digit ${last}, digit sum ${sum}. ${result.en}`) };
    case 7: {
      const reduced = Math.floor(Math.abs(dividend) / 10) - 2 * last;
      return { divides, rule: L('끝자리의 2배를 나머지 수에서 빼요.', 'Subtract twice the last digit from the remaining leading digits.'), evidence: L(`${Math.floor(Math.abs(dividend) / 10)} − 2×${last} = ${reduced}. ${result.ko}`, `${Math.floor(Math.abs(dividend) / 10)} − 2×${last} = ${reduced}. ${result.en}`) };
    }
    case 8:
      return { divides, rule: L('끝 세 자리가 8의 배수인지 봐요.', 'Check whether the last three digits form a multiple of 8.'), evidence: L(`끝 세 자리 ${lastThree}. ${result.ko}`, `Last three digits ${lastThree}. ${result.en}`) };
    case 9:
      return { divides, rule: L('자릿수 합이 9의 배수인지 봐요.', 'Check whether the digit sum is a multiple of 9.'), evidence: L(`자릿수 합 ${sum}. ${result.ko}`, `Digit sum ${sum}. ${result.en}`) };
    case 10:
      return { divides, rule: L('끝자리가 0인지 봐요.', 'Check whether the last digit is 0.'), evidence: L(`끝자리 ${last}. ${result.ko}`, `Last digit ${last}. ${result.en}`) };
    case 11:
      return { divides, rule: L('교대로 더하고 뺄 값이 11의 배수인지 봐요.', 'Check whether the alternating digit sum is a multiple of 11.'), evidence: L(`교대합 ${alt}. ${result.ko}`, `Alternating sum ${alt}. ${result.en}`) };
    default:
      throw new Error(`deriveDivisionLayout: divisibility supports divisors 2–11, got ${divisor}`);
  }
}

/** 긴나눗셈을 한 자리씩 좌→우로 수행한 기록. 예: 179÷7 → [{2,14,3,17},{5,35,4,39}]. */
function longDivisionDigits(dividend: number, divisor: number): DivisionDigit[] {
  const digits: DivisionDigit[] = [];
  const ds = String(dividend);
  let working = 0;
  let started = false; // 선행 0(몫이 시작되기 전 빈 자리)은 스킵.
  for (let i = 0; i < ds.length; i++) {
    const d = Number(ds[i]);
    working = working * 10 + d;
    const q = Math.floor(working / divisor);
    if (q === 0 && !started) {
      // 아직 몫이 시작 안 됨 — 이 자리는 몫이 비어있음(선행 0).
      working = working; // remainder 미확정, 다음 자리로 넘김.
      continue;
    }
    started = true;
    const product = q * divisor;
    const remainder = working - product;
    digits.push({ digit: q, product, remainder, broughtDown: working });
    working = remainder;
  }
  return digits;
}

/** 나눗셈 문제 → 스텝(브래킷 digit-reveal + narration). */
export function deriveDivSteps(problem: Problem): Step[] {
  const layout = deriveDivisionLayout(problem);

  if (layout.divisibility) {
    return [
      { t: 'highlight', narration: layout.divisibility.rule },
      {
        t: 'choice',
        value: layout.divisibility.divides,
        expect: true,
        narration: L(
          `${layout.dividend}은(는) ${layout.divisor}(으)로 나누어 떨어질까요?`,
          `Is ${layout.dividend} divisible by ${layout.divisor}?`
        ),
        explanation: layout.divisibility.evidence
      },
      { t: 'highlight', narration: layout.divisibility.evidence }
    ];
  }

  if (layout.simplification) {
    const simplified = layout.simplification;
    const grid = deriveGrid(problem);
    const answer = String(layout.quotient);
    const writes: Step[] = Array.from(answer, (digit, index) => ({
      t: 'write' as const,
      cell: `quotient.${colAtPlace(grid, answer.length - 1 - index)}`,
      value: digit,
      expect: true as const
    }));
    return [
      { t: 'highlight', narration: L(`양쪽을 ${simplified.factor}(으)로 나눠 더 쉬운 동치식으로 바꿔요.`, `Divide both sides by ${simplified.factor} to make an equivalent easier division.`) },
      { t: 'branch', from: layout.dividend, to: simplified.dividend, label: `÷${simplified.factor}` },
      { t: 'branch', from: layout.divisor, to: simplified.divisor, label: `÷${simplified.factor}` },
      { t: 'highlight', narration: L(`${simplified.dividend} ÷ ${simplified.divisor} = ?`, `${simplified.dividend} ÷ ${simplified.divisor} = ?`) },
      ...writes,
      { t: 'highlight', narration: L(`${simplified.dividend} ÷ ${simplified.divisor} = ${layout.quotient}`, `${simplified.dividend} ÷ ${simplified.divisor} = ${layout.quotient}`) }
    ];
  }

  const grid = deriveGrid(problem);
  const steps: Step[] = [
    {
      t: 'highlight',
      narration: L(
        `${layout.dividend} ÷ ${layout.divisor}. 큰 자리(왼쪽)부터 한 자리씩 정해요.`,
        `${layout.dividend} ÷ ${layout.divisor}. Fix one quotient digit at a time from the left.`
      )
    }
  ];
  for (let i = 0; i < layout.digits.length; i++) {
    const dg = layout.digits[i]!;
    if (i > 0) {
      const previousRemainder = layout.digits[i - 1]!.remainder;
      const broughtDigit = dg.broughtDown - previousRemainder * 10;
      steps.push({
        t: 'highlight',
        narration: L(
          `나머지 ${previousRemainder} 옆에 다음 숫자 ${broughtDigit}을(를) 내려 ${dg.broughtDown}을(를) 만들어요.`,
          `Bring down ${broughtDigit} beside remainder ${previousRemainder} to make ${dg.broughtDown}.`
        )
      });
    }
    steps.push({
      t: 'highlight',
      narration: L(
        `${layout.divisor}이(가) ${dg.broughtDown}에 ${dg.digit}번 → ${dg.digit} × ${layout.divisor} = ${dg.product}`,
        `${layout.divisor} fits into ${dg.broughtDown} ${dg.digit} times → ${dg.digit} × ${layout.divisor} = ${dg.product}`
      )
    });
    steps.push({
      t: 'write',
      cell: `quotient.${colAtPlace(grid, layout.digits.length - 1 - i)}`,
      value: String(dg.digit),
      expect: true,
      narration: L(`${dg.broughtDown} − ${dg.product} = ${dg.remainder}`, `${dg.broughtDown} − ${dg.product} = ${dg.remainder}`)
    });
  }
  if (layout.remainder > 0) {
    steps.push({
      t: 'write',
      cell: `remainder.${colAtPlace(grid, 0)}`,
      value: String(layout.remainder),
      expect: true,
      narration: L(`나머지는 ${layout.remainder}이에요.`, `The remainder is ${layout.remainder}.`)
    });
  }
  const remTxt =
    layout.remainder > 0
      ? L(`, 나머지 ${layout.remainder}`)
      : L(`, 나머지 없음`);
  steps.push({
    t: 'highlight',
    narration: L(`몫 ${layout.quotient}`, undefined)
  });
  steps.push({
    t: 'highlight',
    narration: L(
      `답: ${layout.quotient}${layout.remainder > 0 ? `과 ${layout.remainder}/${layout.divisor}` : ''}`
    )
  });
  void remTxt; // 나머지 표현은 컴포넌트가 layout 에서 직접 읽음.
  return steps;
}
