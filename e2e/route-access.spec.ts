import { test, expect } from '@playwright/test';
import { completeSkills, createProfile } from './helpers';

test.describe('route access guards', () => {
  test('locked lesson deep links do not mount the lesson player', async ({ page }) => {
    await createProfile(page);

    await page.goto('#/lesson?id=ltr-subtraction');

    await expect(page.getByRole('heading', { name: '아직 열리지 않아요' })).toBeVisible();
    await expect(page.getByText('앞의 레슨을 끝내면 열려요.')).toBeVisible();
    await expect(page.locator('section.lesson')).toHaveCount(0);
  });

  test('a lesson deep link opens after its prerequisite is completed', async ({ page }) => {
    await createProfile(page);
    await completeSkills(page, ['ltr-addition']);

    await page.goto('#/lesson?id=ltr-subtraction');

    await expect(page.locator('section.lesson')).toBeVisible();
    await expect(page.getByRole('heading', { name: '큰 자리부터 빼기' })).toBeVisible();
  });

  test('locked magic deep links render the locked list instead of the trick player', async ({ page }) => {
    await createProfile(page);

    await page.goto('#/magic?id=psychic-math');

    await expect(page.locator('.trick-list')).toBeVisible();
    await expect(page.locator('section.trick')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /심령 수학/ })).toBeDisabled();
  });

  test('a magic deep link opens after every lesson in its chapter is completed', async ({ page }) => {
    await createProfile(page);
    await completeSkills(page, ['mul-2x1', 'mul-3x1', 'square-2digit']);

    await page.goto('#/magic?id=psychic-math');

    await expect(page.locator('section.trick')).toBeVisible();
    await expect(page.getByRole('heading', { name: '심령 수학' })).toBeVisible();
  });
});
