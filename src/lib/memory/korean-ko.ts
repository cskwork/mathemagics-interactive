/**
 * 한글 자음 기억 코드(ko) — 신설계. PLAN §10-2(로케일별 별도 모듈, 번역 아님).
 *
 * 설계 근거·혼동 최소화 논리 전문: docs/memory-system-ko.md (요약은 본 파일 주석).
 *
 * 핵심 결정:
 * 1. **글자(자모) 기반** — 한글 음절의 초성·종성 자음 글자를 표에서 찾아 숫자로 바꾼다.
 *    원서 Major System 이 영어 철자의 불규칙성 때문에 반드시 '음성' 기반이어야 하는 것과 대조적으로,
 *    한글은 글자가 이미 거의 음소 단위라 8~13세 아동에게 '글자를 본다' 규칙이 훨씬 쉽다.
 * 2. **한 자리당 자음 1종, 조음 계급 충돌 0** — 평/경/거센 한 triple({ㄱㅋㄲ} 등)에서 최대 1종만 골라
 *    비슷한 소리가 서로 다른 숫자로 가는 혼동을 원천 차단. 5 triple + 5 단일자음(ㄴ ㄹ ㅁ ㅇ ㅎ) = 10종.
 * 3. **모음(ㅏㅑㅓㅕㅗㅛㅜㅠㅡㅣ)은 자유 끼워넣기** — Major System 과 동일 원리.
 * 4. **매핑 안 된 자음(ㅊ ㅋ ㅌ ㅍ ㄲ ㄸ ㅃ ㅆ ㅉ)은 소리 없음 처리**(모음처럼 건너뜀). 10자리에 10자음만.
 *    겹받침은 구성 자음을 순서대로 풀어 각각 매핑(그래프 순수 규칙).
 *
 * 단어→숫자는 결정적·유일(초성·종성 자음을 순서대로 읽음). 숫자→단어는 여럿(사전 탐색).
 */
import type { DigitConsonant, MemorySystem } from './types.js';

/** ko 숫자→자음표. encode 가 역방향(자음→숫자) 조회를 위해 LETTER_TO_DIGIT 로 펼친다. */
const KO_TABLE: readonly DigitConsonant[] = [
  { digit: 0, consonants: ['ㅇ'], mnemonic: { ko: '둥근 ㅇ = 둥근 0', en: 'round ㅇ = round 0' } },
  { digit: 1, consonants: ['ㄱ'], mnemonic: { ko: 'ㄱ 꼴 = 세로로 꺾인 1', en: 'ㄱ shape = a folded 1' } },
  { digit: 2, consonants: ['ㄴ'], mnemonic: { ko: 'ㄴ = 가로·세로 두 선(2)', en: 'ㄴ = two strokes' } },
  { digit: 3, consonants: ['ㄷ'], mnemonic: { ko: 'ㄷ = ㄴ에 아래 한 획(3)', en: 'ㄷ = ㄴ plus a base stroke' } },
  { digit: 4, consonants: ['ㄹ'], mnemonic: { ko: 'ㄹ 꼬불 = 네 굽이(4)', en: 'ㄹ zigzag = four bends' } },
  { digit: 5, consonants: ['ㅁ'], mnemonic: { ko: 'ㅁ 네모', en: 'ㅁ square' } },
  { digit: 6, consonants: ['ㅂ'], mnemonic: { ko: 'ㅂ', en: 'ㅂ' } },
  { digit: 7, consonants: ['ㅅ'], mnemonic: { ko: 'ㅅ 세 갈래(7)', en: 'ㅅ three prongs' } },
  { digit: 8, consonants: ['ㅎ'], mnemonic: { ko: 'ㅎ 숨소리', en: 'ㅎ breath' } },
  { digit: 9, consonants: ['ㅈ'], mnemonic: { ko: 'ㅈ', en: 'ㅈ' } }
];

