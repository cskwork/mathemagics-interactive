import { expect, test } from '@playwright/test';
import { createProfile } from './helpers';

test.beforeEach(async ({ page }) => {
  await createProfile(page, '레나');
});

test('Settings import opens from the keyboard and export failures are announced', async ({ page }) => {
  await page.goto('#/settings');

  const importButton = page.getByRole('button', { name: '진도 가져오기' });
  await importButton.focus();
  const chooser = page.waitForEvent('filechooser');
  await page.keyboard.press('Enter');
  await chooser;

  await page.evaluate(() => {
    URL.createObjectURL = () => { throw new Error('forced export failure'); };
  });
  await page.getByRole('button', { name: '진도 내보내기 (JSON)' }).click();
  await expect(page.getByRole('alert')).toHaveText('내보내기에 실패했어요.');
});

test('an async rename rejection stays in the Dialog and shows a recoverable error', async ({ page }) => {
  await page.goto('#/profiles');
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = () => { throw new DOMException('forced write failure'); };
  });

  await page.getByRole('button', { name: '이름 바꾸기' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input').fill('새 이름');
  await dialog.getByRole('button', { name: '확인' }).click();

  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-busy', 'false');
  await expect(dialog.getByRole('alert')).toHaveText('프로필을 저장하지 못했어요. 다시 시도해 주세요.');
  await expect(dialog.getByRole('button', { name: '확인' })).toBeEnabled();
});

test('the import busy layer blocks above the learning dock until persistence completes', async ({ page }) => {
  await page.goto('#/settings');
  const profiles = [{ id: 'imported', name: 'Imported', avatar: 'star', createdAt: 10 }];
  await page.locator('input[type="file"]').setInputFiles({
    name: 'mathemagics.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      app: 'mathemagics', schemaVersion: 1, exportedAt: Date.now(),
      profiles,
      progress: [],
      srsCards: [],
      settings: [{
        profileId: 'imported', soundOn: true, locale: 'ko', dailyGoalMinutes: 10
      }]
    }))
  });

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = () => { throw new DOMException('forced import failure'); };
  });
  await page.evaluate(() => {
    const dock = document.querySelector('.learning-deck');
    const observed = new Promise<{ overlay: number; dock: number }>((resolve) => {
      const observer = new MutationObserver(() => {
        const overlay = document.querySelector('.overlay');
        if (!overlay || !dock) return;
        observer.disconnect();
        resolve({
          overlay: Number(getComputedStyle(overlay).zIndex),
          dock: Number(getComputedStyle(dock).zIndex)
        });
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
    Object.assign(window, { __importLayerObserved: observed });
  });
  await dialog.getByRole('button', { name: '가져오기' }).click();
  const layers = await page.evaluate(() => (
    window as typeof window & { __importLayerObserved: Promise<{ overlay: number; dock: number }> }
  ).__importLayerObserved);
  expect(layers.overlay).toBeGreaterThan(layers.dock);
  await expect(page.locator('.overlay')).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('alert')).toHaveText('가져오기에 실패했어요.');
});
