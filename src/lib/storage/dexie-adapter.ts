/**
 * IndexedDB(Dexie.js) 구현 — 정적 호스팅(GitHub Pages) 모드의 기본 저장소.
 *
 * 근거: PLAN.md §6.1 / docs/research/architecture-hosting.md §1.2.
 * localStorage 가 아니라 IndexedDB 인 이유: SRS 카드가 프로필당 수백~수천 행으로 자라고
 * "지금 복습할 카드(due <= now)" 인덱스 질의가 핵심이기 때문.
 */
import Dexie, { type Table } from 'dexie';
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
import { CURRENT_SCHEMA } from './migrations.js';

export const DB_NAME = 'mathemagics';

type MathemagicsDb = Dexie & {
  profiles: Table<Profile, string>;
  progress: Table<ProgressRecord, [string, string]>;
  srsCards: Table<SrsCard, [string, string]>;
  settings: Table<Settings, string>;
};

/**
 * Dexie 스키마. 버전을 올릴 때는 `.version(n).stores(...)` 를 **추가**하고
 * 필요하면 `.upgrade()` 를 붙인다 (기존 version 블록을 수정하지 말 것).
 */
export function createDb(name: string = DB_NAME): MathemagicsDb {
  const db = new Dexie(name) as MathemagicsDb;
  db.version(1).stores({
    profiles: 'id, createdAt',
    progress: '[profileId+skillId], profileId',
    // [profileId+due] 는 getDueCards 의 범위 질의 전용 복합 인덱스
    srsCards: '[profileId+factId], profileId, [profileId+due]',
    settings: 'profileId'
  });
  return db;
}

export class DexieAdapter implements StorageAdapter {
  readonly mode: StorageMode = 'local';
  private readonly db: MathemagicsDb;

  constructor(dbOrName: MathemagicsDb | string = DB_NAME) {
    this.db = typeof dbOrName === 'string' ? createDb(dbOrName) : dbOrName;
  }

  async init(): Promise<void> {
    await this.db.open();
  }

  /** 테스트/프로필 삭제 후 정리를 위해 노출. */
  async close(): Promise<void> {
    this.db.close();
  }

  // --- profiles -------------------------------------------------------------

  listProfiles(): Promise<Profile[]> {
    return this.db.profiles.orderBy('createdAt').toArray();
  }

  async upsertProfile(p: Profile): Promise<void> {
    await this.db.profiles.put(p);
  }

  async deleteProfile(id: string): Promise<void> {
    // cascade — 프로필만 지우고 진도가 남으면 유령 데이터가 export 번들에 섞인다.
    await this.db.transaction(
      'rw',
      this.db.profiles,
      this.db.progress,
      this.db.srsCards,
      this.db.settings,
      async () => {
        await this.db.profiles.delete(id);
        await this.db.progress.where('profileId').equals(id).delete();
        await this.db.srsCards.where('profileId').equals(id).delete();
        await this.db.settings.delete(id);
      }
    );
  }

  // --- progress -------------------------------------------------------------

  getProgress(profileId: string): Promise<ProgressRecord[]> {
    return this.db.progress.where('profileId').equals(profileId).toArray();
  }

  async upsertProgress(r: ProgressRecord): Promise<void> {
    await this.db.progress.put(r);
  }

  // --- spaced repetition ----------------------------------------------------

  getDueCards(profileId: string, now: number, limit: number): Promise<SrsCard[]> {
    return this.db.srsCards
      .where('[profileId+due]')
      .between([profileId, Dexie.minKey], [profileId, now], true, true)
      .limit(limit)
      .toArray();
  }

  async upsertCard(c: SrsCard): Promise<void> {
    await this.db.srsCards.put(c);
  }

  // --- settings -------------------------------------------------------------

  getSettings(profileId: string): Promise<Settings | undefined> {
    return this.db.settings.get(profileId);
  }

  async saveSettings(s: Settings): Promise<void> {
    await this.db.settings.put(s);
  }

  // --- portability ----------------------------------------------------------

  async exportAll(): Promise<ExportBundle> {
    const [profiles, progress, srsCards, settings] = await Promise.all([
      this.db.profiles.toArray(),
      this.db.progress.toArray(),
      this.db.srsCards.toArray(),
      this.db.settings.toArray()
    ]);
    return {
      schemaVersion: CURRENT_SCHEMA,
      exportedAt: Date.now(),
      app: 'mathemagics',
      profiles,
      progress,
      srsCards,
      settings
    };
  }

  async importAll(bundle: ExportBundle, mode: ImportMode): Promise<void> {
    await this.db.transaction(
      'rw',
      this.db.profiles,
      this.db.progress,
      this.db.srsCards,
      this.db.settings,
      async () => {
        if (mode === 'replace') {
          await Promise.all([
            this.db.profiles.clear(),
            this.db.progress.clear(),
            this.db.srsCards.clear(),
            this.db.settings.clear()
          ]);
          await this.db.profiles.bulkPut(bundle.profiles);
          await this.db.progress.bulkPut(bundle.progress);
          await this.db.srsCards.bulkPut(bundle.srsCards);
          await this.db.settings.bulkPut(bundle.settings);
          return;
        }

        // merge — architecture-hosting.md §3.1: 프로필은 id upsert,
        // progress/srs 는 lastPlayedAt / lastReview 가 최신인 쪽이 이긴다 (last-write-wins).
        await this.db.profiles.bulkPut(bundle.profiles);
        await this.db.settings.bulkPut(bundle.settings);

        for (const incoming of bundle.progress) {
          const existing = await this.db.progress.get([incoming.profileId, incoming.skillId]);
          if (!existing || incoming.lastPlayedAt >= existing.lastPlayedAt) {
            await this.db.progress.put(incoming);
          }
        }
        for (const incoming of bundle.srsCards) {
          const existing = await this.db.srsCards.get([incoming.profileId, incoming.factId]);
          if (!existing || incoming.lastReview >= existing.lastReview) {
            await this.db.srsCards.put(incoming);
          }
        }
      }
    );
  }
}
