import { expect, test, type Page } from '@playwright/test';
import { createProfile } from './helpers';

async function seedDueCard(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('mathemagics');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const profile = await new Promise<{ id: string }>((resolve, reject) => {
      const request = db.transaction('profiles', 'readonly').objectStore('profiles').getAll();
      request.onsuccess = () => resolve(request.result[0] as { id: string });
      request.onerror = () => reject(request.error);
    });

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('srsCards', 'readwrite');
      tx.objectStore('srsCards').put({
        profileId: profile.id,
        factId: 'ltr-addition#1',
        due: Date.now() - 1,
        stability: 1,
        difficulty: 5,
        reps: 1,
        lapses: 0,
        lastReview: Date.now() - 86_400_000,
        skillId: 'ltr-addition',
        difficultyBand: 1,
        digits: 2,
        carry: false,
        op: 'add',
        method: 'ltr',
        correct: 1,
        total: 1
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  });
}

test.describe('핵심 학습 흐름', () => {
  test('복습 카드가 없으면 Home CTA가 다음 해금 레슨을 연다', async ({ page }) => {
    await createProfile(page);

    const cta = page.getByRole('link', { name: /새 기법 배우기/ });
    await expect(cta).toHaveAttribute('href', '#/lesson?id=ltr-addition');
    await cta.click();

    await expect(page).toHaveURL(/#\/lesson\?id=ltr-addition$/);
    await expect(page.locator('.learning-deck a[aria-current="page"]')).toContainText('레슨');
  });

  test('기한이 된 복습 카드가 있으면 Home CTA가 연습을 우선한다', async ({ page }) => {
    await createProfile(page);
    await seedDueCard(page);
    await page.reload();

    const cta = page.getByRole('link', { name: /빠른 연습/ });
    await expect(cta).toHaveAttribute('href', '#/practice');
  });
});
