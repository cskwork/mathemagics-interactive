import type { ProgressRecord } from '../storage/types.js';

export interface PracticeProgressStore {
  loadProgressForProfile(profileId: string, skillId: string): Promise<ProgressRecord | undefined>;
  saveProgress(record: ProgressRecord): Promise<void>;
}

/**
 * Owns persistence for one practice session.
 *
 * Progress updates are serialized because each update is a read/modify/write upsert.
 * The finish callback is also single-flight so a repeated terminal UI event cannot
 * persist the same review session twice.
 */
export class PracticeSessionPersistence {
  readonly profileId: string;

  #tail: Promise<void> = Promise.resolve();
  #firstError: unknown;
  #finishPromise: Promise<void> | undefined;
  readonly #store: PracticeProgressStore;
  readonly #now: () => number;

  constructor(store: PracticeProgressStore, profileId: string, now: () => number = Date.now) {
    this.#store = store;
    this.profileId = profileId;
    this.#now = now;
  }

  record(skillId: string, correct: boolean): void {
    if (skillId === '') return;

    this.#tail = this.#tail
      .then(async () => {
        const current = await this.#store.loadProgressForProfile(this.profileId, skillId);
        const base: ProgressRecord =
          current ??
          {
            profileId: this.profileId,
            skillId,
            attempts: 0,
            correct: 0,
            lastPlayedAt: this.#now(),
            stars: 0
          };
        await this.#store.saveProgress({
          ...base,
          profileId: this.profileId,
          practiceAttempts: (base.practiceAttempts ?? 0) + 1,
          practiceCorrect: (base.practiceCorrect ?? 0) + (correct ? 1 : 0),
          lastPlayedAt: this.#now()
        });
      })
      .catch((error: unknown) => {
        this.#firstError ??= error;
      });
  }

  async flush(): Promise<void> {
    await this.#tail;
    if (this.#firstError !== undefined) throw this.#firstError;
  }

  finishOnce(persistSession: () => Promise<void>): Promise<void> {
    this.#finishPromise ??= (async () => {
      await this.flush();
      await persistSession();
    })();
    return this.#finishPromise;
  }
}
