import { test, expect, type Page } from '@playwright/test';
import { createProfile } from './helpers';

/**
 * M7-RESULT §7 항목 1 — 반응형 시각 실측 (브리프 §5 완료기준: 320/375/414/768px).
 * 가로 스크롤 0 + 헤더/콘텐츠가 뷰포트를 넘지 않는 것을 단언하고, 각 폭별 스크린샷을 증거로 남긴다.
 * (스크린샷은 e2e/artifacts/screenshots/ 아래에 기록된다.)
 */
const WIDTHS = [320, 375, 414, 768] as const;

/** 문서 가로 오버플로(스크롤)량을 반환. 0 이하여야 클리핑/가로스크롤 없음. */
async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

/** 버튼/링크 중 우측 끝이 뷰포트 폭을 넘는(=잘리거나 2줄 강제) 것이 없는지 검사. */
async function expectInteractiveFitsViewport(page: Page, vw: number): Promise<void> {
  const overflows = await page.evaluate((vw) => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('button, a, [role="button"], input'));
    return els
      .filter((el) => el.offsetParent !== null) // 보이는 것만
      .map((el) => ({ tag: el.tagName, right: Math.ceil(el.getBoundingClientRect().right), text: (el.textContent ?? '').trim().slice(0, 24) }))
      .filter((r) => r.right > vw + 1);
  }, vw);
  expect(overflows, `뷰포트(${vw}px) 우측 넘침 요소: ${JSON.stringify(overflows)}`).toEqual([]);
}

for (const width of WIDTHS) {
  test.describe(`viewport ${width}px`, () => {
    test.use({ viewport: { width, height: 812 } });

    test('profiles — 가로 스크롤 없음 + 스크린샷', async ({ page }) => {
      await page.goto('#/');
      await expect(page.getByRole('heading', { name: '오늘의 공연자' })).toBeVisible();
      await expect.poll(() => horizontalOverflow(page), { message: `profiles @${width} 가로스크롤` }).toBeLessThanOrEqual(0);
      await expectInteractiveFitsViewport(page, width);
      await page.screenshot({ path: `e2e/artifacts/screenshots/profiles-${width}.png`, fullPage: true });
    });

    test('home — 가로 스크롤 없음 + 헤더 칩 + 스크린샷', async ({ page }) => {
      await createProfile(page);
      await expect(page.getByRole('heading', { name: /테스트/ })).toBeVisible();
      // 모바일에서는 이름이 본문 heading에, 핵심 학습 경로는 하단 learning deck에 남는다.
      await expect(page.locator('.learning-deck')).toBeVisible();
      await expect(page.locator('.deck-link[aria-current="page"]')).toContainText('홈');
      await expect.poll(() => horizontalOverflow(page), { message: `home @${width} 가로스크롤` }).toBeLessThanOrEqual(0);
      await expectInteractiveFitsViewport(page, width);
      await page.screenshot({ path: `e2e/artifacts/screenshots/home-${width}.png`, fullPage: true });
    });

    test('settings — 가로 스크롤 없음 + 스크린샷', async ({ page }) => {
      await createProfile(page);
      await page.goto('#/settings');
      await expect(page.getByRole('heading', { name: '설정' })).toBeVisible();
      await expect.poll(() => horizontalOverflow(page), { message: `settings @${width} 가로스크롤` }).toBeLessThanOrEqual(0);
      await page.screenshot({ path: `e2e/artifacts/screenshots/settings-${width}.png`, fullPage: true });
    });

    test('playground — 가로 스크롤 없음 + 스크린샷', async ({ page }) => {
      await page.goto('#/dev/playground');
      await expect(page.getByRole('heading', { name: '플레이그라운드 (개발용)' })).toBeVisible();
      await expect.poll(() => horizontalOverflow(page), { message: `playground @${width} 가로스크롤` }).toBeLessThanOrEqual(0);
      await page.screenshot({ path: `e2e/artifacts/screenshots/playground-${width}.png`, fullPage: true });
    });
  });
}
