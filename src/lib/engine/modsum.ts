/**
 * 모드섬 검산(mod-sum / casting out nines & elevens) — 순수 함수.
 * book-content-map.md §6-2(9 버리기)·§6-6(11 버리기). PLAN §4(4장 배수판정과 연결).
 *
 * **9 버리기**: 각 수의 자릿수 합을 한 자리가 될 때까지 축약(digital root, 9는 9로 남김).
 *   4328 → 4+3+2+8=17 → 1+7 = **8**. 검산: 피연산자 모드섬들을 연산한 결과와 답의 모드섬이
 *   같아야 한다. 불일치 = **확정 오류**, 일치해도 1/9 확률로 오류(오류의 8/9 탐지).
 *
 * **11 버리기**: 오른쪽부터 자릿수를 교대로 빼고 더한 값(mod 11). 음수면 +11.
 *   23487 → 7−8+4−3+2 = **2**. 9-검산과 병행하면 미탐지율이 1/99 로 줄어든다.
 *
 * 핵심 속성(브리프 §3 요구): **모드섬 불일치 ⟹ 오답**(역은 8/9로 성립). 이것이
 * "오답 잡아내기" 게임(catch-wrong.ts)의 수학적 기반이다.
 *
 * 원문 문장 복제 금지(PLAN §10-1) — 규칙만 가져오고 문장은 자체 저작.
 */
import type { ModSumResult } from './types.js';

/** 9 버리기 모드섬(digital root). 1~9(9는 9로). 0 → 0. 순수 함수. */
export function modSum9(n: number): number {
  if (n === 0) return 0;
  const m = Math.abs(Math.trunc(n));
  return ((m - 1) % 9) + 1;
}

/**
 * 11 버리기 모드섬. 오른쪽부터 자릿수 교대 ±, mod 11(항상 0~10). 순수 함수.
 * 소수점 이하는 무시(정수화). 예: 23487 → 7−8+4−3+2 = 2.
 */
export function modSum11(n: number): number {
  let m = Math.abs(Math.trunc(n));
  let sign = 1; // 오른쪽 끝 자리가 +
  let acc = 0;
  while (m > 0) {
    acc += sign * (m % 10);
    sign = -sign;
    m = Math.floor(m / 10);
  }
  return ((acc % 11) + 11) % 11;
}

/** 뺄셈 모드섬 예측값 보정: dr(a) − dr(b) 를 1~9(또는 0)로. */
function subMod9(da: number, db: number): number {
  const d = ((da - db) % 9 + 9) % 9;
  return d === 0 ? 9 : d;
}

/** 모드섬(9) 예측값 — 피연산자 모드섬들을 op 로 계산해 한 자리로. */
export function expectedMod9(op: 'add' | 'sub' | 'mul', operandMods: readonly number[]): number {
  if (op === 'add') return modSum9(operandMods.reduce((s, x) => s + x, 0));
  if (op === 'mul') return modSum9(operandMods.reduce((p, x) => p * x, 1));
  // sub (2 피연산자 가정)
  const [a, b] = operandMods;
  return subMod9(a ?? 0, b ?? 0);
}

/** 모드섬(11) 예측값. */
export function expectedMod11(op: 'add' | 'sub' | 'mul', operandMods: readonly number[]): number {
  if (op === 'add') return operandMods.reduce((s, x) => s + x, 0) % 11;
  if (op === 'mul') return operandMods.reduce((p, x) => (p * x) % 11, 1) % 11;
  const [a, b] = operandMods;
  return (((a ?? 0) - (b ?? 0)) % 11 + 11) % 11;
}

/**
 * 모드섬 검산 결과 생성. 순수 함수. ModSumCheck 컴포넌트 + catch-wrong 게임이 소비.
 * @param op 검산 대상 연산.
 * @param operands 피연산자(2개 이상).
 * @param claimedAnswer 주장된 답(올바를 수도, 틀릴 수도 있음).
 */
export function checkModSum(
  op: 'add' | 'sub' | 'mul',
  operands: readonly number[],
  claimedAnswer: number
): ModSumResult {
  const mod9Operands = operands.map(modSum9);
  const mod9Expected = expectedMod9(op, mod9Operands);
  const mod9Answer = modSum9(claimedAnswer);
  const mod11Operands = operands.map(modSum11);
  const mod11Expected = expectedMod11(op, mod11Operands);
  const mod11Answer = modSum11(claimedAnswer);
  return {
    op,
    mod9Operands,
    mod9Expected,
    mod9Answer,
    mod9Match: mod9Expected === mod9Answer,
    mod11Expected,
    mod11Answer,
    mod11Match: mod11Expected === mod11Answer
  };
}

/**
 * 모드섬(9+11 병행)으로 답이 틀렸는지 판정. **불일치 ⟹ 확정 오류**.
 * 둘 다 일치해도 1/99 확률로 오류일 수 있으므로, "일치"를 "정답"으로 단얩할 순 없다 —
 * 호출자가 "틀림" 판정에만 이 값을 쓴다(catch-wrong 게임).
 */
export function isFlaggedWrongByModSum(result: ModSumResult): boolean {
  return !result.mod9Match || !result.mod11Match;
}
