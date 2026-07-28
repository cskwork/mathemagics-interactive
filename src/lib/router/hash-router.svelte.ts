/**
 * 해시 라우터 — 의존성 0, ~60줄.
 *
 * GitHub Pages 에는 SPA 폴백이 없어 history 라우팅 딥링크가 404 가 난다.
 * 404.html 리다이렉트 트릭은 깜빡임이 있고 아이용 앱은 딥링크 SEO 가 필요 없으므로
 * hash routing 이 가장 단순·견고하다 (docs/research/architecture-hosting.md §4.2).
 *
 * 라이브러리(svelte-spa-router)를 쓰지 않은 이유: 필요한 기능이 "해시 문자열 -> 라우트 id"
 * 하나뿐이고, 그 라이브러리의 Svelte 5 runes 호환은 착수 시점 재확인이 필요한 항목으로
 * 리서치 문서에 명시돼 있었다 (architecture-hosting.md "확인하지 않은 것").
 */

/** 라우트 목록. 화면이 늘면 여기에 추가한다(M1: playground 개발용 라우트 추가). */
export const ROUTES = ['profiles', 'home', 'settings', 'playground'] as const;
export type Route = (typeof ROUTES)[number];

export const DEFAULT_ROUTE: Route = 'profiles';

const PATH_TO_ROUTE: Record<string, Route> = {
  '': 'profiles',
  '/': 'profiles',
  '/home': 'home',
  '/settings': 'settings',
  '/dev/playground': 'playground'
};

const ROUTE_TO_PATH: Record<Route, string> = {
  profiles: '/',
  home: '/home',
  settings: '/settings',
  playground: '/dev/playground'
};

/** `#/home?x=1` -> `/home`. 해시가 없거나 모르는 경로면 undefined. */
export function parseHash(hash: string): Route | undefined {
  const withoutHash = hash.startsWith('#') ? hash.slice(1) : hash;
  const path = withoutHash.split('?')[0] ?? '';
  const normalized = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  return PATH_TO_ROUTE[normalized];
}

export function routeToHash(route: Route): string {
  return `#${ROUTE_TO_PATH[route]}`;
}

export interface Router {
  /** 현재 라우트. 템플릿에서 읽으면 반응형이다. */
  current(): Route;
  /** 해시는 있는데 아는 라우트가 아님 (오탈자 링크 등). */
  unknownHash(): boolean;
  navigate(route: Route): void;
  /** hashchange 구독을 시작하고 해제 함수를 돌려준다. */
  start(): () => void;
}

/** 현재 라우트를 들고 있는 반응형 스토어. */
export function createRouter(): Router {
  let current = $state<Route>(DEFAULT_ROUTE);
  let unknown = $state(false);

  function sync(): void {
    const parsed = parseHash(globalThis.location?.hash ?? '');
    unknown = parsed === undefined && (globalThis.location?.hash ?? '').length > 1;
    current = parsed ?? DEFAULT_ROUTE;
  }

  return {
    current: () => current,
    unknownHash: () => unknown,
    navigate(route: Route): void {
      const next = routeToHash(route);
      if (globalThis.location?.hash === next) return;
      globalThis.location.hash = next;
    },
    start(): () => void {
      sync();
      globalThis.addEventListener('hashchange', sync);
      return () => globalThis.removeEventListener('hashchange', sync);
    }
  };
}
