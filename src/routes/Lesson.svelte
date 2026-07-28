<!--
  레슨 플레이어 라우트(#/lesson?id=<skillId>). 해시 쿼리에서 skillId 를 읽어
  LessonPlayer 에 전달. Playground 와 같은 자가-쿼리-읽기 패턴. id 가 바뀌면 리마운트.
-->
<script lang="ts">
  import { m } from '../lib/paraglide/messages.js';
  import type { AppState } from '../lib/profiles/app-state.svelte.js';
  import type { Router } from '../lib/router/hash-router.svelte.js';
  import LessonPlayer from '../lib/lesson/LessonPlayer.svelte';

  interface Props {
    app: AppState;
    router: Router;
  }
  const { app, router }: Props = $props();

  function readSkillId(): string {
    const hash = typeof location !== 'undefined' ? location.hash : '';
    const qIdx = hash.indexOf('?');
    if (qIdx < 0) return '';
    const q = new URLSearchParams(hash.slice(qIdx + 1));
    return q.get('id') ?? '';
  }

  const skillId = readSkillId();
</script>

{#if skillId === ''}
  <section class="stack">
    <p class="card" role="alert">{m.lesson_missing()}</p>
    <button onclick={() => router.navigate('lessons')}>{m.lessons_back_to_list()}</button>
  </section>
{:else}
  {#key skillId}
    <LessonPlayer {skillId} {app} {router} />
  {/key}
{/if}
