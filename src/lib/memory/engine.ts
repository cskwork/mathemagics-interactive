/**
 * 기억술 공통 엔진 — 순수 함수. 두 로케일 시스템(ko/en) 을 동일 인터페이스로 다룬다.
 *
 * 두 핵심 연산(PLAN §10-2):
 * - {@link encodeWordToDigits}: 단어 → 숫자열(결정적·유일). 시스템.encode 에 위임.
 * - {@link findWordsForDigits}: 숫자열 → 단어 후보(사전 탐색, 여럿 가능).
 *
 * 사전은 content/memory/{ko,en}-words.json (아동 어휘). 사전 항목은 `digits` 값을 직접 들어
 * 인코더의 미세한 음성 판단에 영향받지 않는다(미리 encode 해 저장).
 */
import type { MemorySystem, WordEntry } from './types.js';
import { KOREAN_SYSTEM } from './korean-ko.js';
import { MAJOR_SYSTEM } from './major-en.js';

/** 단어 → 숫자열. 시스템.encode 로 위임(결정적). */
export function encodeWordToDigits(word: string, system: MemorySystem): string {
  return system.encode(word);
}

/** 숫자열 → 단어 후보(사전에서 정확히 일치하는 digits). 길이순·알파벳순 정렬. */
export function findWordsForDigits(
  digits: string,
  dictionary: readonly WordEntry[]
): WordEntry[] {
  return dictionary
    .filter((e) => e.digits === digits)
    .sort((a, b) => a.word.length - b.word.length || a.word.localeCompare(b.word));
}

/** 단어가 encode 결과가 digits 와 일치하는지 검증(순수). */
export function verifyWord(word: string, digits: string, system: MemorySystem): boolean {
  return encodeWordToDigits(word, system) === digits;
}

// ── 사전 로드(eager: 부팅 시 한 번) ────────────────────────────────────────────

const koModules = import.meta.glob<{ default: WordEntry[] }>('/content/memory/ko-words.json', {
  eager: true
});
const enModules = import.meta.glob<{ default: WordEntry[] }>('/content/memory/en-words.json', {
  eager: true
});

/** ko 아동 어휘 사전. */
export const KO_DICTIONARY: readonly WordEntry[] = koModules['/content/memory/ko-words.json']?.default ?? [];
/** en 사전. */
export const EN_DICTIONARY: readonly WordEntry[] = enModules['/content/memory/en-words.json']?.default ?? [];

/** 로케일 → 기억 코드 시스템. */
export function systemForLocale(locale: 'ko' | 'en'): MemorySystem {
  return locale === 'ko' ? KOREAN_SYSTEM : MAJOR_SYSTEM;
}
