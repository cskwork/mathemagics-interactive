/**
 * 페이딩 변환 — 순수 함수. PLAN §4.1-5 / docs/briefs/M2.md 산출물 2(③ 단계).
 *
 * 페이딩 = worked example 의 마지막 스텝부터 학생이 채우는 방식. 엔진이 파생한 Step[] 에서
 * 답 칸 write 스텝(expect) 중 **마지막 K 개**만 학생 입력으로 두고, 앞의 write 스텝들은
 * expect 를 떼어 자동 공개(frontier 가 채운 데모로 보여줌)한다.
 *
 * DigitInput 의 frontier 알고리즘은 non-expect write 스텝을 다음 expect 직전까지 자동으로
 * 공개하므로, expect 를 떼기만 하면 "선생님이 보여주고 학생이 마지막을 채우는" 연출이 된다.
 * K 는 레슨 진행에 따라 점진 확대(브리프 "expect 셀 점진 확대").
 */
import type { Step, WriteStep } from '../engine/types.js';

/**
 * steps 에서 마지막 K 개의 expect(write) 스텝만 입력 대기로 두고, 나머지 write 는
 * expect 를 제거해 자동 공개되도록 한 **새 배열**을 돌려준다(불변 — 원본 미변경).
 * K 가 전체 expect 수 이상이면 전부 입력(독립 연습과 동일).
 */
export function withExpectOnLastK(steps: readonly Step[], k: number): Step[] {
  // expect write 스텝의 인덱스를 풀이 순서대로 수집.
  const expectIdx: number[] = [];
  steps.forEach((s, i) => {
    if (s.t === 'write' && (s as WriteStep).expect === true) expectIdx.push(i);
  });

  const keepCount = Math.max(0, Math.min(k, expectIdx.length));
  if (keepCount === expectIdx.length) return [...steps]; // 전부 입력 — 변형 불필요

  // 마지막 keepCount 개만 expect 로 남긴다.
  const keepFrom = expectIdx.length - keepCount;
  const keepSet = new Set(expectIdx.slice(keepFrom));

  return steps.map((s, i) => {
    if (s.t === 'write' && (s as WriteStep).expect === true && !keepSet.has(i)) {
      // expect 제거 — 자동 공개 데모 셀로 전환. value/narration 유지.
      const { t, cell, value, narration } = s;
      const out: WriteStep = narration !== undefined ? { t, cell, value, narration } : { t, cell, value };
      return out;
    }
    return s;
  });
}

/** steps 의 expect(write) 스텝 수(= 답 자릿수). K 산정에 사용. */
export function expectCount(steps: readonly Step[]): number {
  return steps.filter((s) => s.t === 'write' && (s as WriteStep).expect === true).length;
}

/**
 * 페이딩 문제 인덱스 i(0-base)에 대해 학생이 채울 칸 수 K.
 * 첫 문제(i=0)는 1칸부터, 한 문제마다 1칸씩 늘리고 전체 답 자릿수를 넘지 않는다.
 * (PLAN §4.1-5 "마지막 스텝부터 점진 확대".)
 */
export function fadingKForProblem(problemIndex: number, totalExpect: number): number {
  return Math.max(1, Math.min(totalExpect, 1 + problemIndex));
}
