/// <reference types="node" />
import { defineConfig, devices } from '@playwright/test';

/**
 * M7 검증용 브라우저 e2e — vitest(node, DOM 없음)가 못 하는 것을 담당:
 * 반응형 320/375/414/768px · Dialog DOM 동작 · axe-core 접근성 정적 감사.
 * `npm test`(기존 80 단위테스트)와 분리 — `npm run test:e2e` 로만 실행.
 * 웹서버는 프로덕션 빌드(`vite preview`)를 띄워 실제 배포물을 검증한다.
 */
const PORT = 4173;
const BASE_PATH = '/mathemagics-interactive/';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { outputFolder: 'e2e/report', open: 'never' }]],
  outputDir: 'e2e/test-results',
  use: {
    baseURL: `http://localhost:${PORT}${BASE_PATH}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: `http://localhost:${PORT}${BASE_PATH}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
