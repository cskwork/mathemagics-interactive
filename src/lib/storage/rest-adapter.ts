/**
 * 셀프호스트 모드(Bun + Hono + bun:sqlite) 용 어댑터.
 *
 * **M0 에서는 stub 이다** — 인터페이스만 채우고 모든 호출을 HTTP 로 위임한다.
 * 서버 본체와 왕복 이식 테스트는 M6 (PLAN.md §8). 지금 존재하는 이유는
 * `createAdapter()` 의 런타임 감지 분기를 M0 에서 확정해 두기 위함이다.
 */
import type {
  ExportBundle,
  ImportMode,
  Profile,
  ProgressRecord,
  Settings,
  SrsCard,
  StorageAdapter,
  StorageMode
} from './types.js';

export class RestAdapter implements StorageAdapter {
  readonly mode: StorageMode = 'server';

  constructor(private readonly baseUrl: string) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: { 'content-type': 'application/json' },
      ...init
    });
    if (!res.ok) {
      throw new Error(`${init?.method ?? 'GET'} ${path} failed: ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as T;
  }

  private async send(path: string, method: string, body?: unknown): Promise<void> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    if (!res.ok) {
      throw new Error(`${method} ${path} failed: ${res.status} ${res.statusText}`);
    }
  }

  async init(): Promise<void> {
    // createAdapter() 가 이미 /api/health probe 로 도달성을 확인한 뒤에만 생성한다.
  }

  listProfiles(): Promise<Profile[]> {
    return this.request<Profile[]>('profiles');
  }

  upsertProfile(p: Profile): Promise<void> {
    return this.send('profiles', 'PUT', p);
  }

  deleteProfile(id: string): Promise<void> {
    return this.send(`profiles/${encodeURIComponent(id)}`, 'DELETE');
  }

  getProgress(profileId: string): Promise<ProgressRecord[]> {
    return this.request<ProgressRecord[]>(`progress?profileId=${encodeURIComponent(profileId)}`);
  }

  upsertProgress(r: ProgressRecord): Promise<void> {
    return this.send('progress', 'PUT', r);
  }

  getDueCards(profileId: string, now: number, limit: number): Promise<SrsCard[]> {
    const query = new URLSearchParams({
      profileId,
      now: String(now),
      limit: String(limit)
    });
    return this.request<SrsCard[]>(`srs/due?${query.toString()}`);
  }

  upsertCard(c: SrsCard): Promise<void> {
    return this.send('srs', 'PUT', c);
  }

  async getSettings(profileId: string): Promise<Settings | undefined> {
    const res = await fetch(`${this.baseUrl}settings/${encodeURIComponent(profileId)}`);
    if (res.status === 404) return undefined;
    if (!res.ok) throw new Error(`GET settings failed: ${res.status}`);
    return (await res.json()) as Settings;
  }

  saveSettings(s: Settings): Promise<void> {
    return this.send(`settings/${encodeURIComponent(s.profileId)}`, 'PUT', s);
  }

  exportAll(): Promise<ExportBundle> {
    return this.request<ExportBundle>('export');
  }

  importAll(bundle: ExportBundle, mode: ImportMode): Promise<void> {
    return this.send(`import?mode=${mode}`, 'POST', bundle);
  }
}
