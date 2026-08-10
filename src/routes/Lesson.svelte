<!--
  레슨 플레이어 라우트(#/lesson?id=<skillId>). 해시 쿼리에서 skillId 를 읽어
  LessonPlayer 에 전달. Playground 와 같은 자가-쿼리-읽기 패턴. id 가 바뀌면 리마운트.
-->
<script lang="ts">
  import { m } from '../lib/paraglide/messages.js';
  import { findLesson } from '../lib/lesson/loader.js';
  import { isLessonUnlocked } from '../lib/lesson/state-machine.js';
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
  const lesson = skillId === '' ? undefined : findLesson(skillId);
  let access = $state<'loading' | 'missing' | 'locked' | 'open' | 'error'>(
    lesson === undefined ? 'missing' : 'loading'
  );
  let accessRequest = 0;

  async function refreshAccess(): Promise<void> {
    const request = ++accessRequest;
    if (lesson === undefined) {
      access = 'missing';
      return;
    }

    access = 'loading';
    try {
      const progress = await app.loadAllProgress();
      if (request !== accessRequest) return;
      const completed = new Set(
        progress.filter((record) => record.completedAt !== undefined).map((record) => record.skillId)
      );
      access = isLessonUnlocked(lesson.file.prerequisites, completed) ? 'open' : 'locked';
    } catch {
      if (request === accessRequest) access = 'error';
    }
  }

  $effect(() => {
    void app.activeProfile();
    void refreshAccess();
  });
</script>

{#if access === 'loading'}
  <p class="muted" role="status">{m.loading()}</p>
{:else if access === 'error'}
  <section class="stack">
    <div class="card" role="alert">
      <h2>{m.app_load_error()}</h2>
    </div>
    <button class="btn--primary" onclick={refreshAccess}>{m.app_retry()}</button>
  </section>
{:else if access === 'missing'}
  <section class="stack">
    <p class="card" role="alert">{m.lesson_missing()}</p>
    <button onclick={() => router.navigate('lessons')}>{m.lessons_back_to_list()}</button>
  </section>
{:else if access === 'locked'}
  <section class="stack">
    <div class="card" role="alert">
      <h2>{m.lessons_locked()}</h2>
      <p class="muted">{m.lessons_locked_hint()}</p>
    </div>
    <button onclick={() => router.navigate('lessons')}>{m.lessons_back_to_list()}</button>
  </section>
{:else}
  {#key skillId}
    <LessonPlayer {skillId} {app} {router} />
  {/key}
{/if}
