import { describe, expect, it, vi } from 'vitest';
import type { ProgressRecord, SrsCard } from '../storage/types.js';
import { persistLessonCompletion } from './completion.js';

const progress: ProgressRecord = {
  profileId: 'lesson-owner',
  skillId: 'ltr-addition',
  attempts: 3,
  correct: 3,
  lastPlayedAt: 100,
  stars: 3,
  lessonStepReached: 'done',
  completedAt: 100
};

const card: SrsCard = {
  profileId: 'lesson-owner',
  factId: 'ltr-addition#1',
  due: 100,
  stability: 1,
  difficulty: 5,
  reps: 0,
  lapses: 0,
  lastReview: 100
};

describe('persistLessonCompletion', () => {
  it('awaits progress before profile-pinned card lookup and card persistence', async () => {
    let releaseProgress!: () => void;
    const progressGate = new Promise<void>((resolve) => {
      releaseProgress = resolve;
    });
    const saveProgress = vi.fn(async () => progressGate);
    const loadAllCardsForProfile = vi.fn(async () => []);
    const upsertCard = vi.fn(async () => undefined);

    const completion = persistLessonCompletion(
      { saveProgress, loadAllCardsForProfile, upsertCard },
      progress,
      card
    );
    await Promise.resolve();

    expect(loadAllCardsForProfile).not.toHaveBeenCalled();
    releaseProgress();
    await completion;

    expect(loadAllCardsForProfile).toHaveBeenCalledWith('lesson-owner');
    expect(upsertCard).toHaveBeenCalledWith(card);
  });

  it('keeps existing lesson cards idempotent', async () => {
    const upsertCard = vi.fn(async () => undefined);

    await persistLessonCompletion(
      {
        saveProgress: vi.fn(async () => undefined),
        loadAllCardsForProfile: vi.fn(async () => [{ ...card }]),
        upsertCard
      },
      progress,
      card
    );

    expect(upsertCard).not.toHaveBeenCalled();
  });
});
