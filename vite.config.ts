/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { paraglideVitePlugin } from '@inlang/paraglide-js';

/**
 * GitHub Pages 는 `https://<user>.github.io/<repo>/` 아래에서 서빙되므로
 * base 를 저장소 이름으로 고정한다 (M0 브리프 §2-7). PWA manifest 의 scope/start_url
 * 및 `/api/health` probe URL 도 전부 이 값에서 파생된다.
 */
const BASE = '/mathemagics-interactive/';

export default defineConfig({
  base: BASE,
  plugins: [
    // 메시지 파일(messages/*.json) -> 트리셰이킹 가능한 함수로 컴파일.
    // package.json 의 `npm run i18n` 과 옵션이 동일해야 한다 (svelte-check 는 vite 를 거치지 않음).
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/lib/paraglide',
      // 런타임 로케일은 프로필 설정에서 온다 (src/lib/i18n/locale.svelte.ts 가 overwriteGetLocale 로 주입).
      // 따라서 URL/쿠키 전략은 쓰지 않고 baseLocale 만 남겨 번들에서 전략 코드를 제거한다.
      strategy: ['baseLocale']
    }),
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'Mathemagics Interactive',
        short_name: 'Mathemagics',
        description: '아이들을 위한 암산(mathemagics) 인터랙티브 학습',
        lang: 'ko',
        scope: BASE,
        start_url: BASE,
        display: 'standalone',
        background_color: '#1a0b22',
        theme_color: '#1a0b22',
        // PNG 192/512 는 Android 설치 프롬프트의 요구사항. PWA 설치는 UX 편의가 아니라
        // Safari ITP 7일 축출에 대한 주 방어선이므로(PLAN.md §10-4) 아이콘을 제대로 채운다.
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // 셀프호스트 모드의 /api/* 는 절대 SW 캐시/네비게이션 폴백을 타면 안 된다
        // (architecture-hosting.md §4.3).
        navigateFallbackDenylist: [/^\/api\//, new RegExp(`^${BASE}api/`)],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/api/'),
            handler: 'NetworkOnly'
          },
          {
            // Pretendard Variable(CDN)을 오프라인에서도 쓰도록 첫 방문 후 캐시.
            // 버전(@v1.3.9)이 URL 에 고정돼 CacheFirst 가 안전. 미캐싱 시 오프라인 재방문은
            // 시스템 한글 폰트로 폴백(기능 영향 0, 디자인만 약화)하던 M7 인계 #4 를 폐쇄.
            urlPattern: ({ url }) => url.origin === 'https://cdn.jsdelivr.net',
            handler: 'CacheFirst',
            options: {
              cacheName: 'pretendard-font',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          }
        ]
      },
      devOptions: { enabled: false }
    })
  ],
  test: {
    // 저장소 계약 테스트는 fake-indexeddb 로 돌아가므로 DOM 이 필요 없다 (jsdom 의존성 회피).
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/tests/setup.ts']
  }
});
