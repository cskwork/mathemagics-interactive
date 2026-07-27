import { describe, expect, it } from 'vitest';
import {
  CURRENT_SCHEMA,
  migrate,
  NotAMathemagicsBundleError,
  SchemaTooNewError
} from './migrations.js';

const minimal = { app: 'mathemagics', schemaVersion: CURRENT_SCHEMA, exportedAt: 1 };

describe('migrate', () => {
  it('normalises missing collections to empty arrays', () => {
    const bundle = migrate(minimal);
    expect(bundle).toEqual({
      schemaVersion: CURRENT_SCHEMA,
      exportedAt: 1,
      app: 'mathemagics',
      profiles: [],
      progress: [],
      srsCards: [],
      settings: []
    });
  });

  it('rejects anything that is not a mathemagics bundle', () => {
    expect(() => migrate({ app: 'something-else' })).toThrow(NotAMathemagicsBundleError);
    expect(() => migrate(null)).toThrow(NotAMathemagicsBundleError);
    expect(() => migrate([])).toThrow(NotAMathemagicsBundleError);
  });

  it('refuses bundles from a newer app rather than silently dropping fields', () => {
    expect(() => migrate({ ...minimal, schemaVersion: CURRENT_SCHEMA + 1 })).toThrow(SchemaTooNewError);
  });
});
