/**
 * ExportBundle 스키마 마이그레이션.
 *
 * 근거: docs/research/architecture-hosting.md §3.2.
 * 어댑터(Dexie/REST)와 무관하게 **여기 한 곳에서만** 번들을 승급시킨다.
 * 원칙: (1) 앞으로만 마이그레이션 — 다운그레이드 없음, 신버전 번들은 명확히 거부.
 *       (2) 필드 추가는 optional + 기본값으로 흡수해 마이그레이션 수를 최소화.
 */
import type { ExportBundle } from './types.js';

/** 현재 앱이 쓰는 번들 스키마 버전. */
export const CURRENT_SCHEMA = 1;

/** vN 번들 -> vN+1 번들. */
type Migration = (bundle: Record<string, unknown>) => Record<string, unknown>;

/**
 * 키 = 출발 버전. 예: `1: (b) => ...` 은 v1 -> v2 변환.
 * M0 시점에는 스키마가 v1 하나뿐이라 비어 있다.
 */
const migrations: Record<number, Migration> = {};

export class SchemaTooNewError extends Error {
  constructor(
    readonly found: number,
    readonly supported: number
  ) {
    super(`Bundle schemaVersion ${found} is newer than supported ${supported}`);
    this.name = 'SchemaTooNewError';
  }
}

export class NotAMathemagicsBundleError extends Error {
  constructor() {
    super('Not a mathemagics export bundle');
    this.name = 'NotAMathemagicsBundleError';
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new NotAMathemagicsBundleError();
  }
  return value as Record<string, unknown>;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * 임의의 JSON 을 현재 스키마의 ExportBundle 로 승급시킨다.
 * @throws {NotAMathemagicsBundleError} 앱 마커가 없을 때
 * @throws {SchemaTooNewError} 구버전 앱이 신버전 번들을 만났을 때
 */
export function migrate(raw: unknown): ExportBundle {
  let bundle = asRecord(raw);
  if (bundle['app'] !== 'mathemagics') throw new NotAMathemagicsBundleError();

  const declared = bundle['schemaVersion'];
  let version = typeof declared === 'number' && Number.isFinite(declared) ? declared : 1;
  if (version > CURRENT_SCHEMA) throw new SchemaTooNewError(version, CURRENT_SCHEMA);

  while (version < CURRENT_SCHEMA) {
    const step = migrations[version];
    if (!step) throw new Error(`Missing migration from schemaVersion ${version}`);
    bundle = step(bundle);
    version += 1;
  }

  const exportedAt = bundle['exportedAt'];
  return {
    schemaVersion: CURRENT_SCHEMA,
    exportedAt: typeof exportedAt === 'number' ? exportedAt : Date.now(),
    app: 'mathemagics',
    profiles: asArray(bundle['profiles']),
    progress: asArray(bundle['progress']),
    srsCards: asArray(bundle['srsCards']),
    settings: asArray(bundle['settings'])
  };
}
