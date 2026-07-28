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

const L = (ko: string, en?: string): LocalizedText => (en === undefined ? { ko } : { ko, en });

/**
 * 나눗셈 브래킷 레이아웃 생성. 순수 함수. DivisionBracket 컴포넌트가 소비.
 * 피제수 ÷ 제수 → 몫(좌→우 한 자리씩) + 나머지.
 */
export function deriveDivisionLayout(problem: Problem): DivisionLayout {
  const [dividend, divisor] = problem.operands;
  if (divisor === 0) throw new Error('deriveDivisionLayout: divisor is 0');
  const quotient = Math.floor(dividend / divisor);
  const remainder = dividend - quotient * divisor;
  const digits = longDivisionDigits(dividend, divisor);
  return { dividend, divisor, quotient, remainder, digits };
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
  const steps: Step[] = [
    {
      t: 'highlight',
      narration: L(`${layout.dividend} ÷ ${layout.divisor}. 큰 자리(왼쪽)부터 한 자리씩 정해요.`)
    }
  ];
  for (let i = 0; i < layout.digits.length; i++) {
    const dg = layout.digits[i]!;
    steps.push({
      t: 'highlight',
      narration: L(
        `${layout.divisor}이(가) ${dg.broughtDown}에 ${dg.digit}번 → ${dg.digit} × ${layout.divisor} = ${dg.product}`
      )
    });
    steps.push({
      t: 'write',
      cell: `quotient.q${i}`,
      value: String(dg.digit),
      expect: true,
      narration: L(`${dg.broughtDown} − ${dg.product} = ${dg.remainder}`)
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
