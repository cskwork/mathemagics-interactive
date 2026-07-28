/**
 * 서버 SQLite 스키마 + 마이그레이션 — ExportBundle(CURRENT_SCHEMA=1) 과 정합.
 *
 * 설계: 각 테이블은 인덱스가 필요한 필드(profileId, due, skillId, factId)를 칼럼으로 두고,
 * 전체 레코드는 JSON 블롭(data 컬럼)에 저장한다. 스키마 버전은 meta 테이블에 기록한다
 * (architecture-hosting.md §3.2 — JSON 번들 마이그레이션과 같은 버전 번호).
 *
 * 이 모듈은 db 를 인자로 받아 DDL/CRUD 를 수행한다. Hono 핸들러(server/index.ts) 와
 * 왕복 이식 테스트(server/roundtrip.ts) 양쪽에서 재사용한다.
 *
 * bun:sqlite API: db.run(sql, ...params) · db.prepare(sql).get/all(params) · db.query(sql) prepared.
 */
import type { Database } from 'bun:sqlite';
import type {
  ExportBundle,
  ImportMode,
  Profile,
  ProgressRecord,
  Settings,
  SrsCard
} from '../src/lib/storage/types.js';

/** 서버 DB 스키마 버전 — ExportBundle 의 CURRENT_SCHEMA 와 같아야 한다. */
export const SERVER_SCHEMA_VERSION = 1;

