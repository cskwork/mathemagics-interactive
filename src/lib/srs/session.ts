/**
 * 혼합 세트(interleaving) 빌더 — 순수 함수. PLAN §4.2-9 / teaching-trends §1.3.
 *
 * mathemagics 의 핵심 역량은 "이 문제에 어떤 트릭을 쓸까?" 판단. 블록 연습(같은 기법만
 * 20문제)은 전략 선택 훈련을 제거한다. 그래서 due 카드를 서로 다른 기법이 번갈아
 * 나오도록 섞는다(연속 두 카드가 같은 기법이 되지 않게, 가능한 한).
 *
 * 결정적 시드 셔플 — 같은 due 세트 + 시드면 같은 순서(테스트 가능).
 */
import type { SrsConfig } from './config.js';

/** 세션에 넣을 카드의 최소 형상. */
export interface SessionCard {
  readonly factId: string;
  readonly skillId: string;
}

/** 결정적 PRNG(mulberry32) — generate.ts 와 동일 방식, 독립 유지. */
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

/** Fisher–Yates 셔플(결정적 rng). 새 배열 반환. */
function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = out[i]!;
    const b = out[j]!;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

/**
 * due 카드들을 섞어 세션을 만든다 — 서로 다른 기법이 번갈아 나오도록(interleaving).
 *
 * 알고리즘: 먼저 시드로 섞은 뒤, 같은 skillId 가 연속하지 않도록 재배열.
 * (가장 많은 기법 그룹부터 빈칸에 끼워 넣는 interleave.)
 *
 * @param cards due 카드(이미 백로그 캡 통과한 세션 세트).
 * @param seed 결정적 시드.
 * @param config (현재 직접 사용 안 함 — 시그니처 일관성).
 */
export function interleave<T extends SessionCard>(
  cards: readonly T[],
  seed: number,
  _config: SrsConfig
): T[] {
  if (cards.length <= 1) return [...cards];
  const rng = mulberry32(seed);
  const shuffled = shuffle(cards, rng);

  // skillId 그룹화.
  const groups = new Map<string, T[]>();
  for (const c of shuffled) {
    const arr = groups.get(c.skillId);
    if (arr) arr.push(c);
    else groups.set(c.skillId, [c]);
  }

  // 빈도 내림차순 그룹 리스트.
  const buckets = [...groups.values()].sort((a, b) => b.length - a.length);

  // interleave: 가장 큰 그룹부터 결과에 펼치되, 매 스텝마다 직전 skillId 와 다른
  // 그룹을 우선 꺼낸다. 그리디 — 완벽 분산 보장은 아니지만 연속 중복을 최소화.
  const out: T[] = [];
  let lastSkill = '';
  while (buckets.some((b) => b.length > 0)) {
    // 직전과 다른 그룹 중 가장 큰 것.
    let pickIdx = -1;
    for (let i = 0; i < buckets.length; i++) {
      const b = buckets[i]!;
      if (b.length === 0) continue;
      if (b[0]!.skillId === lastSkill) continue;
      if (pickIdx < 0 || buckets[pickIdx]!.length < b.length) pickIdx = i;
    }
    // 직전과 다른 그룹이 없으면(모두 같은 skill 남음) 그냥 가장 큰 것.
    if (pickIdx < 0) {
      for (let i = 0; i < buckets.length; i++) {
        if (buckets[i]!.length > 0) {
          pickIdx = i;
          break;
        }
      }
    }
    if (pickIdx < 0) break;
    const card = buckets[pickIdx]!.pop()!;
    out.push(card);
    lastSkill = card.skillId;
  }
  return out;
}
