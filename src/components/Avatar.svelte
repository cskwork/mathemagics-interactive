<!--
  Hallmark · P4 H4 E4 S4 R4 V4 — 프로필 아바타 SVG 배지.
  emoji 동물 대신 "마술사 무대" 토큰으로 통일: stage-mid 원 + spotlight 고리 + 앰버 글리프.
  크기 1em(컨테이너 font-size 따름). id 는 AVATAR_IDS 의 안정적 키; 알 수 없는 값
  (예: 구버전 프로필에 저장된 emoji)은 폴백 배지로 렌더 — 데이터 마이그레이션 불필요.
-->
<script lang="ts" module>
  export const AVATAR_IDS = [
    'penguin',
    'fox',
    'turtle',
    'owl',
    'octopus',
    'unicorn',
    'bee',
    'whale'
  ] as const;
  export type AvatarId = (typeof AVATAR_IDS)[number];
</script>

<script lang="ts">
  interface Props {
    id: string;
  }
  let { id }: Props = $props();
  // 알 수 없는 id(레거시 emoji 등)는 폴백. 알려진 id인지 판정해 글리프 선택.
  const known: ReadonlySet<string> = new Set(AVATAR_IDS);
  let glyph = $derived(known.has(id) ? id : 'fallback');
</script>

<span class="avatar" aria-hidden="true">
  <svg viewBox="0 0 24 24" width="1em" height="1em" focusable="false">
    <circle cx="12" cy="12" r="10.5" fill="var(--stage-mid)" stroke="var(--spotlight)" stroke-width="1.25" />
    <g fill="var(--spotlight)" stroke="none">
      {#if glyph === 'penguin'}
        <path d="M9 6.5 a3 3 0 0 1 6 0 v7 a3.2 3.6 0 0 1 -6 0 Z" />
        <ellipse cx="12" cy="12.5" rx="1.9" ry="3.1" fill="var(--stage-mid)" />
        <path d="M12 8 L13.4 9 L12 10 Z" />
      {:else if glyph === 'fox'}
        <path d="M12 7 L7 15.5 a5 5 0 1 0 10 0 Z" />
        <path d="M7 9 L8.3 5 L10.7 8 Z M17 9 L15.7 5 L13.3 8 Z" />
        <path d="M12 12 L10.4 16.2 a1.7 1.7 0 0 0 3.2 0 Z" fill="var(--stage-mid)" />
      {:else if glyph === 'turtle'}
        <circle cx="11.5" cy="12.5" r="4.6" />
        <circle cx="17.2" cy="12.5" r="1.7" />
        <circle cx="7.6" cy="9" r="1.2" />
        <circle cx="7.6" cy="16" r="1.2" />
        <circle cx="14.2" cy="16.8" r="1.1" />
        <path d="M8.3 10.6 Q11.5 9 14.7 10.6" fill="none" stroke="var(--stage-mid)" stroke-width="1" />
      {:else if glyph === 'owl'}
        <circle cx="12" cy="12.5" r="5.5" />
        <path d="M6.8 8 L8 4.4 L10.3 7.6 Z M17.2 8 L16 4.4 L13.7 7.6 Z" />
        <circle cx="10" cy="12.2" r="1.7" fill="var(--stage-mid)" />
        <circle cx="14" cy="12.2" r="1.7" fill="var(--stage-mid)" />
        <circle cx="10" cy="12.2" r="0.75" />
        <circle cx="14" cy="12.2" r="0.75" />
        <path d="M12 13.2 L13.2 15 L10.8 15 Z" />
      {:else if glyph === 'octopus'}
        <circle cx="12" cy="10" r="4.6" />
        <path
          d="M8 13.2 Q6.8 16 8.4 18.2 M10.5 14.2 Q10 16.4 11 18.2 M13.5 14.2 Q14 16.4 13 18.2 M16 13.2 Q17.2 16 15.6 18.2"
          fill="none"
          stroke="var(--spotlight)"
          stroke-width="1.5"
          stroke-linecap="round"
        />
        <circle cx="10.4" cy="9.4" r="0.8" fill="var(--stage-mid)" />
        <circle cx="13.6" cy="9.4" r="0.8" fill="var(--stage-mid)" />
      {:else if glyph === 'unicorn'}
        <path d="M6.5 16.5 C4.5 14.5 4.5 10.5 7.5 9.5 C7.5 6.5 11 5.5 13.2 7.5 C16.2 6.5 18.5 8.8 18.2 11.8 C18 14.8 15.8 16.5 13 16.5 Z" />
        <path d="M14.5 7.2 L16.5 2 L17.5 6.8 Z" />
        <path d="M11.6 6 L12.8 2.6 L14.2 6 Z" />
        <circle cx="11.6" cy="11.4" r="0.8" fill="var(--stage-mid)" />
      {:else if glyph === 'bee'}
        <ellipse cx="12" cy="13.5" rx="3.6" ry="4.6" />
        <path d="M8.7 12.6 H15.3 M8.5 14.7 H15.5" fill="none" stroke="var(--stage-mid)" stroke-width="1" />
        <ellipse cx="9.4" cy="9.4" rx="2.6" ry="1.7" transform="rotate(-28 9.4 9.4)" fill="var(--spotlight-wash-strong)" />
        <ellipse cx="14.6" cy="9.4" rx="2.6" ry="1.7" transform="rotate(28 14.6 9.4)" fill="var(--spotlight-wash-strong)" />
      {:else if glyph === 'whale'}
        <path d="M5 14.5 a6 4.4 0 0 1 11 0 q0 2.4 -2.6 3 H8 Q5.6 16.8 5 14.5 Z" />
        <path d="M16 12.4 L19.5 10 V15 Z" />
        <path d="M9.5 7.2 Q10.6 5.4 9.8 3.8 M12 7 Q13.2 5 12 3" fill="none" stroke="var(--spotlight)" stroke-width="1.3" stroke-linecap="round" />
        <circle cx="8" cy="13.2" r="0.6" fill="var(--stage-mid)" />
      {:else}
        <path d="M12 4 L13.6 10.4 L20 12 L13.6 13.6 L12 20 L10.4 13.6 L4 12 L10.4 10.4 Z" />
      {/if}
    </g>
  </svg>
</span>

<style>
  .avatar {
    display: inline-block;
    line-height: 0;
    vertical-align: middle;
  }
  .avatar svg {
    display: block;
  }
</style>
