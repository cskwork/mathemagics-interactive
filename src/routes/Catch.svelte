<!--
  Hallmark · P4 H4 E4 S4 R4 V4 — "오답 잡아내기" 라우트 (M5 산출물 3). #/catch
  CatchWrongGame 컴포넌트를 감싸는 얇은 셸. 모드섬 검산(6장) 의 응용 게임.
-->
<script lang="ts">
  import { m } from '../lib/paraglide/messages.js';
  import CatchWrongGame from '../components/CatchWrongGame.svelte';
  import type { Router } from '../lib/router/hash-router.svelte.js';

  interface Props {
    router: Router;
  }
  const { router }: Props = $props();
</script>

<section class="stack">
  <CatchWrongGame />
  <div class="row">
    <button class="btn--ghost" onclick={() => router.navigate('home')}>{m.lesson_back_home()}</button>
  </div>
</section>
