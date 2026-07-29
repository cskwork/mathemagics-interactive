import type { Page } from '@playwright/test';

/**
 * e2e 공용 헬퍼. UI 를 통해 프로필을 만들어 #/home 에 도달한다.
 * Playwright 컨텍스트는 기본적으로 격리되므로 매 테스트마다 IndexedDB 가 비어 있는 상태에서 시작한다.
 */
export async function createProfile(page: Page, name = '테스트'): Promise<void> {
  // #/ 가 profiles 라우트다 (#/profiles 가 아님 — hash-router.svelte.ts PATH_TO_ROUTE 참조).
  await page.goto('#/');
  await page.getByRole('button', { name: '프로필 만들기' }).click();
  await page.getByPlaceholder('이름을 적어 주세요').fill(name);
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await page.waitForURL(/#\/home$/);
}
