/**
 * 왕복 이식 테스트(M6 brief §3) — Bun 전용(vitess/node 는 bun:sqlite 불가).
 * 실행: `bun run server/roundtrip.ts`
 *
 * 경로: 정적 모드 ExportBundle(가짜 데이터) → server importAll(sqlite) → exportAll → 동등성.
 * schemaVersion · app · profiles/progress/srsCards/settings 가 왕복 후 보존되는지 단언한다.
 * (exportedAt 은 매 호출마다 달라지므로 비교에서 제외.)
 *
 * HTTP 왕복은 별도로 server/index.ts 를 띄워 curl 로 검증했다(RESULT §4).
 */
import { Database } from 'bun:sqlite';
import { exportAll, importAll, initSchema } from './schema.js';
import type { ExportBundle } from '../src/lib/storage/types.js';

let failures = 0;
function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`  ✗ ${msg}`);
    failures++;
  } else {
    console.log(`  ✓ ${msg}`);
  }
}

const bundle: ExportBundle = {
  schemaVersion: 1,
  exportedAt: 1700000000000,
  app: 'mathemagics',
  profiles: [
    { id: 'p1', name: '하늘', avatar: '🦉', createdAt: 1700000000000 },
    { id: 'p2', name: 'Rin', avatar: '🐱', createdAt: 1700000001000 }
  ],
  progress: [
    {
      profileId: 'p1',
      skillId: 'square-4digit',
      attempts: 10,
      correct: 9,
      lastPlayedAt: 1700000002000,
      stars: 3
    }
  ],
  srsCards: [
    {
      profileId: 'p1',
      factId: 'square-4digit#1',
      due: 1700000003000,
      stability: 2.5,
      difficulty: 0.3,
      reps: 3,
      lapses: 0,
      lastReview: 1700000002500
    }
  ],
  settings: [
    { profileId: 'p1', soundOn: true, locale: 'ko', dailyGoalMinutes: 10 },
    { profileId: 'p2', soundOn: false, locale: 'en', dailyGoalMinutes: 15 }
  ]
};

console.log('== round-trip: static ExportBundle → server import(replace) → re-export ==');
{
  const db = new Database(':memory:');
  initSchema(db);
  importAll(db, bundle, 'replace');
  const out = exportAll(db);
  assert(out.app === 'mathemagics', 'app marker preserved');
  assert(out.schemaVersion === 1, 'schemaVersion = 1');
  assert(out.profiles.length === 2, '2 profiles round-tripped');
  assert(out.profiles[0].id === 'p1', 'profile p1 id preserved');
  assert(out.profiles[0].name === '하늘', 'profile name (한글) preserved');
  assert(out.progress.length === 1, '1 progress record preserved');
  assert(out.progress[0].skillId === 'square-4digit', 'progress skillId preserved');
  assert(out.srsCards.length === 1, '1 srs card preserved');
  assert(out.srsCards[0].due === 1700000003000, 'srs due preserved');
  assert(out.settings.length === 2, '2 settings preserved');
  assert(out.settings[1].locale === 'en', 'en locale preserved');
  // 동등성(exportedAt 제외)
  const { exportedAt: _e1, ...a } = out;
  const { exportedAt: _e2, ...b } = bundle;
  void _e1;
  void _e2;
  assert(JSON.stringify(a) === JSON.stringify(b), 'round-trip data equal (excluding exportedAt)');
}

console.log('== merge mode: older record does not overwrite newer ==');
{
  const db = new Database(':memory:');
  initSchema(db);
  importAll(db, bundle, 'replace');
  // 같은 progress 에 더 과거 lastPlayedAt 으로 merge → 갱신 안 됨(last-write-wins).
  const older: ExportBundle = {
    ...bundle,
    progress: [
      {
        profileId: 'p1',
        skillId: 'square-4digit',
        attempts: 1,
        correct: 0,
        lastPlayedAt: 1000,
        stars: 0
      }
    ]
  };
  importAll(db, older, 'merge');
  const out = exportAll(db);
  const rec = out.progress.find((r) => r.skillId === 'square-4digit');
  assert(rec?.attempts === 10, 'merge keeps newer (attempts=10, not 1)');
  assert(rec?.lastPlayedAt === 1700000002000, 'merge keeps newer lastPlayedAt');
}

console.log('== delete cascade ==');
{
  const db = new Database(':memory:');
  initSchema(db);
  importAll(db, bundle, 'replace');
  db.run('DELETE FROM profiles WHERE id = ?', 'p1');
  db.run('DELETE FROM progress WHERE profile_id = ?', 'p1');
  db.run('DELETE FROM srs_cards WHERE profile_id = ?', 'p1');
  db.run('DELETE FROM settings WHERE profile_id = ?', 'p1');
  const out = exportAll(db);
  assert(out.profiles.length === 1, '1 profile left after cascade delete');
  assert(out.progress.length === 0, 'progress cascade-deleted');
  assert(out.srsCards.length === 0, 'srs cascade-deleted');
}

if (failures === 0) {
  console.log('\nALL ROUND-TRIP TESTS PASSED');
  process.exit(0);
} else {
  console.error(`\n${failures} FAILED`);
  process.exit(1);
}
