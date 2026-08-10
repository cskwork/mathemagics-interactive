import { expect, test } from '@playwright/test';
import { completeSkills, createProfile } from './helpers';

async function advanceToFading(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: '건너뛰기', exact: true }).click();
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.getByRole('button', { name: '다음', exact: true }).click();
}

test.describe('수학 입력 상호작용', () => {
  test('나눗셈은 몫과 나머지를 서로 다른 입력 행으로 표시한다', async ({ page }) => {
    await createProfile(page);
    await completeSkills(page, ['ltr-subtraction']);
    await page.goto('#/lesson?id=div-1digit');

    await expect(page.getByRole('heading', { name: '한 자리 나눗셈 (좌→우)' })).toBeVisible();
    await advanceToFading(page);

    await expect(page.locator('[data-row="quotient"] .row-label').first()).toHaveText('몫');
    await expect(page.locator('[data-row="remainder"] .row-label').first()).toHaveText('나머지');
    await expect(page.locator('[data-row="quotient"]')).not.toHaveCount(0);
    await expect(page.locator('[data-row="remainder"]')).not.toHaveCount(0);
  });

  test('배수 판정은 답을 미리 보이지 않고 선택 뒤 근거를 보여 준다', async ({ page }) => {
    await createProfile(page);
    await completeSkills(page, ['div-1digit']);
    await page.goto('#/lesson?id=divisibility');

    await expect(page.getByRole('heading', { name: '배수 판정법 (2~11)' })).toBeVisible();
    await advanceToFading(page);

    const choice = page.locator('.choice-card');
    await expect(choice).toContainText('86은(는) 5(으)로 나누어 떨어질까요?');
    await expect(choice).not.toContainText('나누어 떨어지지 않아요');

    await choice.getByRole('button', { name: '아니요', exact: true }).click();
    await expect(choice).toContainText('끝자리 6');
    await expect(choice).toContainText('나누어 떨어지지 않아요');
  });
});
