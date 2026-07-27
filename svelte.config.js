import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/vite-plugin-svelte').Config} */
export default {
  // .svelte 안의 <script lang="ts"> 를 esbuild 로 트랜스파일 (svelte-check / vite 공용)
  preprocess: vitePreprocess(),
  compilerOptions: {
    // Svelte 5 runes 전용 모드 — 레거시 반응성($: 라벨) 사용을 컴파일 타임에 차단
    runes: true
  }
};