/** 글자 → 숫자(역표). */
const LETTER_TO_DIGIT: Readonly<Record<string, number>> = Object.fromEntries(
  KO_TABLE.flatMap((e) => e.consonants.map((c) => [c, e.digit]))
);

// ── 한글 음절 분해 ──────────────────────────────────────────────────────────────
// 현대 한글 완성형 음절: U+AC00(가) ~ U+D7A3(힣). syllable = 44032 + 초*588 + 중*28 + 종.

const INITIALS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';

/**
 * 종성 인덱스(0=받침 없음, 1~27) → 구성 자음 문자열. 겹받침은 구성 자음을 그대로 나열
 * (그래프 순수 규칙: ㄳ→ㄱㅅ, ㄵ→ㄴㅈ …). 매핑 안 된 자음은 LETTER_TO_DIGIT 에 없어 자동 건너뛴다.
 */
const FINALS_COMPONENTS = [
  '', // 0
  'ㄱ', // 1 ㄱ
  'ㄲ', // 2 ㄲ(매핑 없음→건너뜀)
  'ㄱㅅ', // 3 ㄳ
  'ㄴ', // 4 ㄴ
  'ㄴㅈ', // 5 ㄵ
  'ㄴㅎ', // 6 ㄶ
  'ㄷ', // 7 ㄷ
  'ㄹ', // 8 ㄹ
  'ㄹㄱ', // 9 ㄺ
  'ㄹㅁ', // 10 ㄻ
  'ㄹㅂ', // 11 ㄼ
  'ㄹㅅ', // 12 ㄽ
  'ㄹㅌ', // 13 ㄾ
  'ㄹㅍ', // 14 ㄿ
  'ㄹㅎ', // 15 ㅀ
  'ㅁ', // 16 ㅁ
  'ㅂ', // 17 ㅂ
  'ㅂㅅ', // 18 ㅄ
  'ㅅ', // 19 ㅅ
  'ㅆ', // 20 ㅆ(매핑 없음)
  'ㅇ', // 21 ㅇ
  'ㅈ', // 22 ㅈ
  'ㅊ', // 23 ㅊ(매핑 없음)
  'ㅋ', // 24 ㅋ(매핑 없음)
  'ㅌ', // 25 ㅌ(매핑 없음)
  'ㅍ', // 26 ㅍ(매핑 없음)
  'ㅎ' // 27 ㅎ
];

const HANGUL_S_BASE = 0xac00;

/** 한 글자가 현대 한글 완성형 음절인가? */
function isHangulSyllable(ch: string): boolean {
  const cp = ch.codePointAt(0);
  return cp !== undefined && cp >= HANGUL_S_BASE && cp <= 0xd7a3;
}

/** 한글 단어 → 숫자열(초성·종성 자음을 순서대로). 비-한글·매핑 없음 글자는 건너뛴다. 순수 함수. */
export function encodeKorean(word: string): string {
  let out = '';
  for (const ch of word) {
    if (!isHangulSyllable(ch)) continue;
    const cp = (ch.codePointAt(0) ?? 0) - HANGUL_S_BASE;
    const initialIdx = Math.floor(cp / 588);
    const finalIdx = cp % 28;
    const initial = INITIALS[initialIdx];
    if (initial !== undefined) {
      const di = LETTER_TO_DIGIT[initial];
      if (di !== undefined) out += String(di);
    }
    const comps = FINALS_COMPONENTS[finalIdx] ?? '';
    for (const c of comps) {
      const df = LETTER_TO_DIGIT[c];
      if (df !== undefined) out += String(df);
    }
  }
  return out;
}

/** ko 기억 코드 시스템 객체. */
export const KOREAN_SYSTEM: MemorySystem = {
  locale: 'ko',
  table: KO_TABLE,
  freeLetters: ['ㅏ', 'ㅑ', 'ㅓ', 'ㅕ', 'ㅗ', 'ㅛ', 'ㅜ', 'ㅠ', 'ㅡ', 'ㅣ'],
  encode: encodeKorean
};
