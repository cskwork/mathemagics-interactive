import type { ProgressRecord, SrsCard } from '../storage/types.js';

export interface LessonCompletionStore {
  saveProgress(record: ProgressRecord): Promise<void>;
  loadAllCardsForProfile(profileId: string): Promise<SrsCard[]>;
  upsertCard(card: SrsCard): Promise<void>;
}

/** Persist the complete lesson outcome before the UI reports completion. */
export async function persistLessonCompletion(
  store: LessonCompletionStore,
  progress: ProgressRecord,
  card: SrsCard
): Promise<void> {
  await store.saveProgress(progress);
  const existing = await store.loadAllCardsForProfile(progress.profileId);
  if (!existing.some((candidate) => candidate.factId === card.factId)) {
    await store.upsertCard(card);
  }
}
