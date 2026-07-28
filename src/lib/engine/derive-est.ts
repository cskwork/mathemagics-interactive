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
import { deriveGrid, writeAnswerLTR } from './derive-internals.js';

const L = (ko: string, en?: string): LocalizedText => (en === undefined ? { ko } : { ko, en });

/** 어림 대상 연산(기본 add). */
function estOf(problem: Problem): 'add' | 'sub' | 'mul' | 'div' {
  return problem.estOf ?? 'add';
}

/** 정확값. */
function exactOf(problem: Problem): number {
  const [a, b] = problem.operands;
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

/**
 * 어림셈 반올림 밴드 생성. 순수 함수. SubstitutionChain/EsterangeInput 컴포넌트가 소비.
 * estimate = 두 수를 반올림해 계산한 추정치. 밴드 [low, high] = 정확값의 ±10%(또는 최소 폭).
 */
export function estimationBand(problem: Problem): EstimationBand {
  const [a, b] = problem.operands;
  const aR = roundToTwoSig(a);
  const bR = roundToTwoSig(b);
  const op = estOf(problem);
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
  const tolerance = Math.max(Math.abs(exact) * 0.1, 1);
  const sign = op === 'add' ? '+' : op === 'sub' ? '−' : op === 'mul' ? '×' : '÷';
  const roundingNote = L(`${aR} ${sign} ${bR}`, `${aR} ${sign} ${bR}`);
  return {
    estimate,
    low: Math.round(exact - tolerance),
    high: Math.round(exact + tolerance),
    exact,
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
      narration: L(`어림으로 빠르게 구해요. 큰 수일수록 오차가 작아요.`)
    }
  ];
  const [a, b] = problem.operands;
  const aR = roundToTwoSig(a);
  const bR = roundToTwoSig(b);
  // 치환 체인: 원래 수 → 반올림 수. branch 스텝(SubstitutionChain 이 소비).
  if (aR !== a) {
    steps.push({ t: 'branch', from: a, to: aR, label: '≈', narration: L(`${a}를 ${aR}(으)로 어림`) });
  }
  if (bR !== b) {
    steps.push({ t: 'branch', from: b, to: bR, label: '≈', narration: L(`${b}를 ${bR}(으)로 어림`) });
  }
  steps.push({
    t: 'highlight',
    narration: L(`${band.roundingNote.ko} = ${band.estimate}`)
  });
  steps.push({
    t: 'highlight',
    narration: L(
      `어림 답: ${band.estimate}. 진짜 답은 ${band.low}~${band.high} 사이예요. (정확히 ${band.exact})`
    )
  });
  // 어림 답을 좌→우로 write(연습 입력용 대표값 = estimate).
  steps.push(...writeAnswerLTR(band.estimate, grid));
  return steps;
}
