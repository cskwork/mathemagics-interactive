import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createProfile } from './helpers';

// axe-core 의 AxeResults 타입을 직접 import 하지 않고 AxeBuilder 에서 파생(해석 부담 최소).
type AxeResults = Awaited<ReturnType<AxeBuilder['analyze']>>;

/**
 * M7-RESULT §7 항목 3 — 접근성 정적 감사 (axe-core).
 *
 * 솔직 한계: axe-core 는 DOM/역할/대비/이름 등 "정적 검출 가능한" 위반만 잡는다.
 * 실제 스크린리더(VoiceOver/NVDA) 낭독 흐름·포커스 순서 체감은 자동화가 불가해 여전히
 * 사람 실측이 필요하다(이것은 axe 통과 = 스크린리더 완벽 을 뜻하지 않는다).
 * 단, Dialog 포커스 트랩/복귀 같은 "동적 동작"은 dialog.spec.ts 가 실측한다.
 */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** critical/serious 위반은 실패. moderate/minor/best-practice 는 증거로 출력만. */
function assertNoSeriousViolations(result: AxeResults, route: string): void {
  const all = result.violations;
  const serious = all.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  if (all.length > 0) {
    const summary = all
      .map((v) => `  [${v.impact}] ${v.id} (${v.help}) — ${v.nodes.length}노드: ${v.nodes.map((n) => n.target.join(',')).join(' | ')}`)
      .join('\n');
    console.log(`\n[axe] ${route}: 위반 ${all.length}건 (serious ${serious.length}건)\n${summary}\n`);
  }
  expect(serious, `${route}: critical/serious 접근성 위반 ${serious.length}건`).toEqual([]);
}

test.describe('접근성 (axe-core, WCAG 2.0/2.1 A/AA)', () => {
  test('profiles', async ({ page }) => {
    await page.goto('#/');
    await expect(page.getByRole('heading', { name: '오늘의 공연자' })).toBeVisible();
    const result = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    assertNoSeriousViolations(result, 'profiles');
  });

  test('home', async ({ page }) => {
    await createProfile(page);
    // "오늘의 공연" 은 <p.kicker>(heading 아님) → 홈 도달은 인사 h2 로 확인.
    await expect(page.getByRole('heading', { name: /안녕/ })).toBeVisible();
    const result = await new AxeBuilder({ page }).exclude('.spotlight-card-beam').withTags(WCAG_TAGS).analyze();
    assertNoSeriousViolations(result, 'home');
  });

  test('settings', async ({ page }) => {
    await createProfile(page);
    await page.goto('#/settings');
    await expect(page.getByRole('heading', { name: '설정' })).toBeVisible();
    const result = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    assertNoSeriousViolations(result, 'settings');
  });

  test('playground', async ({ page }) => {
    await page.goto('#/dev/playground');
    await expect(page.getByRole('heading', { name: '플레이그라운드 (개발용)' })).toBeVisible();
    const result = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    assertNoSeriousViolations(result, 'playground');
  });

  test('다이얼로그 열림 상태 (aria-modal/labelled)', async ({ page }) => {
    await createProfile(page);
    await page.goto('#/');
    await page.getByRole('button', { name: '이름 바꾸기' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // 다이얼로그가 열려 있을 때 배경 콘텐츠까지 포함해 감사.
    const result = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    assertNoSeriousViolations(result, 'dialog-open');
  });
});
