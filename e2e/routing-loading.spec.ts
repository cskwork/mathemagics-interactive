import { expect, test, type Page, type Route } from '@playwright/test';
import { completeSkills, createProfile } from './helpers';

interface ServerFixture {
  progress(route: Route, attempt: number): Promise<void>;
  cards?(route: Route, attempt: number): Promise<void>;
}

async function useServerProfile(page: Page, fixture: ServerFixture): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('mathemagics.lastProfileId', 'p1');
  });

  let progressAttempt = 0;
  let cardsAttempt = 0;
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/api/health')) {
      await route.fulfill({ json: { app: 'mathemagics', version: 'test' } });
      return;
    }
    if (url.pathname.endsWith('/api/profiles')) {
      await route.fulfill({ json: [{ id: 'p1', name: '테스트', avatar: 'star', createdAt: 1 }] });
      return;
    }
    if (url.pathname.endsWith('/api/settings/p1')) {
      await route.fulfill({
        json: { profileId: 'p1', soundOn: false, locale: 'ko', dailyGoalMinutes: 10 }
      });
      return;
    }
    if (url.pathname.endsWith('/api/progress')) {
      await fixture.progress(route, ++progressAttempt);
      return;
    }
    if (url.pathname.endsWith('/api/srs/due')) {
      if (fixture.cards) await fixture.cards(route, ++cardsAttempt);
      else await route.fulfill({ json: [] });
      return;
    }
    await route.fulfill({ json: { ok: true } });
  });
}

test('skip link focuses main content without changing the learning route', async ({ page }) => {
  await createProfile(page);
  const before = page.url();
  const skipLink = page.getByRole('link', { name: '콘텐츠로 건너뛰기' });

  await skipLink.focus();
  await page.keyboard.press('Enter');

  await expect(page.locator('#main-stage')).toBeFocused();
  expect(page.url()).toBe(before);
  await expect(page).toHaveURL(/#\/home$/);
});

test('changing only the lesson id remounts the lesson route', async ({ page }) => {
  await createProfile(page);
  await completeSkills(page, ['ltr-addition']);
  await page.goto('#/lesson?id=ltr-addition');
  await expect(page.getByRole('heading', { name: '큰 자리부터 더하기' })).toBeVisible();

  await page.evaluate(() => {
    location.hash = '#/lesson?id=ltr-subtraction';
  });

  await expect(page.getByRole('heading', { name: '큰 자리부터 빼기' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '큰 자리부터 더하기' })).toHaveCount(0);
});

test('Lesson shows loading while progress is pending', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await useServerProfile(page, {
    progress: async (route) => {
      await pending;
      await route.fulfill({ json: [] });
    }
  });

  await page.goto('#/lesson?id=ltr-addition');
  await expect(page.locator('#main-stage p[role="status"]')).toHaveText('불러오는 중…');
  release();
  await expect(page.getByRole('heading', { name: '큰 자리부터 더하기' })).toBeVisible();
});

test('Lesson turns a rejected load into an error with a working retry', async ({ page }) => {
  await useServerProfile(page, {
    progress: async (route, attempt) => {
      if (attempt === 1) await route.fulfill({ status: 500, json: { error: 'test failure' } });
      else await route.fulfill({ json: [] });
    }
  });

  await page.goto('#/lesson?id=ltr-addition');
  await expect(page.locator('#main-stage [role="alert"]')).toContainText('무대를 준비하지 못했어요.');
  await page.getByRole('button', { name: '다시 불러오기' }).click();
  await expect(page.getByRole('heading', { name: '큰 자리부터 더하기' })).toBeVisible();
});

test('Stage shows loading while progress and cards are pending', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await useServerProfile(page, {
    progress: async (route) => {
      await pending;
      await route.fulfill({ json: [] });
    }
  });

  await page.goto('#/stage');
  await expect(page.locator('.stage-route [role="status"]')).toContainText('불러오는 중…');
  release();
  await expect(page.getByText('아직 공연할 수 있는 기법이 없어요.')).toBeVisible();
});

test('Stage turns a rejected load into an error with a working retry', async ({ page }) => {
  await useServerProfile(page, {
    progress: async (route, attempt) => {
      if (attempt === 1) await route.fulfill({ status: 500, json: { error: 'test failure' } });
      else await route.fulfill({ json: [] });
    }
  });

  await page.goto('#/stage');
  await expect(page.locator('.stage-route [role="alert"]')).toContainText('무대를 준비하지 못했어요.');
  await page.getByRole('button', { name: '다시 불러오기' }).click();
  await expect(page.getByText('아직 공연할 수 있는 기법이 없어요.')).toBeVisible();
});
