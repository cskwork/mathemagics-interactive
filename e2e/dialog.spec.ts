import { test, expect } from '@playwright/test';
import { createProfile } from './helpers';

/**
 * M7-RESULT §7 항목 2 — Dialog DOM 동작 (브리프 §3.4 산출물 4).
 * 코드는 모두 작성돼 있으나 vitest node 환경이라 DOM 검증이 불가했던 것을 실측:
 * prompt 변형 — 포커스 이동/트랩/ESC/배경클릭/포커스 복귀.
 * parent-gate 변형 — 오답 시 확인 비활성, 정답 시 통과 + 파괴(프로필 삭제) 성공.
 */
test.beforeEach(async ({ page }) => {
  await createProfile(page, '레나');
  await page.goto('#/');
  // roster 에 방금 만든 프로필이 보일 때까지 대기.
  await expect(page.getByRole('button', { name: '이름 바꾸기' }).first()).toBeVisible();
});

test('prompt: 열림 → 입력칸 포커스 → aria-modal/labelled → 포커스 트랩(양끝 순환)', async ({ page }) => {
  await page.getByRole('button', { name: '이름 바꾸기' }).first().click();
  const dialog = page.getByRole('dialog');

  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog).toHaveAttribute('aria-labelledby', 'dialog-title');

  const input = dialog.locator('input');
  // prompt 변형은 입력칸에 우선 포커스(rAF 후). toBeFocused 가 재시도로 잡는다.
  await expect(input).toBeFocused();
  // 기존 이름이 미리 채워져 있어야 한다(페이딩 — 빈 값이면 확인이 막힘).
  await expect(input).toHaveValue('레나');

  // 포커스 트랩: 입력칸(첫)에서 Shift+Tab → 마지막 포커서블(확인)로 순환.
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: '확인' })).toBeFocused();
  // 확인(마지막)에서 Tab → 입력칸(첫)로 순환.
  await page.keyboard.press('Tab');
  await expect(input).toBeFocused();
});

test('prompt: ESC 닫기 → 트리거(이름 바꾸기 버튼)로 포커스 복귀', async ({ page }) => {
  const trigger = page.getByRole('button', { name: '이름 바꾸기' }).first();
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('prompt: 배경 클릭으로 닫힘 (패널 클릭은 닫지 않음)', async ({ page }) => {
  await page.getByRole('button', { name: '이름 바꾸기' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // 배경(backdrop) 영역 — 패널 밖 모서리. locator 기반 클릭이 target 신뢰성이 높다.
  await page.locator('.backdrop').click({ position: { x: 8, y: 8 } });
  await expect(dialog).toBeHidden();
});

test('parent-gate: 오답 → 확인 비활성, 정답 → 통과 + 프로필 삭제', async ({ page }) => {
  // beforeEach 가 roster(이름 바꾸기 버튼 표시)를 보장. '레나' 는 칩+roster 양쪽에 떠
  // getByText 가 strict-mode 에 걸리므로, 삭제 성공은 빈 상태 카드로 단언한다.
  await page.getByRole('button', { name: '삭제' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // 산수 과제를 읽어 정답 계산. .gate-sum[aria-label] = "a + b".
  const expr = (await dialog.locator('.gate-sum').getAttribute('aria-label')) ?? '';
  const nums = expr.match(/\d+/g);
  expect(nums, `게이트 식 파싱 실패: "${expr}"`).not.toBeNull();
  const answer = nums!.map((n) => Number(n)).reduce((x, y) => x + y, 0);

  const confirm = dialog.getByRole('button', { name: '삭제' });
  const answerInput = dialog.locator('input');

  // 오답 → 확인 비활성.
  await answerInput.fill('0');
  await expect(confirm).toBeDisabled();

  // 정답 → 확인 활성 → 클릭 → roster 가 비어 빈 상태 카드가 뜬다.
  await answerInput.fill(String(answer));
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('첫 공연자를 등록해 주세요')).toBeVisible();
});

test('라우팅: #/profiles 도 profiles 로 도달해야 한다 (wordmark href 정합)', async ({ page }) => {
  // M7 검증 중 발견: PATH_TO_ROUTE 에 '/profiles' 가 없어 #/profiles 가 unknown → not-found 분기.
  // 이 테스트는 현재(수정 전) 실패해야 정상이므로, 수정 후 통과를 단언하도록 작성한다.
  await page.goto('#/profiles');
  await expect(page.getByRole('heading', { name: '오늘의 공연자' })).toBeVisible();
  // not-found 카드가 뜨면 안 된다.
  await expect(page.getByText('없는 화면이에요.')).toBeHidden();
});
