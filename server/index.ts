/**
 * 셀프호스트 모드 단일 파일 서버 — Bun + Hono + bun:sqlite.
 *
 * 정적 빌드(dist/) 서빙 + REST API(StorageAdapter 계약과 1:1) + /api/health probe 계약.
 * 근거: PLAN §6.1 / docs/research/architecture-hosting.md §2b / docs/self-host.md.
 *
 * 실행: `bun run server/index.ts`  (또는 `bun run server` — package.json server 스크립트)
 *   환경변수: PORT(기본 3000) · DB_PATH(기본 ./server/data.sqlite) · STATIC_DIR(기본 ./dist)
 *
 * /api/health 계약(M0 확정, PLAN §6.1): JSON `{app:"mathemagics", version}` 를
 * content-type: application/json 으로 반환. probe 는 status + json + app 마커 3조건을 검사한다.
 */
import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  deleteProfile,
  exportAll,
  getDueCards,
  getProgress,
  getSettings,
  importAll,
  initSchema,
  listProfiles,
  saveSettings,
  upsertCard,
  upsertProfile,
  upsertProgress
} from './schema.js';
import type { ExportBundle, ImportMode, Profile, ProgressRecord, SrsCard, Settings } from '../src/lib/storage/types.js';

const PORT = Number(process.env.PORT ?? 3000);
const DB_PATH = process.env.DB_PATH ?? resolve(process.cwd(), 'server/data.sqlite');
const STATIC_DIR = process.env.STATIC_DIR ?? resolve(process.cwd(), 'dist');
// Vite base 와 동일(정적 자산 마운트 경로). 기본값은 vite.config.ts 의 BASE.
const BASE = process.env.BASE_PATH ?? '/mathemagics-interactive/';

// DB 디렉터리 보장.
mkdirSync(dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.run('PRAGMA journal_mode = WAL;');
initSchema(db);

const VERSION = '0.0.0';

const app = new Hono();

// ── /api/health (M0 probe 계약) ─────────────────────────────────────────────────
app.get(`${BASE}api/health`, (c) =>
  c.json({ app: 'mathemagics', version: VERSION } satisfies { app: 'mathemagics'; version: string })
);

// ── profiles ────────────────────────────────────────────────────────────────────
app.get(`${BASE}api/profiles`, (c) => c.json(listProfiles(db)));
app.put(`${BASE}api/profiles`, async (c) => {
  const p = (await c.req.json()) as Profile;
  upsertProfile(db, p);
  return c.json({ ok: true });
});
app.delete(`${BASE}api/profiles/:id`, (c) => {
  deleteProfile(db, c.req.param('id'));
  return c.json({ ok: true });
});

// ── progress ────────────────────────────────────────────────────────────────────
app.get(`${BASE}api/progress`, (c) => {
  const profileId = c.req.query('profileId') ?? '';
  return c.json(getProgress(db, profileId));
});
app.put(`${BASE}api/progress`, async (c) => {
  const r = (await c.req.json()) as ProgressRecord;
  upsertProgress(db, r);
  return c.json({ ok: true });
});

// ── srs ─────────────────────────────────────────────────────────────────────────
app.get(`${BASE}api/srs/due`, (c) => {
  const profileId = c.req.query('profileId') ?? '';
  const now = Number(c.req.query('now') ?? Date.now());
  const limit = Number(c.req.query('limit') ?? 200);
  return c.json(getDueCards(db, profileId, now, limit));
});
app.put(`${BASE}api/srs`, async (c) => {
  const card = (await c.req.json()) as SrsCard;
  upsertCard(db, card);
  return c.json({ ok: true });
});

// ── settings ────────────────────────────────────────────────────────────────────
app.get(`${BASE}api/settings/:profileId`, (c) => {
  const s = getSettings(db, c.req.param('profileId'));
  return s ? c.json(s) : c.json({ error: 'not found' }, 404);
});
app.put(`${BASE}api/settings/:profileId`, async (c) => {
  const s = (await c.req.json()) as Settings;
  saveSettings(db, s);
  return c.json({ ok: true });
});

// ── export / import ─────────────────────────────────────────────────────────────
app.get(`${BASE}api/export`, (c) => c.json(exportAll(db)));
app.post(`${BASE}api/import`, async (c) => {
  const bundle = (await c.req.json()) as ExportBundle;
  const mode = (c.req.query('mode') ?? 'merge') as ImportMode;
  importAll(db, bundle, mode);
  return c.json({ ok: true });
});

// ── 정적 빌드 서빙(SPA). API 이외 경로는 dist/ 로. ────────────────────────────────
app.use(`${BASE}*`, serveStatic({ root: STATIC_DIR, rewriteRequestPath: (p) => p.replace(BASE, '/') }));
// 루트 → base 리다이렉트(vite preview 와 동일 동작).
app.get('/', (c) => c.redirect(BASE));

export default {
  port: PORT,
  fetch: app.fetch
};

console.log(`mathemagics self-host server → http://localhost:${PORT}${BASE}`);
console.log(`  db:    ${DB_PATH}`);
console.log(`  dist:  ${STATIC_DIR}`);
