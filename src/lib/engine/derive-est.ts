/**
 * 어림셈 스텝 파생 + 반올림 밴드 — 순수 함수. book-content-map.md §5(5장) 규칙.
 *
 * 자릿수 어림(est-digit): 둘째 유효숫자에서 반올림해 계산. **정답이 범위**(밴드)가 될 수 있다
 * (브리프 §2 "정답이 범위인 문제 유형 지원"). SubstitutionChain 컴포넌트가 치환 화살표를 렌더.
 *
 * 어림 대상 연산은 {@link Problem.estOf} 로 지정(add/sub/mul/div).
 * 모든 결과는 독립 산술과 대조해 테스트한다(estimate 는 정확값 근처).
 */
import type { LocalizedText } from '../content/localized.js';
import type { EstimationBand, Problem, Step } from './types.js';
import { deriveGrid, pairOf, writeAnswerLTR } from './derive-internals.js';

const L = (ko: string, en?: string): LocalizedText => (en === undefined ? { ko } : { ko, en });

/** 어림 대상 연산(기본 add). */
function estOf(problem: Problem): 'add' | 'sub' | 'mul' | 'div' {
  return problem.estOf ?? 'add';
}

/** 정확값. */
function exactOf(problem: Problem): number {
  const [a, b] = pairOf(problem);
  switch (estOf(problem)) {
    case 'add':
      return a + b;
    case 'sub':
      return a - b;
    case 'mul':
      return a * b;
    case 'div':
      return b === 0 ? 0 : a / b;
  }
}

/** n 을 둘째 유효숫자 자리로 반올림(예: 23859379 → 24000000). */
function roundToTwoSig(n: number): number {
  if (n === 0) return 0;
  const sign = n < 0 ? -1 : 1;
  const abs = Math.abs(n);
  const mag = Math.floor(Math.log10(abs));
  const factor = 10 ** (mag - 1);
  return sign * Math.round(abs / factor) * factor;
}

function directedTwoSig(n: number): { down: number; nearest: number; up: number } {
  if (n === 0) return { down: 0, nearest: 0, up: 0 };
  const factor = 10 ** (Math.floor(Math.log10(Math.abs(n))) - 1);
  return {
    down: Math.floor(n / factor) * factor,
    nearest: roundToTwoSig(n),
    up: Math.ceil(n / factor) * factor
  };
}

/**
 * 어림셈 반올림 밴드 생성. 순수 함수. SubstitutionChain/EsterangeInput 컴포넌트가 소비.
 * est-digit estimate = 두 수를 반올림해 계산한 추정치.
 * est-band estimate = 첫 수는 올리고 둘째 수는 내린 중앙 추정치.
 * [low, high] 는 정확값을 사용하지 않고 피연산자를 각각 내림/올림해 만든다.
 */
export function estimationBand(problem: Problem): EstimationBand {
  const [a, b] = pairOf(problem);
  const aRounded = directedTwoSig(a);
  const bRounded = directedTwoSig(b);
  const op = estOf(problem);
  const aR = problem.method === 'est-band' ? aRounded.up : aRounded.nearest;
  const bR = problem.method === 'est-band' ? bRounded.down : bRounded.nearest;
  let estimate: number;
  switch (op) {
    case 'add':
      estimate = aR + bR;
      break;
    case 'sub':
      estimate = aR - bR;
      break;
    case 'mul':
      estimate = aR * bR;
      break;
    case 'div':
      estimate = bR === 0 ? 0 : Math.round(aR / bR);
      break;
  }
  const exact = exactOf(problem);
  let low: number;
  let high: number;
  switch (op) {
    case 'add':
      low = aRounded.down + bRounded.down;
      high = aRounded.up + bRounded.up;
      break;
    case 'sub':
      low = aRounded.down - bRounded.up;
      high = aRounded.up - bRounded.down;
      break;
    case 'mul':
      low = aRounded.down * bRounded.down;
      high = aRounded.up * bRounded.up;
      break;
    case 'div':
      low = bRounded.up === 0 ? 0 : Math.floor(aRounded.down / bRounded.up);
      high = bRounded.down === 0 ? 0 : Math.ceil(aRounded.up / bRounded.down);
      break;
  }
  const sign = op === 'add' ? '+' : op === 'sub' ? '−' : op === 'mul' ? '×' : '÷';
  const roundingNote = L(`${aR} ${sign} ${bR}`, `${aR} ${sign} ${bR}`);
  return {
    estimate,
    low,
    high,
    exact,
    roundedOperands: { a: aRounded, b: bRounded },
    roundingNote
  };
}

/** 어림셈 문제 → 스텝(치환 체인 + 어림 답). */
export function deriveEstSteps(problem: Problem): Step[] {
  const band = estimationBand(problem);
  // 어림 답(estimate) 자릿수가 피연산자보다 클 수 있어 grid 를 estimate 기준으로 생성.
  const grid = deriveGrid(problem, band.estimate);
  const steps: Step[] = [
    {
      t: 'highlight',
      narration: L('둘째 유효숫자 자리에서 수를 바꿔 빠르게 계산해요.', 'Change each number at the second significant-digit place and calculate quickly.')
    }
  ];
  const [a, b] = pairOf(problem);
  const aR = problem.method === 'est-band' ? band.roundedOperands.a.up : band.roundedOperands.a.nearest;
  const bR = problem.method === 'est-band' ? band.roundedOperands.b.down : band.roundedOperands.b.nearest;
  // 치환 체인: 원래 수 → 반올림 수. branch 스텝(SubstitutionChain 이 소비).
  if (aR !== a) {
    steps.push({ t: 'branch', from: a, to: aR, label: '≈', narration: L(`${a}를 ${aR}(으)로 어림`) });
  }
  if (bR !== b) {
    steps.push({ t: 'branch', from: b, to: bR, label: '≈', narration: L(`${b}를 ${bR}(으)로 어림`) });
  }
  steps.push({
    t: 'highlight',
    narration: L(`${band.roundingNote.ko} = ?`, `${band.roundingNote.en ?? band.roundingNote.ko} = ?`)
  });
  // 어림 답을 입력한 뒤에만 대표값·범위·정확값을 공개한다.
  steps.push(...writeAnswerLTR(band.estimate, grid));
  steps.push({
    t: 'highlight',
    narration: L(
      `어림 답: ${band.estimate}. 피연산자를 각각 내림·올림한 뒤 같은 연산을 적용해 구한 범위는 ${band.low}~${band.high}예요. 정확값 ${band.exact}은 풀이 후 확인해요.`,
      `Estimate: ${band.estimate}. Directed operand rounding gives the range ${band.low}–${band.high}. Check the exact value ${band.exact} only after estimating.`
    )
  });
  return steps;
}
