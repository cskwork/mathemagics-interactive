/**
 * 부모 게이트 산술 과제 (M7 산출물 4 — Dialog 파괴적 행동 보호).
 *
 * 순수 함수로 분리한 이유: (1) vitest 가 node 환경(DOM 없음)이라 Dialog 의 DOM 동작을
 * 직접 테스트할 수 없으므로 검증 가능한 로직만 떼어낸다. (2) 과제 생성·채점이
 * 부작용 없이 결정적으로 만들어지는지 단언한다.
 *
 * COPPA 2025 정합(PLAN §7.2): 어른은 쉽게, 아동의 우연한 탭으로는 통과하지 못하는
 * 정도. 한 자리 + 한 자리 합(답이 두 자리가 될 수 있음) — 키보드 입력이 필요하므로
 * 넘패드 탭만 하는 어린 사용자는 자연스럽게 막힌다.
 */

export interface ParentGateChallenge {
  /** 낭독/표시용 문장(로케일 템플릿에 끼워 넣을 값). 예: "7 + 5". */
  readonly prompt: string;
  /** 정답. */
  readonly answer: number;
}

/** 결정적 RNG(mulberry32) — seed 고정 시 같은 과제. 기본은 무작위. */
export function makeParentGateChallenge(seed?: number): ParentGateChallenge {
  const rng = mulberry32(seed ?? (globalThis.crypto?.randomUUID?.() ? hashNow() : 0));
  const a = 1 + Math.floor(rng() * 9); // 1..9
  const b = 1 + Math.floor(rng() * 9); // 1..9
  return { prompt: `${a} + ${b}`, answer: a + b };
}

/** 사용자 입력을 정답과 비교(앞뒤 공백 허용, 숫자만). */
export function isParentGateCorrect(challenge: ParentGateChallenge, input: string): boolean {
  const n = Number(input.trim());
  if (!Number.isFinite(n)) return false;
  return n === challenge.answer;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hashNow(): number {
  return Date.now() ^ Math.floor(Math.random() * 0xffffffff);
}