/** 테이블 생성(idempotent). 기존 DB 열 때도 안전. */
export function initSchema(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      data TEXT NOT NULL
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS progress (
      profile_id TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      last_played_at INTEGER NOT NULL,
      data TEXT NOT NULL,
      PRIMARY KEY (profile_id, skill_id)
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS srs_cards (
      profile_id TEXT NOT NULL,
      fact_id TEXT NOT NULL,
      due INTEGER NOT NULL,
      last_review INTEGER NOT NULL,
      data TEXT NOT NULL,
      PRIMARY KEY (profile_id, fact_id)
    );
    CREATE INDEX IF NOT EXISTS idx_srs_due ON srs_cards (profile_id, due);
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      profile_id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );
  `);
  db.run('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);');

  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get('schema_version') as
    | { value?: string }
    | null;
  const current = row?.value ? Number(row.value) : 0;
  if (current < SERVER_SCHEMA_VERSION) {
    db.run(
      'INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)',
      'schema_version',
      String(SERVER_SCHEMA_VERSION)
    );
  }
}

// ── CRUD (StorageAdapter 계약과 1:1) ─────────────────────────────────────────────

export function listProfiles(db: Database): Profile[] {
  const rows = db.prepare('SELECT data FROM profiles ORDER BY created_at ASC').all() as {
    data: string;
  }[];
  return rows.map((r) => JSON.parse(r.data) as Profile);
}

export function upsertProfile(db: Database, p: Profile): void {
  db.run(
    'INSERT OR REPLACE INTO profiles (id, created_at, data) VALUES (?, ?, ?)',
    p.id,
    p.createdAt,
    JSON.stringify(p)
  );
}

export function deleteProfile(db: Database, id: string): void {
  // cascade — profile 과 그 진도/srs/settings 모두 삭제.
  db.run('DELETE FROM profiles WHERE id = ?', id);
  db.run('DELETE FROM progress WHERE profile_id = ?', id);
  db.run('DELETE FROM srs_cards WHERE profile_id = ?', id);
  db.run('DELETE FROM settings WHERE profile_id = ?', id);
}

export function getProgress(db: Database, profileId: string): ProgressRecord[] {
  const rows = db.prepare('SELECT data FROM progress WHERE profile_id = ?').all(profileId) as {
    data: string;
  }[];
  return rows.map((r) => JSON.parse(r.data) as ProgressRecord);
}

export function upsertProgress(db: Database, r: ProgressRecord): void {
  db.run(
    'INSERT OR REPLACE INTO progress (profile_id, skill_id, last_played_at, data) VALUES (?, ?, ?, ?)',
    r.profileId,
    r.skillId,
    r.lastPlayedAt,
    JSON.stringify(r)
  );
}

export function getDueCards(db: Database, profileId: string, now: number, limit: number): SrsCard[] {
  const rows = db
    .prepare('SELECT data FROM srs_cards WHERE profile_id = ? AND due <= ? ORDER BY due ASC LIMIT ?')
    .all(profileId, now, limit) as { data: string }[];
  return rows.map((r) => JSON.parse(r.data) as SrsCard);
}

export function upsertCard(db: Database, c: SrsCard): void {
  db.run(
    'INSERT OR REPLACE INTO srs_cards (profile_id, fact_id, due, last_review, data) VALUES (?, ?, ?, ?, ?)',
    c.profileId,
    c.factId,
    c.due,
    c.lastReview,
    JSON.stringify(c)
  );
}

export function getSettings(db: Database, profileId: string): Settings | undefined {
  const row = db.prepare('SELECT data FROM settings WHERE profile_id = ?').get(profileId) as
    | { data: string }
    | null;
  return row ? (JSON.parse(row.data) as Settings) : undefined;
}

export function saveSettings(db: Database, s: Settings): void {
  db.run('INSERT OR REPLACE INTO settings (profile_id, data) VALUES (?, ?)', s.profileId, JSON.stringify(s));
}

// ── export / import (ExportBundle = 두 모드의 공용 통화) ──────────────────────────

export function exportAll(db: Database): ExportBundle {
  const pRows = db.prepare('SELECT data FROM progress').all() as { data: string }[];
  const sRows = db.prepare('SELECT data FROM srs_cards').all() as { data: string }[];
  const tRows = db.prepare('SELECT data FROM settings').all() as { data: string }[];
  return {
    schemaVersion: SERVER_SCHEMA_VERSION,
    exportedAt: Date.now(),
    app: 'mathemagics',
    profiles: listProfiles(db),
    progress: pRows.map((r) => JSON.parse(r.data) as ProgressRecord),
    srsCards: sRows.map((r) => JSON.parse(r.data) as SrsCard),
    settings: tRows.map((r) => JSON.parse(r.data) as Settings)
  };
}

export function importAll(db: Database, bundle: ExportBundle, mode: ImportMode): void {
  db.run('BEGIN');
  try {
    if (mode === 'replace') {
      db.run('DELETE FROM profiles');
      db.run('DELETE FROM progress');
      db.run('DELETE FROM srs_cards');
      db.run('DELETE FROM settings');
      for (const p of bundle.profiles) upsertProfile(db, p);
      for (const r of bundle.progress) upsertProgress(db, r);
      for (const c of bundle.srsCards) upsertCard(db, c);
      for (const s of bundle.settings) saveSettings(db, s);
    } else {
      // merge — last-write-wins (architecture-hosting.md §3.1)
      for (const p of bundle.profiles) upsertProfile(db, p);
      for (const s of bundle.settings) saveSettings(db, s);
      for (const incoming of bundle.progress) {
        const existing = db
          .prepare('SELECT data FROM progress WHERE profile_id = ? AND skill_id = ?')
          .get(incoming.profileId, incoming.skillId) as { data: string } | null;
        if (!existing || incoming.lastPlayedAt >= JSON.parse(existing.data).lastPlayedAt) {
          upsertProgress(db, incoming);
        }
      }
      for (const incoming of bundle.srsCards) {
        const existing = db
          .prepare('SELECT data FROM srs_cards WHERE profile_id = ? AND fact_id = ?')
          .get(incoming.profileId, incoming.factId) as { data: string } | null;
        if (!existing || incoming.lastReview >= JSON.parse(existing.data).lastReview) {
          upsertCard(db, incoming);
        }
      }
    }
    db.run('COMMIT');
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
}
