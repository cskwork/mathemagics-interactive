/**
 * 영어 Major System(en) — 원서 제7장 그대로(PLAN §10-2). 음성(phonetic) 기반.
 *
 * 숫자→자음 소리(book-content-map §7-1 표):
 *   0 = s/z · 1 = t/d · 2 = n · 3 = m · 4 = r · 5 = l
 *   6 = j/soft-g/ch/sh · 7 = k/hard-c/hard-g/q/ng · 8 = f/v/ph · 9 = p/b
 * 모음(aeiou) 및 h, w, y 는 값 없음(자유 삽입). 단어→숫자는 유일(발음 순서대로).
 *
 * 영어 철자는 불규칙하므로 **발음 단위(digraph 포함)**로 묶어 변환한다.
 * 완벽한 영어 음소 분석이 아니라 Major System 실전 관례(c→k, soft-g→j, x→ks, ph→f, doubled consonant 1회)
 * 를 따른 실용적 인코더다. 정답은 사전(en-words.json)에 미리 encode 한 값을 쓰므로
 * 인코더의 미세한 음성 판단이 사전 검색에 영향을 주지 않는다(사전은 digits 값을 직접 든다).
 */
import type { DigitConsonant, MemorySystem } from './types.js';

const EN_TABLE: readonly DigitConsonant[] = [
  { digit: 0, consonants: ['s', 'z', 'soft c'], mnemonic: { ko: '0 = s/z (zero 의 z)', en: '0 = s/z (z of zero)' } },
  { digit: 1, consonants: ['t', 'd'], mnemonic: { ko: '1 = t/d (세로획 1)', en: '1 = t/d (one downstroke)' } },
  { digit: 2, consonants: ['n'], mnemonic: { ko: '2 = n (세로획 2)', en: '2 = n (two downstrokes)' } },
  { digit: 3, consonants: ['m'], mnemonic: { ko: '3 = m (세로획 3)', en: '3 = m (three downstrokes)' } },
  { digit: 4, consonants: ['r'], mnemonic: { ko: '4 = r (fouR)', en: '4 = r (fouR)' } },
  { digit: 5, consonants: ['l'], mnemonic: { ko: '5 = L (다섯 손가락)', en: '5 = l (five fingers)' } },
  { digit: 6, consonants: ['j', 'soft g', 'ch', 'sh'], mnemonic: { ko: '6 = j/ch/sh', en: '6 = j/ch/sh' } },
  { digit: 7, consonants: ['k', 'hard c', 'hard g', 'q', 'ng'], mnemonic: { ko: '7 = k/hard-g', en: '7 = k/hard-g' } },
  { digit: 8, consonants: ['f', 'v', 'ph'], mnemonic: { ko: '8 = f/v', en: '8 = f/v' } },
  { digit: 9, consonants: ['p', 'b'], mnemonic: { ko: '9 = p/b (9 의 거울)', en: '9 = p/b (mirror of 9)' } }
];

/** 모음 및 값 없는 글자. */
const FREE = new Set(['a', 'e', 'i', 'o', 'u', 'h', 'w', 'y']);

/** 철자 규칙만으로 복원할 수 없는, 연습 사전에 쓰는 흔한 발음. */
const PHONETIC_OVERRIDES: Readonly<Record<string, string>> = {
  girl: '745',
  ocean: '62',
  pizza: '910'
};

/** soft g(e/i/y 앞)는 6, 그 외 hard g 는 7. */
function isSoftG(word: string, i: number): boolean {
  const next = word[i + 1];
  return next === 'e' || next === 'i' || next === 'y';
}

/** c: e/i/y 앞은 soft(s→0), 그 외 hard(k→7). */
function isSoftC(word: string, i: number): boolean {
  const next = word[i + 1];
  return next === 'e' || next === 'i' || next === 'y';
}

/**
 * 영어 단어 → 숫자열(발음 기반). 순수 함수.
 * digraph(ch/sh/ph/ng/qu/th)와 soft/hard c·g, x(=ks) 를 처리한다.
 */
export function encodeMajor(word: string): string {
  const w = word.toLowerCase();
  const override = PHONETIC_OVERRIDES[w];
  if (override !== undefined) return override;
  let out = '';
  let i = 0;
  let previousSound: string | undefined;
  const push = (d: number, sound: string): void => {
    // 같은 자음 소리가 바로 반복될 때만 한 번 센다(tt→1).
    // 모음으로 떨어진 d…t처럼 숫자 코드만 같은 별도 소리는 각각 센다.
    if (previousSound !== sound) out += String(d);
    previousSound = sound;
  };
  while (i < w.length) {
    const pair = w.slice(i, i + 2);
    const tri = w.slice(i, i + 3);
    // 흔한 묵음 시작 자음(kn/gn/pn/wr)은 소리로 세지 않는다.
    if (i === 0 && (pair === 'kn' || pair === 'gn' || pair === 'pn' || pair === 'wr')) {
      i += 1;
      continue;
    }
    // -ght의 gh는 묵음(light/night/knight).
    if (pair === 'gh' && w[i + 2] === 't') {
      i += 2;
      continue;
    }
    // 3자 음가: tch는 하나의 /ch/ 소리.
    if (tri === 'tch') {
      push(6, 'ch');
      i += 3;
      continue;
    }
    // 2자 digraph
    if (pair === 'ch' || pair === 'sh') {
      push(6, pair);
      i += 2;
      continue;
    }
    if (pair === 'ph') {
      push(8, 'f');
      i += 2;
      continue;
    }
    if (pair === 'ng') {
      push(7, 'ng');
      i += 2;
      continue;
    }
    if (pair === 'qu') {
      push(7, 'k');
      i += 2;
      continue;
    }
    if (pair === 'th') {
      push(1, 'th');
      i += 2;
      continue;
    }
    if (pair === 'ck') {
      push(7, 'k');
      i += 2;
      continue;
    }
    const ch = w[i] ?? '';
    if (FREE.has(ch)) {
      previousSound = undefined;
      i += 1;
      continue;
    }
    if (ch === 'x') {
      push(7, 'k');
      push(0, 's');
      i += 1;
      continue;
    }
    if (ch === 'g') {
      const soft = isSoftG(w, i);
      push(soft ? 6 : 7, soft ? 'j' : 'g');
      i += 1;
      continue;
    }
    if (ch === 'c') {
      if (pair === 'ck') {
        push(7, 'k');
        i += 2;
        continue;
      }
      const soft = isSoftC(w, i);
      push(soft ? 0 : 7, soft ? 's' : 'k');
      i += 1;
      continue;
    }
    // 단일 자음 → 표 직접 조회
    const digit = digitForLetter(ch);
    if (digit !== undefined) push(digit, ch);
    else previousSound = undefined;
    i += 1;
  }
  return out;
}

function digitForLetter(letter: string): number | undefined {
  switch (letter) {
    case 's':
    case 'z':
      return 0;
    case 't':
    case 'd':
      return 1;
    case 'n':
      return 2;
    case 'm':
      return 3;
    case 'r':
      return 4;
    case 'l':
      return 5;
    case 'j':
      return 6;
    case 'k':
    case 'q':
      return 7;
    case 'f':
    case 'v':
      return 8;
    case 'p':
    case 'b':
      return 9;
    default:
      return undefined;
  }
}

/** en Major System 객체. */
export const MAJOR_SYSTEM: MemorySystem = {
  locale: 'en',
  table: EN_TABLE,
  freeLetters: ['a', 'e', 'i', 'o', 'u', 'h', 'w', 'y'],
  encode: encodeMajor
};
