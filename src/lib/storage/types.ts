/**
 * 저장소 계층의 도메인 타입과 어댑터 인터페이스.
 *
 * 근거: docs/research/architecture-hosting.md §1.1 (Repository/Adapter 패턴).
 * 모든 메서드는 처음부터 Promise 기반 — 나중에 REST(비동기) 백엔드로 갈아탈 수 있어야 하므로
 * 동기 API 를 노출하지 않는다.
 */

/** 학습자 프로필. 형제가 한 기기를 공유하는 시나리오를 전제로 한다. */
export interface Profile {
  /** uuid v4 */
  id: string;
  name: string;
  /** 이모지 한 글자 또는 에셋 키 */
  avatar: string;
  /** epoch ms */
  createdAt: number;
}

/** 스킬(기법) 단위 진도. */
export interface ProgressRecord {
  profileId: string;
  /** 예: "add-ltr-2digit" */
  skillId: string;
  attempts: number;
  correct: number;
  /** epoch ms — importAll("merge") 의 last-write-wins 기준 */
  lastPlayedAt: number;
  stars: 0 | 1 | 2 | 3;
}

/** FSRS/SM-2 계열 간격 반복 카드 상태 (스케줄러 본체는 M3). */
export interface SrsCard {
  profileId: string;
  /** 예: "7x8" */
  factId: string;
  /** epoch ms — 복습 예정 시각 */
  due: number;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  /** epoch ms — importAll("merge") 의 last-write-wins 기준 */
  lastReview: number;
}

/** 프로필별 설정. 언어는 여기 있다 (PLAN.md §6.2 — 형제가 서로 다른 언어로 학습). */
export interface Settings {
  profileId: string;
  soundOn: boolean;
  /** BCP-47 로케일 태그. 앱이 모르는 값이면 baseLocale 로 폴백한다. */
  locale: string;
  dailyGoalMinutes: number;
}

/** 두 저장 모드(브라우저/셀프호스트)의 공용 교환 포맷. */
export interface ExportBundle {
  /** migrations.ts 의 CURRENT_SCHEMA 기준 */
  schemaVersion: number;
  exportedAt: number;
  app: 'mathemagics';
  profiles: Profile[];
  progress: ProgressRecord[];
  srsCards: SrsCard[];
  settings: Settings[];
}

export type ImportMode = 'merge' | 'replace';

/** 저장 모드 식별자 — UI 표시와 진단에 쓴다. */
export type StorageMode = 'local' | 'server';

export interface StorageAdapter {
  /** 어댑터 식별자. 설정 화면에 "이 기기 / 셀프호스트 서버"로 표시된다. */
  readonly mode: StorageMode;

  init(): Promise<void>;

  // profiles
  listProfiles(): Promise<Profile[]>;
  upsertProfile(p: Profile): Promise<void>;
  /** progress/srsCards/settings 까지 cascade 삭제해야 한다. */
  deleteProfile(id: string): Promise<void>;

  // progress
  getProgress(profileId: string): Promise<ProgressRecord[]>;
  upsertProgress(r: ProgressRecord): Promise<void>;

  // spaced repetition
  getDueCards(profileId: string, now: number, limit: number): Promise<SrsCard[]>;
  upsertCard(c: SrsCard): Promise<void>;

  // settings
  getSettings(profileId: string): Promise<Settings | undefined>;
  saveSettings(s: Settings): Promise<void>;

  // portability (architecture-hosting.md §3)
  exportAll(): Promise<ExportBundle>;
  importAll(bundle: ExportBundle, mode: ImportMode): Promise<void>;
}
