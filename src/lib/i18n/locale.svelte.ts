/**
 * 활성 로케일 = Svelte 5 `$state` 시그널 하나.
 *
 * Paraglide 의 메시지 함수는 호출 시점에 `getLocale()` 을 부른다
 * (생성물: src/lib/paraglide/messages/*.js). 그 `getLocale` 을 아래 시그널 읽기로
 * 갈아끼우면 템플릿 안의 `m.foo()` 가 **자동으로 반응형**이 된다 — 별도 store 구독이나
 * 페이지 리로드가 필요 없다.
 *
 * 로케일의 출처는 프로필 설정(Settings.locale)이다 — PLAN.md §6.2:
 * "언어 설정은 프로필 단위(형제가 서로 다른 언어로 학습 가능)".
 */
import {
  baseLocale,
  isLocale,
  locales,
  overwriteGetLocale,
  overwriteSetLocale,
  type Locale
} from '../paraglide/runtime.js';

let active = $state<Locale>(baseLocale);

overwriteGetLocale(() => active);
overwriteSetLocale((next: Locale) => {
  active = next;
});

/** 지원 로케일 목록 — 로케일 추가는 messages/<code>.json + project.inlang/settings.json 만 만지면 된다. */
export const availableLocales: readonly Locale[] = locales;

/** 폴백 로케일 (= 한국어). 누락 번역은 Paraglide 컴파일러가 여기로 폴백시킨다. */
export const fallbackLocale: Locale = baseLocale;

/** 현재 로케일. 템플릿에서 읽으면 반응형이다. */
export function activeLocale(): Locale {
  return active;
}

/** 앱이 모르는 로케일 문자열(구버전 프로필, 손상된 import 번들)은 baseLocale 로 흡수한다. */
export function normalizeLocale(candidate: string | undefined | null): Locale {
  return typeof candidate === 'string' && isLocale(candidate) ? candidate : baseLocale;
}

/** 프로필 설정에서 읽은 값을 활성화한다. */
export function applyLocale(candidate: string | undefined | null): Locale {
  active = normalizeLocale(candidate);
  return active;
}

export type { Locale };
