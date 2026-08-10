import { describe, expect, it, vi } from 'vitest';
import type { ProgressRecord } from '../storage/types.js';
import { PracticeSessionPersistence } from './persistence.js';

describe('PracticeSessionPersistence', () => {
  it('serializes cumulative result writes and keeps them on the session owner', async () => {
    let stored: ProgressRecord = {
      profileId: 'learner-a',
      skillId: 'ltr-addition',
      attempts: 4,
      correct: 3,
      practiceAttempts: 2,
      practiceCorrect: 1,
      lastPlayedAt: 10,
      stars: 1
    };
    const loadProgressForProfile = vi.fn(async () => {
      await Promise.resolve();
      return { ...stored };
    });
    const saveProgress = vi.fn(async (record: ProgressRecord) => {
      await Promise.resolve();
      stored = { ...record };
    });
    const persistence = new PracticeSessionPersistence(
      { loadProgressForProfile, saveProgress },
      'learner-a',
      () => 99
    );

    persistence.record('ltr-addition', true);
    persistence.record('ltr-addition', false);
    await persistence.flush();

    expect(loadProgressForProfile).toHaveBeenNthCalledWith(1, 'learner-a', 'ltr-addition');
    expect(loadProgressForProfile).toHaveBeenNthCalledWith(2, 'learner-a', 'ltr-addition');
    expect(stored).toMatchObject({
      profileId: 'learner-a',
      practiceAttempts: 4,
      practiceCorrect: 2,
      lastPlayedAt: 99
    });
  });

  it('runs terminal session persistence only once when finish is re-entered', async () => {
    const persistSession = vi.fn(async () => {
      await Promise.resolve();
    });
    const persistence = new PracticeSessionPersistence(
      {
        loadProgressForProfile: vi.fn(),
        saveProgress: vi.fn()
      },
      'learner-a'
    );

    await Promise.all([
      persistence.finishOnce(persistSession),
      persistence.finishOnce(persistSession)
    ]);

    expect(persistSession).toHaveBeenCalledOnce();
  });
});
