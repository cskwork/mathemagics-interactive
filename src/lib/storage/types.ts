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

  // ── M2 레슨 프레임워크 확장 (전부 optional → 구버전 레코드와 호환, 스키마 버전 불변).
  //   storage 계층을 lesson 모듈과 느슨하게 결합하기 위해 제네릭 타입 사용. ──────────────
  /** 가장 도달한 레슨 단계(lesson LessonPhase 문자열). */
  lessonStepReached?: string;
  /** 누적 힌트 사용 수. */
  hintsUsed?: number;
  /** bottom-out 힌트 사용 수. */
  bottomOuts?: number;
  /** 전략 카드 선택 기록(choice → 횟수). 분석은 M3. */
  strategyCounts?: Record<string, number>;
  /** 레슨 완료 시각(완료 표시 마커). */
  completedAt?: number;

  // ── M3 SRS 확장 (optional, 스키마 v1 불변). ────────────────────────────────
  /** 정확도 게이트 통과 시각. 단조 잠금 — 한 번 통과하면 재잠금 없음(PLAN §4.1-3). */
  gatePassedAt?: number;
  /** 연습 누적(레슨 practice + 복습). 정확도 게이트·숙련도 산출용. attempts/correct 와 별개로
   *  레슨 연습은 attempts 에도 이미 반영되지만, 복습 세션 누적은 여기에 추가한다. */
  practiceAttempts?: number;
  practiceCorrect?: number;
}

/** FSRS/SM-2 계열 간격 반복 카드 상태 (스케줄러 본체는 src/lib/srs). */
export interface SrsCard {
  profileId: string;
  /** 카드 식별자. "기법#밴드" 형식(브리프 §2-1 "카드 = 기법 × 난이도 밴드"). 예: "ltr-addition#1". */
  factId: string;
  /** epoch ms — 복습 예정 시각 */
  due: number;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  /** epoch ms — importAll("merge") 의 last-write-wins 기준 */
  lastReview: number;

  // ── M3 확장 (전부 optional → 구버전 레코드 호환, 스키마 v1 불변). ─────────────
  /** 이 카드가 속한 기법(technique). 게이트·숙련도·보고서 산출에 사용. */
  skillId?: string;
  /** 난이도 밴드 인덱스(난이도 적응). src/lib/srs/difficulty.ts. */
  difficultyBand?: number;
  /** 현재 밴드의 생성 파라미터(자릿수·올림). 카드가 자체 파라미터를 기억. */
  digits?: number;
  carry?: boolean;
  /** 연산/방향 — 연습 세션에서 generateProblem 호출용. M4 가 mul/div/est, M5 가 sqrt + 지필 4종 확장. */
  op?: import('../engine/types.js').Op;
  method?: import('../engine/types.js').Method;
  /** op='est' 일 때 어림 대상 연산. */
  estOf?: 'add' | 'sub' | 'mul' | 'div';
  /** 누적 정오 카운트(정확도 산출). */
  correct?: number;
  total?: number;
}

/** 프로필별 설정. 언어는 여기 있다 (PLAN.md §6.2 — 형제가 서로 다른 언어로 학습). */
export interface Settings {
  profileId: string;
  soundOn: boolean;
  /** BCP-47 로케일 태그. 앱이 모르는 값이면 baseLocale 로 폴백한다. */
  locale: string;
  dailyGoalMinutes: number;

  // ── M3 스트릭 확장 (optional, 스키마 v1 불변). 스트릭은 프로필 단위 비(非)스킬 상태.
  streakCount?: number;
  lastStreakDayMs?: number;
  freezesAvailable?: number;

  // ── M5 공연 모드 확장 (optional, 스키마 v1 불변). 기법별 자기 최고 기록(초 단위).
  //   리더보드·타인 비교 없음(PLAN §4.2-8). key = skillId, value = 최단 시간(ms).
  stageBests?: Record<string, number>;
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
