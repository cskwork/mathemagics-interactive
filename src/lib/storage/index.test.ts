/**
 * createAdapter() 런타임 감지 — 정적 호스팅에서 로컬로 폴백하는 것이 M0 의 핵심 계약이다.
 */
import { describe, expect, it, vi } from 'vitest';
import { apiBaseUrl, createAdapter, HEALTH_PROBE_TIMEOUT_MS } from './index.js';
import { DexieAdapter } from './dexie-adapter.js';
import { RestAdapter } from './rest-adapter.js';

const API = '/mathemagics-interactive/api/';

describe('apiBaseUrl', () => {
  it('derives the api root from the vite base path', () => {
    expect(apiBaseUrl('/mathemagics-interactive/')).toBe(API);
  });

  it('tolerates a base without a trailing slash', () => {
    expect(apiBaseUrl('/app')).toBe('/app/api/');
  });
});

describe('createAdapter', () => {
  const JSON_HEADERS = { 'content-type': 'application/json' };

  it('uses RestAdapter when the health probe answers with our app marker', async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ app: 'mathemagics' }), { status: 200, headers: JSON_HEADERS })
    );

    const adapter = await createAdapter({ apiBase: API, fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(adapter).toBeInstanceOf(RestAdapter);
    expect(adapter.mode).toBe('server');
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${API}health`);
  });

  it('falls back to DexieAdapter when a 200 is really an SPA fallback (vite preview, some static hosts)', async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response('<!doctype html><html></html>', {
          status: 200,
          headers: { 'content-type': 'text/html' }
        })
    );

    const adapter = await createAdapter({ apiBase: API, fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(adapter).toBeInstanceOf(DexieAdapter);
  });

  it('falls back to DexieAdapter when the JSON body is not our health payload', async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ status: 'ok' }), { status: 200, headers: JSON_HEADERS })
    );

    const adapter = await createAdapter({ apiBase: API, fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(adapter).toBeInstanceOf(DexieAdapter);
  });

  it('falls back to DexieAdapter on a 404 (GitHub Pages serves its 404 page)', async () => {
    const fetchImpl = vi.fn(async () => new Response('not found', { status: 404 }));

    const adapter = await createAdapter({ apiBase: API, fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(adapter).toBeInstanceOf(DexieAdapter);
    expect(adapter.mode).toBe('local');
  });

  it('falls back to DexieAdapter when the probe rejects (offline / no server)', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });

    const adapter = await createAdapter({ apiBase: API, fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(adapter).toBeInstanceOf(DexieAdapter);
  });

  it('falls back to DexieAdapter when the probe exceeds the timeout', async () => {
    const fetchImpl = vi.fn(
      (_input: unknown, init?: { signal?: AbortSignal }) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'TimeoutError')));
        })
    );

    const adapter = await createAdapter({
      apiBase: API,
      timeoutMs: 20,
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    expect(adapter).toBeInstanceOf(DexieAdapter);
  });

  it('keeps the documented 800ms probe budget', () => {
    expect(HEALTH_PROBE_TIMEOUT_MS).toBe(800);
  });
});
