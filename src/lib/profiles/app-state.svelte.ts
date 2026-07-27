/**
 * 앱 전역 상태 — 어댑터 1개 + 프로필 목록 + 활성 프로필 + 그 프로필의 설정.
 *
 * 저장소 호출을 컴포넌트에서 직접 하지 않고 여기로 모은다: 프로필 전환 시
 * "설정 로드 -> 로케일 적용 -> localStorage 에 lastProfileId 기록" 이 항상 같이 일어나야 하기 때문.
 */
import { applyLocale, fallbackLocale, normalizeLocale, type Locale } from '../i18n/locale.svelte.js';
import { createAdapter } from '../storage/index.js';
import { requestPersistentStorage, type PersistenceState } from '../storage/persistence.js';
import type { Profile, Settings, StorageAdapter, StorageMode } from '../storage/types.js';
import { readLastProfileId, writeLastProfileId } from './last-profile.js';

export function defaultSettings(profileId: string): Settings {
  return { profileId, soundOn: true, locale: fallbackLocale, dailyGoalMinutes: 10 };
}

function newId(): string {
  // crypto.randomUUID 는 secure context 전용 — GitHub Pages(HTTPS)와 localhost 는 충족하지만
  // LAN IP 로 접근하는 셀프호스트 모드는 아닐 수 있어 폴백을 둔다.
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createAppState(): AppState {
  return new AppState();
}

export class AppState {
  #adapter: StorageAdapter | undefined;
  #ready = $state(false);
  #mode = $state<StorageMode>('local');
  #persistence = $state<PersistenceState>('unsupported');
  #profiles = $state<Profile[]>([]);
  #activeId = $state<string | undefined>(undefined);
  #settings = $state<Settings | undefined>(undefined);

  ready(): boolean {
    return this.#ready;
  }
  storageMode(): StorageMode {
    return this.#mode;
  }
  persistence(): PersistenceState {
    return this.#persistence;
  }
  profiles(): readonly Profile[] {
    return this.#profiles;
  }
  activeProfile(): Profile | undefined {
    return this.#profiles.find((p) => p.id === this.#activeId);
  }
  settings(): Settings | undefined {
    return this.#settings;
  }

  async boot(): Promise<void> {
    const adapter = await createAdapter();
    await adapter.init();
    this.#adapter = adapter;
    this.#mode = adapter.mode;
    this.#persistence = await requestPersistentStorage();
    await this.refreshProfiles();

    const last = readLastProfileId();
    if (last && this.#profiles.some((p) => p.id === last)) {
      await this.selectProfile(last);
    }
    this.#ready = true;
  }

  private adapter(): StorageAdapter {
    if (!this.#adapter) throw new Error('AppState.boot() has not completed');
    return this.#adapter;
  }

  private async refreshProfiles(): Promise<void> {
    this.#profiles = await this.adapter().listProfiles();
  }

  async selectProfile(id: string): Promise<void> {
    this.#activeId = id;
    writeLastProfileId(id);
    const stored = await this.adapter().getSettings(id);
    const settings = stored ?? defaultSettings(id);
    if (!stored) await this.adapter().saveSettings(settings);
    this.#settings = settings;
    applyLocale(settings.locale);
  }

  clearActiveProfile(): void {
    this.#activeId = undefined;
    this.#settings = undefined;
    writeLastProfileId(undefined);
    applyLocale(fallbackLocale);
  }

  async createProfile(name: string, avatar: string): Promise<Profile> {
    const profile: Profile = {
      id: newId(),
      name: name.trim(),
      avatar,
      createdAt: Date.now()
    };
    await this.adapter().upsertProfile(profile);
    await this.adapter().saveSettings(defaultSettings(profile.id));
    await this.refreshProfiles();
    return profile;
  }

  async renameProfile(id: string, name: string): Promise<void> {
    const existing = this.#profiles.find((p) => p.id === id);
    if (!existing) return;
    await this.adapter().upsertProfile({ ...existing, name: name.trim() });
    await this.refreshProfiles();
  }

  async deleteProfile(id: string): Promise<void> {
    await this.adapter().deleteProfile(id);
    if (this.#activeId === id) this.clearActiveProfile();
    await this.refreshProfiles();
  }

  /** 언어 스위처. 설정은 프로필 단위이므로 저장 대상도 활성 프로필의 Settings 이다. */
  async setLocale(locale: Locale): Promise<void> {
    const current = this.#settings;
    if (!current) {
      applyLocale(locale);
      return;
    }
    const next: Settings = { ...current, locale: normalizeLocale(locale) };
    await this.adapter().saveSettings(next);
    this.#settings = next;
    applyLocale(next.locale);
  }

  async updateSettings(patch: Partial<Omit<Settings, 'profileId'>>): Promise<void> {
    const current = this.#settings;
    if (!current) return;
    const next: Settings = { ...current, ...patch };
    await this.adapter().saveSettings(next);
    this.#settings = next;
    applyLocale(next.locale);
  }
}
