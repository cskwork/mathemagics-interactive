import { expect, test, type Page } from '@playwright/test';
import { createProfile } from './helpers';

async function unlockStageSkill(page: Page, skillId: string): Promise<void> {
  await page.evaluate(async (id) => {
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
    const now = Date.now();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('progress', 'readwrite');
      transaction.objectStore('progress').put({
        profileId: profile.id,
        skillId: id,
        attempts: 10,
        correct: 10,
        practiceAttempts: 0,
        practiceCorrect: 0,
        lastPlayedAt: now,
        stars: 3,
        completedAt: now,
        gatePassedAt: now
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    db.close();
  }, skillId);
}

async function readPracticeTotals(page: Page, skillId: string): Promise<[number, number]> {
  return page.evaluate(async (id) => {
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
    const progress = await new Promise<{ practiceAttempts?: number; practiceCorrect?: number }>((resolve, reject) => {
      const request = db.transaction('progress', 'readonly').objectStore('progress').get([profile.id, id]);
      request.onsuccess = () => resolve(request.result as { practiceAttempts?: number; practiceCorrect?: number });
      request.onerror = () => reject(request.error);
    });
    db.close();
    return [progress.practiceAttempts ?? 0, progress.practiceCorrect ?? 0];
  }, skillId);
}

test('Stage retries a miss and persists five correct answers out of six attempts', async ({ page }) => {
  await createProfile(page);
  await unlockStageSkill(page, 'ltr-addition');
  await page.goto('#/stage');

  await page.getByRole('button', { name: /큰 자리부터 더하기/ }).click();
  await page.getByRole('button', { name: '공연 시작' }).click();

  for (let solved = 0; solved < 5; solved += 1) {
    const prompt = await page.locator('.prompt').innerText();
    const answer = (prompt.match(/\d+/g) ?? []).reduce((sum, value) => sum + Number(value), 0);
    expect(answer).toBeGreaterThan(0);

    if (solved === 0) {
      await page.keyboard.type('0'.repeat(String(answer).length));
      await expect(page.getByRole('alert')).toContainText('아직 아니에요');
    }

    await page.keyboard.type(String(answer));
    if (solved < 4) {
      await expect(page.locator('.counter-val').first()).toHaveText(`${solved + 1} / 5`);
    }
  }

  await expect(page.getByText('공연 끝!', { exact: true })).toBeVisible();
  await expect.poll(() => readPracticeTotals(page, 'ltr-addition')).toEqual([6, 5]);
});
