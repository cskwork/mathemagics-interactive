/**
 * 수학 마술(9장) 콘텐츠 — 순수 로직 + 레지스트리. 브리프 §2-5.
 *
 * 스킬트리 해금 슬롯(M4 CHAPTER_MAGIC_SLOTS) 에 들어가는 실제 콘텐츠.
 * 트릭 시연(demo) → 비밀 공개(secret = 배운 원리) → 연습 → "가족에게 보여주기" 미션.
 *
 * 9종 중 **앞 장 원리와 직결되는 4종을 우선**(브리프): ch2→심령수학, ch3→1089, ch4→사라진숫자,
 * ch5→개구리점프. 원리가 앞 장의 배운 기법(모드섬·11곱셈 등)으로 귀결되는 것이 핵심.
 * 나머지 5종(세제곱근·제곱근·마방진·놀라운합·요일계산)은 8장 고급 곱셈 등 미구현 장에 의존해
 * '곧 열려요' 자리표로 둔다(정직한 범위 명시).
 *
 * 원문 문장 복제 금지(PLAN §10-1) — 절차·수치 구조만 가져오고 문장은 자체 저작.
 */
import type { LocalizedText } from '../content/localized.js';
import { modSum9 } from '../engine/modsum.js';

const L = (ko: string, en?: string): LocalizedText => (en === undefined ? { ko } : { ko, en });

/** 마술 시연의 한 단계(애니메이션/말풍선용 데이터). */
export interface MagicStep {
  readonly label: LocalizedText;
  readonly value: number | string;
}

/** 마술 트릭 정의(레지스트리 1엔트리). */
export interface MagicTrick {
  readonly id: string;
  /** 이 마술을 여는 챕터(M4 CHAPTER_MAGIC_SLOTS 매핑). */
  readonly unlockChapter: number;
  readonly title: LocalizedText;
  readonly secret: LocalizedText;
  /** 원리(= 배운 기법) 한 줄. */
  readonly principle: LocalizedText;
  /** 연습용 샘플 생성(결정적 시드). */
  readonly demo: (seed: number) => { steps: readonly MagicStep[]; finale: LocalizedText };
}

/** 결정적 작은 PRNG(모듈 로컬). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randInt(r: () => number, lo: number, hi: number): number {
  return lo + Math.floor(r() * (hi - lo + 1));
}

/** 숫자를 뒤집은 수(123 → 321). */
function reverse(n: number): number {
  return Number(String(n).split('').reverse().join(''));
}

// ── 트릭 1: 심령 수학 (ch2 해금) ────────────────────────────────────────────────
const psychic: MagicTrick = {
  id: 'psychic-math',
  unlockChapter: 2,
  title: L("심령 수학", "Psychic Math"),
  secret: L("더한 수의 절반이 항상 답이에요.", "Half of the added number is always the answer."),
  principle: L('대수: (2x+12)/2 − x = 6. 더한 수의 절반이 항상 답.', 'Algebra: (2x+12)/2 − x = 6.'),
  demo: (seed) => {
    const r = rng(seed);
    const x = randInt(r, 1, 99);
    const afterDouble = x * 2;
    const afterAdd = afterDouble + 12;
    const afterHalve = afterAdd / 2;
    return {
      steps: [
        { label: L('아무 수 정하기'), value: x },
        { label: L('×2'), value: afterDouble },
        { label: L('+12'), value: afterAdd },
        { label: L('÷2'), value: afterHalve },
        { label: L('원래 수 빼기'), value: afterHalve - x }
      ],
      finale: L('항상 6!', 'Always 6!')
    };
  }
};

// ── 트릭 2: 마법의 1089 (ch3 해금) ──────────────────────────────────────────────
const magic1089: MagicTrick = {
  id: 'magic-1089',
  unlockChapter: 3,
  title: L("마법의 1089", "Magic 1089"),
  secret: L("앞뒤가 바뀐 세 자리 수의 차는 99의 배수, 거기에 뒤집은 수를 더하면 1089.", "abc − cba is a multiple of 99; + reverse gives 1089."),
  principle: L('abc − cba = 99(a−c); 99의 배수 + 뒤집은 수 = 1089.', 'abc − cba = 99(a−c); + reverse → 1089.'),
  demo: (seed) => {
    const r = rng(seed);
    // 첫 자리 > 끝 자리인 3자리 수.
    const a = randInt(r, 2, 9);
    const c = randInt(r, 1, a - 1);
    const b = randInt(r, 0, 9);
    const n = a * 100 + b * 10 + c;
    const rev = reverse(n);
    const diff = n - rev; // 항상 99의 배수; 자릿수 맞춰 0패딩 포함
    const diffRev = reverse(diff);
    return {
      steps: [
        { label: L('첫>끝인 3자리 수'), value: n },
        { label: L('뒤집어 빼기'), value: `${n} − ${rev} = ${diff}` },
        { label: L('결과 뒤집어 더하기'), value: `${diff} + ${diffRev} = ${diff + diffRev}` }
      ],
      finale: L('항상 1089!', 'Always 1089!')
    };
  }
};

