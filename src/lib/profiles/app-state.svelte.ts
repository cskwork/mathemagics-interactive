/**
 * 앱 전역 상태 — 어댑터 1개 + 프로필 목록 + 활성 프로필 + 그 프로필의 설정.
 *
 * 저장소 호출을 컴포넌트에서 직접 하지 않고 여기로 모은다: 프로필 전환 시
 * "설정 로드 -> 로케일 적용 -> localStorage 에 lastProfileId 기록" 이 항상 같이 일어나야 하기 때문.
 */
import { applyLocale, fallbackLocale, normalizeLocale, type Locale } from '../i18n/locale.svelte.js';
import { createAdapter } from '../storage/index.js';
import { requestPersistentStorage, type PersistenceState } from '../storage/persistence.js';
import type {
  ProgressRecord,
  Profile,
  Settings,
  SrsCard,
  StorageAdapter,
  StorageMode
} from '../storage/types.js';
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
  #profileSelectionVersion = 0;

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
    const version = ++this.#profileSelectionVersion;
    const stored = await this.adapter().getSettings(id);
    const settings = stored ?? defaultSettings(id);
    if (!stored) await this.adapter().saveSettings(settings);
    if (version !== this.#profileSelectionVersion) return;
    this.#activeId = id;
    writeLastProfileId(id);
    this.#settings = settings;
    applyLocale(settings.locale);
  }

  clearActiveProfile(): void {
    this.#profileSelectionVersion += 1;
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
    const profileId = this.#activeId;
    if (profileId === undefined) return;
    await this.updateSettingsForProfile(profileId, patch);
  }

  /**
   * Update one profile even if navigation changes the active profile while storage is pending.
   * The in-memory active settings are refreshed only when that same profile is still selected.
   */
  async updateSettingsForProfile(
    profileId: string,
    patch: Partial<Omit<Settings, 'profileId'>>
  ): Promise<void> {
    const current =
      (this.#activeId === profileId ? this.#settings : undefined) ??
      (await this.adapter().getSettings(profileId)) ??
      defaultSettings(profileId);
    const next: Settings = { ...current, ...patch };
    await this.adapter().saveSettings(next);
    if (this.#activeId === profileId) {
      this.#settings = next;
      applyLocale(next.locale);
    }
  }

  // ── 진도(M2 레슨 프레임워크) ──────────────────────────────────────────────
  // 컴포넌트가 어댑터를 직접 두드리지 않고 AppState 를 거치게 한다 — 활성 프로필 보장.

  /** 활성 프로필의 모든 진도 기록. 레슨 목록 화면(완료 표시)이 사용. */
  async loadAllProgress(): Promise<ProgressRecord[]> {
    if (this.#activeId === undefined) return [];
    return this.adapter().getProgress(this.#activeId);
  }

  /** 활성 프로필의 특정 스킬 진도. */
  async loadProgress(skillId: string): Promise<ProgressRecord | undefined> {
    if (this.#activeId === undefined) return undefined;
    return this.loadProgressForProfile(this.#activeId, skillId);
  }

  /** Load a session owner's progress without following later active-profile changes. */
  async loadProgressForProfile(
    profileId: string,
    skillId: string
  ): Promise<ProgressRecord | undefined> {
    const all = await this.adapter().getProgress(profileId);
    return all.find((r) => r.skillId === skillId);
  }

  /** 진도 기록 upsert(레슨 완료·단계 도달 저장). profileId 를 활성 프로필로 채운다. */
  async saveProgress(record: Omit<ProgressRecord, 'profileId'> & { profileId?: string }): Promise<void> {
    const profileId = record.profileId ?? this.#activeId;
    if (profileId === undefined) return;
    const full: ProgressRecord = { ...record, profileId };
    await this.adapter().upsertProgress(full);
  }

  /** 활성 프로필 id (진도/레슨 화면이 참조). */
  activeProfileId(): string | undefined {
    return this.#activeId;
  }

  // ── SRS 카드(M3 연습 시스템) ──────────────────────────────────────────────
  // 컴포넌트가 어댑터를 직접 두드리지 않고 AppState 를 거치게 한다 — 활성 프로필 보장.

  /** 활성 프로필의 모든 SRS 카드. 진도·보고서 화면이 사용. */
  async loadAllCards(): Promise<SrsCard[]> {
    if (this.#activeId === undefined) return [];
    return this.loadAllCardsForProfile(this.#activeId);
  }

  /** Load every card for a session owner without following later profile changes. */
  async loadAllCardsForProfile(profileId: string): Promise<SrsCard[]> {
    // getDueCards(now=+∞, limit=100000) 로 전체 회수.
    // limit 은 IndexedDB getAll 의 count 파라미터(unsigned long 32-bit)로 전달되므로
    // Number.MAX_SAFE_INTEGER 를 쓰면 "outside unsigned long" 에러가 발생한다.
    return this.adapter().getDueCards(profileId, Number.MAX_SAFE_INTEGER, 100_000);
  }

  /** 지금 복습 예정(due ≤ now) 카드. 연습 세션 시작용. */
  async getDueCards(now: number, limit: number = 200): Promise<SrsCard[]> {
    if (this.#activeId === undefined) return [];
    return this.getDueCardsForProfile(this.#activeId, now, limit);
  }

  /** Load due cards for the profile that owns a session. */
  async getDueCardsForProfile(
    profileId: string,
    now: number,
    limit: number = 200
  ): Promise<SrsCard[]> {
    return this.adapter().getDueCards(profileId, now, limit);
  }

  /** 카드 upsert(복습 결과 저장·카드 생성). profileId 는 card 에서 가져온다. */
  async upsertCard(card: SrsCard): Promise<void> {
    await this.adapter().upsertCard(card);
  }

  // ── 데이터 이식(M6 ExportBundle UI) ──────────────────────────────────────────
  // 설정 화면의 내보내기/가져오기가 어댑터를 거치게 한다 — 활성 모드(local/server) 에 맞춰 동작.

  /** 전체 데이터를 ExportBundle 로 내보낸다(프로필 무관). */
  async exportData(): Promise<import('../storage/types.js').ExportBundle> {
    return this.adapter().exportAll();
  }

  /** ExportBundle 가져오기. mode = merge(최신 우선) | replace(전체 교체). */
  async importData(
    bundle: import('../storage/types.js').ExportBundle,
    mode: import('../storage/types.js').ImportMode
  ): Promise<void> {
    await this.adapter().importAll(bundle, mode);
    await this.refreshProfiles();
  }
}
