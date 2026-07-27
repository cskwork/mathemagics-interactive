/**
 * 어댑터 선택 — 빌드 타임 플래그가 아니라 **런타임 감지**로 한다.
 * 같은 정적 빌드 하나를 GitHub Pages 와 셀프호스트 서버 양쪽에서 그대로 재사용하기 위함.
 * 근거: docs/research/architecture-hosting.md §1.1.
 */
import { DexieAdapter } from './dexie-adapter.js';
import { RestAdapter } from './rest-adapter.js';
import type { StorageAdapter } from './types.js';

export * from './types.js';
export { DexieAdapter } from './dexie-adapter.js';
export { RestAdapter } from './rest-adapter.js';
export { CURRENT_SCHEMA, migrate, NotAMathemagicsBundleError, SchemaTooNewError } from './migrations.js';

/** probe 타임아웃 (ms). 브리프 §2-4 지정값. */
export const HEALTH_PROBE_TIMEOUT_MS = 800;

/**
 * API 루트. Vite `base` 에서 파생시킨다 — 셀프호스트 서버가 정적 빌드를 어떤 경로에
 * 마운트하든 같은 상대 위치(`<base>api/`)에서 API 를 찾게 하기 위함.
 * GitHub Pages 에서는 이 경로가 404 를 내므로 자연히 DexieAdapter 로 폴백된다.
 */
export function apiBaseUrl(base: string = import.meta.env.BASE_URL): string {
  return `${base.endsWith('/') ? base : `${base}/`}api/`;
}

export interface CreateAdapterOptions {
  /** 기본값: `apiBaseUrl()` */
  apiBase?: string;
  timeoutMs?: number;
  /** 테스트 주입용. 기본값: 전역 fetch */
  fetchImpl?: typeof fetch;
}

/**
 * 셀프호스트 서버가 `GET <base>api/health` 에서 돌려줘야 하는 응답 (M6 계약).
 * **status 200 만으로는 부족하다** — `vite preview`/`vite dev` 의 SPA 폴백과
 * 일부 정적 호스트는 없는 경로에도 index.html 을 200 으로 준다. 그래서 본문의
 * 앱 마커까지 확인해야 정적 모드를 서버 모드로 오인하지 않는다.
 */
export interface HealthResponse {
  app: 'mathemagics';
}

async function isOurServer(res: Response): Promise<boolean> {
  if (!res.ok) return false;
  if (!res.headers.get('content-type')?.includes('application/json')) return false;
  try {
    const body: unknown = await res.json();
    return (body as HealthResponse | null)?.app === 'mathemagics';
  } catch {
    return false;
  }
}

/**
 * `<base>api/health` 를 800ms 안에 두드려 보고, 우리 서버가 답하면 RestAdapter,
 * 아니면(정적 호스팅) DexieAdapter 를 돌려준다. `init()` 은 호출자가 한다.
 */
export async function createAdapter(options: CreateAdapterOptions = {}): Promise<StorageAdapter> {
  const apiBase = options.apiBase ?? apiBaseUrl();
  const timeoutMs = options.timeoutMs ?? HEALTH_PROBE_TIMEOUT_MS;
  const doFetch = options.fetchImpl ?? globalThis.fetch;

  if (typeof doFetch === 'function') {
    try {
      const res = await doFetch(`${apiBase}health`, { signal: AbortSignal.timeout(timeoutMs) });
      if (await isOurServer(res)) return new RestAdapter(apiBase);
    } catch {
      // 네트워크 실패 / 타임아웃 / 정적 호스팅 → 로컬 저장
    }
  }
  return new DexieAdapter();
}
