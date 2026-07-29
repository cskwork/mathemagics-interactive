<!--
  Hallmark · P4 H4 E4 S4 R4 V4 — 단일 SVG 아이콘 컴포넌트.
  크기는 1em(컨테이너의 font-size 를 따름), 색은 currentColor(컨테이너의 color 토큰).
  emoji 대체 — 모든 UI 아이콘을 일관된 라인 기하로 통일(hallmark 규약).
-->
<script lang="ts" module>
  export type IconName =
    | 'diamond'
    | 'sparkle'
    | 'sparkles'
    | 'top-hat'
    | 'masks'
    | 'flame'
    | 'bar-chart'
    | 'chat'
    | 'search'
    | 'brain'
    | 'star'
    | 'lock'
    | 'hand'
    | 'play'
    | 'pause'
    | 'prev'
    | 'restart'
    | 'check'
    | 'x'
    | 'backspace';
</script>

<script lang="ts">
  interface Props {
    name: IconName;
  }
  let { name }: Props = $props();
</script>

<svg
  class="icon"
  viewBox="0 0 24 24"
  width="1em"
  height="1em"
  fill="none"
  stroke="currentColor"
  stroke-width="1.75"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  {#if name === 'diamond'}
    <path d="M12 3 L20 12 L12 21 L4 12 Z" fill="currentColor" stroke="none" />
  {:else if name === 'sparkle'}
    <path
      d="M12 2 L13.4 9.5 L21 12 L13.4 14.5 L12 22 L10.6 14.5 L3 12 L10.6 9.5 Z"
      fill="currentColor"
      stroke="none"
    />
  {:else if name === 'sparkles'}
    <path
      d="M9 7 L10.2 11.8 L15 13 L10.2 14.2 L9 19 L7.8 14.2 L3 13 L7.8 11.8 Z"
      fill="currentColor"
      stroke="none"
    />
    <path
      d="M17.5 3 L18.1 5.4 L20.5 6 L18.1 6.6 L17.5 9 L16.9 6.6 L14.5 6 L16.9 5.4 Z"
      fill="currentColor"
      stroke="none"
    />
  {:else if name === 'top-hat'}
    <path d="M6.5 16 V10 a5.5 2.6 0 0 0 11 0 V16" />
    <path d="M3.5 16 Q12 19.5 20.5 16" />
    <path d="M6.6 13.4 H17.4" />
  {:else if name === 'masks'}
    <path d="M5 8 C5 5 8 4 12 4 S19 5 19 8 V11 C19 16 16 19 12 20 C8 19 5 16 5 11 Z" />
    <circle cx="9.2" cy="10" r="0.7" fill="currentColor" stroke="none" />
    <circle cx="14.8" cy="10" r="0.7" fill="currentColor" stroke="none" />
    <path d="M8.8 13.2 Q12 16 15.2 13.2" />
  {:else if name === 'flame'}
    <path
      d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
    />
  {:else if name === 'bar-chart'}
    <path d="M4 3 V20 H20" />
    <path d="M8 17 V13 M12 17 V8 M16 17 V11" />
  {:else if name === 'chat'}
    <path d="M4 5 H20 V14 H11 L7 18 V14 H4 Z" />
  {:else if name === 'search'}
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20.5 20.5 L16 16" />
  {:else if name === 'brain'}
    <path
      d="M12 5 C8.5 5 6.5 7 6.5 10 C5 10 4.5 11.5 5 12.5 C4.5 13.5 5.5 15 7 15 C7 17.5 9 19 12 19 C15 19 17 17.5 17 15 C18.5 15 19.5 13.5 19 12.5 C19.5 11.5 19 10 17.5 10 C17.5 7 15.5 5 12 5 Z"
    />
    <path d="M12 5 V19" />
    <path d="M8 10.5 Q9.3 11.8 8 13.5" />
    <path d="M16 10.5 Q14.7 11.8 16 13.5" />
  {:else if name === 'star'}
    <path
      d="M12 3 L14.6 9.3 L21.5 9.97 L16.2 14.27 L17.9 21 L12 17.27 L6.1 21 L7.8 14.27 L2.5 9.97 L9.4 9.3 Z"
      fill="currentColor"
      stroke="none"
    />
  {:else if name === 'lock'}
    <rect x="4" y="10.5" width="16" height="10" rx="2.5" />
    <path d="M8 10.5 V7 a4 4 0 0 1 8 0 V10.5" />
    <path d="M12 14 V17" />
  {:else if name === 'hand'}
    <path d="M6.5 11 a5.5 4.5 0 0 1 11 0 v3.5 a2.5 2.5 0 0 1 -2.5 2.5 H9 a2.5 2.5 0 0 1 -2.5 -2.5 Z" />
    <path d="M5 14.5 H19" />
  {:else if name === 'play'}
    <path d="M7 4 V20 L19 12 Z" fill="currentColor" stroke="none" />
  {:else if name === 'pause'}
    <path d="M8.5 5 V19" stroke-width="2.4" />
    <path d="M15.5 5 V19" stroke-width="2.4" />
  {:else if name === 'prev'}
    <path d="M17 4 V20 L7 12 Z" fill="currentColor" stroke="none" />
  {:else if name === 'restart'}
    <path d="M18 5 V19 L9 12 Z" fill="currentColor" stroke="none" />
    <path d="M6 5 V19" stroke-width="2.4" />
  {:else if name === 'check'}
    <path d="M5 12.5 L10 17.5 L19 7" />
  {:else if name === 'x'}
    <path d="M6 6 L18 18 M18 6 L6 18" />
  {:else if name === 'backspace'}
    <path d="M21 6 H8.5 L3 12 L8.5 18 H21 Z" />
    <path d="M11 9.5 L15.5 14 M15.5 9.5 L11 14" />
  {/if}
</svg>

<style>
  .icon {
    display: inline-block;
    vertical-align: -0.14em;
  }
</style>
