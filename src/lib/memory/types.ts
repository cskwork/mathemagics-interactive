/**
 * 기억술(음성 코드) 공용 타입 — 제7장. PLAN §3.1 트랙 C / §10-2(로케일별 별도 모듈).
 *
 * 핵심 원리(book-content-map §7-1): 숫자 0~9 를 자음(소리/글자)에 대응시키고, 모음은 자유롭게
 * 끼워 넣어 숫자열을 단어로 바꾼다. **단어→숫자는 유일**(복원 가능)이 핵심 불변량이다.
 *
 * 로케일별로 **별도 모듈**(번역이 아님):
 * - `ko`: 한글 자음 매핑 신설계(docs/memory-system-ko.md). 글자(초성·종성) 기반.
 * - `en`: 원서 Major System(음성 기반).
 *
 * 엔진(engine.ts)은 순수 함수로, 두 시스템을 동일 인터페이스로 다룬다.
 */

/** 한 자리 숫자(0~9) 와 그에 대응하는 자음 글자들(소리 또는 글자 기반). */
export interface DigitConsonant {
  readonly digit: number;
  /** 이 숫자에 대응하는 자음(또는 자음군). encode 가 이 집합의 원소를 인식한다. */
  readonly consonants: readonly string[];
  /** 암기 단서(로케일 키 객체). */
  readonly mnemonic: { readonly ko: string; readonly en?: string };
}

/**
 * 로케일별 기억 코드 시스템. encode 는 결정적(같은 단어→항상 같은 숫자열).
 * 역은 성립하지 않는다(한 숫자열→여러 단어 가능 → 사전 탐색 필요).
 */
export interface MemorySystem {
  readonly locale: 'ko' | 'en';
  readonly table: readonly DigitConsonant[];
  /** 숫자값이 없는 자유 글자(모음·h/w/y 등). encode 가 건너뛴다. */
  readonly freeLetters: readonly string[];
  /**
   * 단어 → 숫자열. 결정적·순수 함수.
   * - ko: 한글 음절의 초성·종성 자음 글자를 표에서 찾아 이어 붙인다(글자 기반).
   * - en: 철자를 음성 단위로 묶어 Major System 표에 따라 변환한다(음성 기반).
   */
  encode(word: string): string;
}

/** 사전 한 항목 — 단어와 그 단어가 가리키는 숫자열. */
export interface WordEntry {
  readonly word: string;
  readonly digits: string;
}
