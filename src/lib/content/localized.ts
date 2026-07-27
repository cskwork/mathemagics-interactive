/**
 * 레슨 콘텐츠(내레이션·힌트·전략 카드명)의 로케일 키 규약 — PLAN.md §3.4 / §6.2.
 *
 * M0 에서는 **타입과 해석 함수만** 정의한다 (브리프 §2-6). 실제 콘텐츠는 M2 부터.
 * UI 문자열(Paraglide 컴파일 메시지)과 달리 레슨 콘텐츠는 런타임 JSON 이므로
 * 별도의 폴백 규칙이 필요하다: 요청 로케일 -> `ko` -> 아무거나.
 */
import type { Locale } from '../i18n/locale.svelte.js';

/**
 * 로케일별 텍스트. `ko` 는 필수, 나머지는 선택 — 번역이 없으면 `ko` 로 폴백한다.
 * 숫자·스텝 데이터는 로케일 무관이므로 이 타입을 쓰지 않는다.
 */
export type LocalizedText = { readonly ko: string } & {
  readonly [K in Exclude<Locale, 'ko'>]?: string;
};

/** 로케일 키 객체를 문자열로 해석한다. 누락 시 ko 폴백. */
export function resolveLocalized(text: LocalizedText, locale: Locale): string {
  const candidate = (text as Partial<Record<Locale, string>>)[locale];
  return candidate ?? text.ko;
}
