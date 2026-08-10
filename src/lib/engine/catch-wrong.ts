/**
 * "오답 잡아내기" 게임 — 순수 로직. 브리프 §2-3 / book-content-map §4-2.
 *
 * 완성된 계산(식 + 주장된 답) 여러 개를 보여주고, 모드섬 검산(modsum.ts)으로 틀린 것을
 * 찾아내는 게임. **검산이 마술처럼 느껴지는 연출**(브리프)이 핵심이다.
 *
 * 수학적 보장: 정답은 항상 모드섬이 일치하고, 우리가 주입하는 오답은 **반드시 모드섬이
 * 불일치**하도록 만든다(9 버리기에서 걸리도록). 따라서 "모드섬 불일치 ⟹ 오답" 속성이
 * 이 게임에서 100% 성립한다(catch-wrong.test.ts 가 단언). 현실에선 1/9 로 빠져나가는 오답도
 * 게임용으로는 잡히게 설계해 좌절을 없앤다(아동 친화 — PLAN §4.2-11).
 *
 * 원문 문장 복제 금지(PLAN §10-1).
 */
import { checkModSum } from './modsum.js';

/** 검산 게임의 한 항목 = 완성된 계산(식 + 주장된 답). */
export interface CatchItem {
  /** 피연산자(2개). */
  readonly operands: readonly [number, number];
  /** 연산. add/mul 만 지원(검산 데모용). */
  readonly op: 'add' | 'mul';
  /** 주장된 답(맞을 수도, 틀릴 수도 있음). */
  readonly claimed: number;
  /** 실제 정답(채점·힌트용). */
  readonly truth: number;
}

/** 한 판의 결과. */
export interface CatchRound {
  readonly items: readonly CatchItem[];
  /** 틀린 항목의 인덱스(정답 키). */
  readonly wrongIndex: number;
}

/** mulberry32 — 결정적 PRNG(generate.ts 와 동일 알고리즘, 의존성 0). */
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

function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** true answer 가 되는 2-피연산자 (add/mul) 문제 생성. */
function makeTruth(rng: () => number, op: 'add' | 'mul'): { operands: [number, number]; truth: number } {
  const a = randInt(rng, 10, 99);
  const b = randInt(rng, 2, 9);
  const pair: [number, number] = op === 'mul' ? [a, b] : [a, b];
  const truth = op === 'mul' ? a * b : a + b;
  return { operands: pair, truth };
}

/**
 * 오답 주입: truth 와 다르고 **9 버리기 모드섬이 불일치**하는 claimed 를 찾는다.
 * 1~9 만큼 더해보며 첫 번째로 mod9 이 어긋하는 값을 채택(항상 존재 — 9개 중 최소 8개가 어긋).
 */
function injectWrong(op: 'add' | 'mul', operands: readonly [number, number], truth: number): number {
  for (let k = 1; k <= 9; k++) {
    const claimed = truth + k;
    const res = checkModSum(op, operands, claimed);
    if (!res.mod9Match) return claimed;
  }
  return truth + 1; // fallback (이론상 도달 불가)
}

/**
 * 한 판 생성. 순수·결정적(시드). n 개 항목 중 정확히 1개가 오답(모드섬 불일치 보장).
 * @param seed 결정적 시드.
 * @param n 항목 수(≥2). 1개는 오답, 나머지는 정답.
 * @param op 연산(add/mul).
 */
export function makeRound(seed: number, n: number, op: 'add' | 'mul' = 'mul'): CatchRound {
  if (n < 2) throw new Error('makeRound: 최소 2개 항목이 필요합니다');
  const rng = mulberry32(seed);
  const wrongIndex = randInt(rng, 0, n - 1);
  const items: CatchItem[] = [];
  for (let i = 0; i < n; i++) {
    const { operands, truth } = makeTruth(rng, op);
    if (i === wrongIndex) {
      const claimed = injectWrong(op, operands, truth);
      items.push({ operands, op, claimed, truth });
    } else {
      items.push({ operands, op, claimed: truth, truth });
    }
  }
  return { items, wrongIndex };
}

/**
 * 모드섬(9+11)으로 틀린 항목 인덱스를 찾는다. **불일치하는 첫 항목**을 반환(없으면 undefined).
 * 현실에선 오답과 정답의 차이가 9의 배수면 우연히 일치할 수 있으나, makeRound 가 보장한 판에선
 * 오직 wrongIndex 만 불일치한다.
 */
export function findWrongByModSum(round: CatchRound): number | undefined {
  for (let i = 0; i < round.items.length; i++) {
    const it = round.items[i]!;
    const res = checkModSum(it.op, it.operands, it.claimed);
    if (!res.mod9Match) return i;
  }
  return undefined;
}

/** 한 항목이 실제로 틀렸는지(claimed ≠ truth). */
export function isActuallyWrong(item: CatchItem): boolean {
  return item.claimed !== item.truth;
}
