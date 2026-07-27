/**
 * StorageAdapter 계약 테스트.
 *
 * 여기 있는 기대치는 **인터페이스의 계약**이지 Dexie 의 구현 디테일이 아니다.
 * M6 에서 RestAdapter 가 실제 구현되면 같은 스위트를 그쪽에도 돌릴 수 있도록
 * `runStorageAdapterContract(factory)` 형태로 분리해 두었다.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { DexieAdapter } from './dexie-adapter.js';
import { CURRENT_SCHEMA } from './migrations.js';
import type { Profile, ProgressRecord, Settings, SrsCard, StorageAdapter } from './types.js';

let counter = 0;
const opened: DexieAdapter[] = [];

async function freshAdapter(): Promise<DexieAdapter> {
  counter += 1;
  const adapter = new DexieAdapter(`mathemagics-test-${counter}`);
  await adapter.init();
  opened.push(adapter);
  return adapter;
}

afterEach(async () => {
  await Promise.all(opened.splice(0).map((a) => a.close()));
});

function profile(id: string, name = id): Profile {
  return { id, name, avatar: '🐧', createdAt: 1_700_000_000_000 };
}

function progress(profileId: string, skillId: string, lastPlayedAt: number): ProgressRecord {
  return { profileId, skillId, attempts: 1, correct: 1, lastPlayedAt, stars: 1 };
}

function card(profileId: string, factId: string, due: number, lastReview = 0): SrsCard {
  return { profileId, factId, due, stability: 1, difficulty: 5, reps: 1, lapses: 0, lastReview };
}

function settings(profileId: string, locale: string): Settings {
  return { profileId, soundOn: true, locale, dailyGoalMinutes: 10 };
}

describe('DexieAdapter — profiles', () => {
  it('upsert -> list roundtrips and stays sorted by createdAt', async () => {
    const a = await freshAdapter();
    await a.upsertProfile({ ...profile('b'), createdAt: 2 });
    await a.upsertProfile({ ...profile('a'), createdAt: 1 });

    expect((await a.listProfiles()).map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('upsert with an existing id updates rather than duplicating', async () => {
    const a = await freshAdapter();
    await a.upsertProfile(profile('p1', 'before'));
    await a.upsertProfile(profile('p1', 'after'));

    const all = await a.listProfiles();
    expect(all).toHaveLength(1);
    expect(all[0]?.name).toBe('after');
  });

  it('deleteProfile cascades to progress, srs cards and settings', async () => {
    const a = await freshAdapter();
    await a.upsertProfile(profile('p1'));
    await a.upsertProfile(profile('p2'));
    await a.upsertProgress(progress('p1', 'add-ltr', 10));
    await a.upsertProgress(progress('p2', 'add-ltr', 10));
    await a.upsertCard(card('p1', '7x8', 0));
    await a.upsertCard(card('p2', '7x8', 0));
    await a.saveSettings(settings('p1', 'ko'));
    await a.saveSettings(settings('p2', 'en'));

    await a.deleteProfile('p1');

    expect(await a.getProgress('p1')).toEqual([]);
    expect(await a.getDueCards('p1', Date.now(), 10)).toEqual([]);
    expect(await a.getSettings('p1')).toBeUndefined();
    // 남의 프로필은 건드리지 않는다
    expect(await a.getProgress('p2')).toHaveLength(1);
    expect(await a.getSettings('p2')).toBeDefined();
  });
});

describe('DexieAdapter — srs due query', () => {
  it('returns only this profile cards with due <= now, honouring the limit', async () => {
    const a = await freshAdapter();
    const now = 1_000;
    await a.upsertCard(card('p1', 'a', 100));
    await a.upsertCard(card('p1', 'b', 999));
    await a.upsertCard(card('p1', 'c', 1_000)); // 경계값 포함
    await a.upsertCard(card('p1', 'd', 1_001)); // 미래 — 제외
    await a.upsertCard(card('p2', 'e', 100)); // 다른 프로필 — 제외

    const due = await a.getDueCards('p1', now, 10);
    expect(due.map((c) => c.factId).sort()).toEqual(['a', 'b', 'c']);

    expect(await a.getDueCards('p1', now, 2)).toHaveLength(2);
  });
});

describe('DexieAdapter — settings', () => {
  it('returns undefined for an unknown profile and roundtrips after save', async () => {
    const a = await freshAdapter();
    expect(await a.getSettings('nobody')).toBeUndefined();

    await a.saveSettings(settings('p1', 'en'));
    expect((await a.getSettings('p1'))?.locale).toBe('en');
  });
});

describe('DexieAdapter — portability', () => {
  it('exportAll stamps the current schema version and captures every table', async () => {
    const a = await freshAdapter();
    await a.upsertProfile(profile('p1'));
    await a.upsertProgress(progress('p1', 'add-ltr', 5));
    await a.upsertCard(card('p1', '7x8', 5));
    await a.saveSettings(settings('p1', 'ko'));

    const bundle = await a.exportAll();
    expect(bundle.app).toBe('mathemagics');
    expect(bundle.schemaVersion).toBe(CURRENT_SCHEMA);
    expect(bundle.profiles).toHaveLength(1);
    expect(bundle.progress).toHaveLength(1);
    expect(bundle.srsCards).toHaveLength(1);
    expect(bundle.settings).toHaveLength(1);
  });

  it('import "replace" wipes what was there first', async () => {
    const a = await freshAdapter();
    await a.upsertProfile(profile('old'));

    await a.importAll(
      {
        schemaVersion: CURRENT_SCHEMA,
        exportedAt: 0,
        app: 'mathemagics',
        profiles: [profile('new')],
        progress: [],
        srsCards: [],
        settings: []
      },
      'replace'
    );

    expect((await a.listProfiles()).map((p) => p.id)).toEqual(['new']);
  });

  it('import "merge" keeps the newer record on both sides (last-write-wins)', async () => {
    const a: StorageAdapter = await freshAdapter();
    await a.upsertProgress(progress('p1', 'add-ltr', 200));
    await a.upsertProgress(progress('p1', 'sub-ltr', 100));
    await a.upsertCard(card('p1', '7x8', 0, 200));

    await a.importAll(
      {
        schemaVersion: CURRENT_SCHEMA,
        exportedAt: 0,
        app: 'mathemagics',
        profiles: [profile('p1')],
        progress: [
          { ...progress('p1', 'add-ltr', 100), stars: 3 }, // 더 오래됨 -> 무시
          { ...progress('p1', 'sub-ltr', 300), stars: 3 } // 더 최신 -> 승리
        ],
        srsCards: [{ ...card('p1', '7x8', 42, 100) }], // 더 오래됨 -> 무시
        settings: []
      },
      'merge'
    );

    const merged = await a.getProgress('p1');
    expect(merged.find((r) => r.skillId === 'add-ltr')?.stars).toBe(1);
    expect(merged.find((r) => r.skillId === 'sub-ltr')?.stars).toBe(3);

    const cards = await a.getDueCards('p1', 1_000, 10);
    expect(cards[0]?.due).toBe(0);
  });
});
