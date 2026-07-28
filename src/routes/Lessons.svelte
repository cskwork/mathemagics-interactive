<!--
  Hallmark · P4 H4 E4 S4 R4 V4 — 레슨 목록 화면 (docs/briefs/M2.md 산출물 6).
  1장 3레슨 + 잠금 상태(선행 사슬: 덧셈→뺄셈→보수) + 완료 표시.
  스킬트리 비주얼은 M4. 지금은 "공연 프로그램" 명단 형태.
  잠금/완료 판정은 순수 함수(isLessonUnlocked + 진도 레코드)로.
-->
<script lang="ts">
  import { m } from '../lib/paraglide/messages.js';
  import { activeLocale } from '../lib/i18n/locale.svelte.js';
  import { resolveLocalized } from '../lib/content/localized.js';
  import { loadAllLessons } from '../lib/lesson/loader.js';
  import { isLessonUnlocked } from '../lib/lesson/state-machine.js';
  import type { AppState } from '../lib/profiles/app-state.svelte.js';
  import type { Router } from '../lib/router/hash-router.svelte.js';
  import type { ProgressRecord } from '../lib/storage/types.js';

  interface Props {
    app: AppState;
    router: Router;
  }
  const { app, router }: Props = $props();

  const lessons = loadAllLessons();

  let progress = $state<ProgressRecord[]>([]);
  let loaded = $state(false);

  async function refresh(): Promise<void> {
    progress = await app.loadAllProgress();
    loaded = true;
  }

  // 진도 로드(활성 프로필 바뀌면 다시).
  $effect(() => {
    void app.activeProfile(); // 의존성 — 프로필 전환 시 재실행
    void refresh();
  });

  function recordFor(skillId: string): ProgressRecord | undefined {
    return progress.find((r) => r.skillId === skillId);
  }
  function isCompleted(skillId: string): boolean {
    return recordFor(skillId)?.completedAt !== undefined;
  }
  function completedSet(): Set<string> {
    return new Set(lessons.filter((l) => isCompleted(l.file.skillId)).map((l) => l.file.skillId));
  }
  function lessonLocked(prereqs: readonly string[]): boolean {
    return !isLessonUnlocked(prereqs, completedSet());
  }

  function openLesson(skillId: string): void {
    // 레슨 플레이어 라우트로(id 쿼리).
    globalThis.location.hash = `#/lesson?id=${encodeURIComponent(skillId)}`;
  }

  function chapterLabel(ch: number): string {
    return m.lessons_chapter({ n: ch });
  }
</script>

<section class="stack lessons">
  <header class="lessons-head">
    <h2>{m.lessons_heading()}</h2>
  </header>

  {#if !loaded}
    <p class="muted">{m.loading()}</p>
  {:else if lessons.length === 0}
    <p class="card">{m.lessons_no_lessons()}</p>
  {:else}
    {#each lessons as l (l.file.id)}
      {@const completed = isCompleted(l.file.skillId)}
      {@const locked = lessonLocked(l.file.prerequisites)}
      {@const rec = recordFor(l.file.skillId)}
      <article class="card lesson-row" class:locked class:completed>
        <div class="lesson-mark" aria-hidden="true">{completed ? '★' : locked ? '🔒' : '◆'}</div>
        <div class="lesson-body">
          <p class="muted small chapter">{chapterLabel(l.file.chapter)}</p>
          <h3>{resolveLocalized(l.file.title, activeLocale())}</h3>
          <p class="muted small">{resolveLocalized(l.file.subtitle, activeLocale())}</p>
          {#if completed && rec}
            <p class="muted small meta">
              {m.lessons_stars({ n: rec.stars })}
              {#if rec.attempts > 0}
                · {m.lessons_accuracy({ pct: Math.round((rec.correct / rec.attempts) * 100) })}
              {/if}
            </p>
          {/if}
        </div>
        <div class="lesson-action">
          {#if locked}
            <span class="lock-label" aria-label={m.lessons_locked()}>
              {m.lessons_locked()}
            </span>
          {:else}
            <button
              class="btn--primary"
              onclick={() => openLesson(l.file.skillId)}
              aria-label={completed ? m.lessons_replay() : m.lessons_start()}
            >
              {completed ? m.lessons_replay() : m.lessons_start()}
            </button>
          {/if}
        </div>
      </article>
    {/each}

    <p class="muted small hint">{m.lessons_locked_hint()}</p>
  {/if}

  <div class="row nav-row">
    <button onclick={() => router.navigate('home')}>{m.lesson_back_home()}</button>
  </div>
</section>

<style>
  .lessons-head h2 {
    font-size: var(--text-title);
  }

  /* 레슨 한 줄 = 프로그램 팜플렛의 출연진 행 */
  .lesson-row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: var(--space-3);
    align-items: center;
  }
  .lesson-mark {
    font-size: 1.4rem;
    color: var(--spotlight);
    width: calc(var(--tap));
    height: calc(var(--tap));
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .lesson-row.completed .lesson-mark {
    color: var(--applause);
  }
  .lesson-row.locked {
    opacity: 0.65;
  }
  .lesson-row.locked .lesson-mark {
    color: var(--house-light);
  }
  .lesson-body {
    min-width: 0;
  }
  .chapter {
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
  }
  .meta {
    color: var(--house-light);
  }
  .lesson-action {
    min-width: var(--tap);
  }
  .lock-label {
    font-size: var(--text-small);
    color: var(--house-light);
    white-space: nowrap;
  }
  .hint {
    text-align: center;
  }
  .nav-row {
    margin-top: var(--space-2);
  }

  @media (max-width: 360px) {
    .lesson-row {
      grid-template-columns: auto 1fr;
    }
    .lesson-action {
      grid-column: 1 / -1;
    }
    .lesson-action button {
      width: 100%;
    }
  }
</style>