// ── 트릭 3: 사라진 숫자 (ch4 해금 — 모드섬 원리) ──────────────────────────────────
const missingDigit: MagicTrick = {
  id: 'missing-digit',
  unlockChapter: 4,
  title: L("사라진 숫자 맞히기", "Name the missing digit"),
  secret: L("9의 배수는 자릿수 합도 9의 배수 — 모드섬 원리예요.", "A multiple of 9 has a digit sum that is a multiple of 9."),
  principle: L('9의 배수의 자릿수 합은 9의 배수 — 6장 모드섬과 같은 원리.', 'Digit sum of a multiple of 9 is a multiple of 9 — same as mod-sum.'),
  demo: (seed) => {
    const r = rng(seed);
    const base = 1089;
    const mult = randInt(r, 100, 999);
    const product = base * mult;
    const digits = String(product).split('');
    const hideIdx = randInt(r, 0, digits.length - 1);
    digits[hideIdx] = '_';
    const shown = digits.join('');
    const sumRest = String(product).split('').reduce((s, d, i) => (i === hideIdx ? s : s + Number(d)), 0);
    const modRest = modSum9(sumRest);
    // 다음 9의 배수(또는 같은)까지의 차이가 빠진 숫자(0/9 모호성은 9로 취급).
    const missing = (9 - modRest) % 9;
    return {
      steps: [
        { label: L('1089 × 임의 3자리 수'), value: `${base} × ${mult} = ${product}` },
        { label: L('5자리만 부르기(한 자리 숨김)'), value: shown },
        { label: L('보이는 숫자 합의 모드섬'), value: modRest }
      ],
      finale: L(`빠진 숫자는 ${missing === 0 ? 9 : missing}!`, `Missing digit is ${missing === 0 ? 9 : missing}!`)
    };
  }
};

// ── 트릭 4: 개구리 점프 덧셈 (ch5 해금 — 11 곱셈 원리) ────────────────────────────
const leapfrog: MagicTrick = {
  id: 'leapfrog',
  unlockChapter: 5,
  title: L("개구리 점프 덧셈", "Leapfrog Addition"),
  secret: L("10줄의 합은 7번째 줄의 11배 — 11 곱셈 원리예요.", "The 10-line sum is 11 times the 7th line — the ×11 trick."),
  principle: L('10줄의 합 = 7번째 줄 × 11. 11 곱셈 원리의 마술적 쓰임.', 'Sum of 10 lines = 7th line × 11.'),
  demo: (seed) => {
    const r = rng(seed);
    const x = randInt(r, 10, 99);
    const y = randInt(r, 10, 99);
    const lines: number[] = [x, y];
    for (let i = 2; i < 10; i++) lines.push(lines[i - 1]! + lines[i - 2]!);
    const total = lines.reduce((s, n) => s + n, 0);
    return {
      steps: [
        { label: L('두 수로 시작'), value: `${x}, ${y}` },
        { label: L('피보나치식으로 10줄'), value: `… 7번째 줄 = ${lines[6]}` },
        { label: L('7번째 줄 × 11'), value: `${lines[6]} × 11 = ${lines[6]! * 11}` }
      ],
      finale: L(`10줄의 합 = ${total}`, `Sum of 10 lines = ${total}`)
    };
  }
};

/** 우선 구현한 4종(앞 장 원리 연결). */
export const MAGIC_TRICKS: readonly MagicTrick[] = [psychic, magic1089, missingDigit, leapfrog];

/** 단일 트릭 조회. */
export function findMagicTrick(id: string): MagicTrick | undefined {
  return MAGIC_TRICKS.find((t) => t.id === id);
}

/** 챕터 해금 → 마술 id(M4 CHAPTER_MAGIC_SLOTS 와 동일 매핑). */
export function magicIdForChapter(chapter: number): string | undefined {
  return MAGIC_TRICKS.find((t) => t.unlockChapter === chapter)?.id;
}
