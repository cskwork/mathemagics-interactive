import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Profile, Settings } from '../storage/types.js';

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  saveSettings: vi.fn(async () => undefined)
}));

const profiles: Profile[] = [
  { id: 'p1', name: 'One', avatar: 'star', createdAt: 1 },
  { id: 'p2', name: 'Two', avatar: 'moon', createdAt: 2 }
];

vi.mock('../storage/index.js', () => ({
  createAdapter: vi.fn(async () => ({
    mode: 'local',
    init: async () => undefined,
    listProfiles: async () => profiles,
    getSettings: mocks.getSettings,
    saveSettings: mocks.saveSettings
  }))
}));

vi.mock('../storage/persistence.js', () => ({
  requestPersistentStorage: vi.fn(async () => 'unsupported')
}));

import { createAppState } from './app-state.svelte.js';

function settings(profileId: string, locale: 'ko' | 'en'): Settings {
  return { profileId, locale, soundOn: true, dailyGoalMinutes: 10 };
}

describe('AppState profile selection', () => {
  beforeEach(() => {
    mocks.getSettings.mockReset();
    mocks.saveSettings.mockClear();
  });

  it('keeps the latest profile when an earlier settings read resolves last', async () => {
    let resolveFirst!: (value: Settings) => void;
    mocks.getSettings.mockImplementation((id: string) => {
      if (id === 'p1') return new Promise<Settings>((resolve) => { resolveFirst = resolve; });
      return Promise.resolve(settings('p2', 'en'));
    });

    const app = createAppState();
    await app.boot();
    const first = app.selectProfile('p1');
    const second = app.selectProfile('p2');

    await second;
    resolveFirst(settings('p1', 'ko'));
    await first;

    expect(app.activeProfile()?.id).toBe('p2');
    expect(app.settings()?.profileId).toBe('p2');
    expect(app.settings()?.locale).toBe('en');
  });
});
