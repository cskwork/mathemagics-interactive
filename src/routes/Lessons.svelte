<script lang="ts">
  import { m } from '../lib/paraglide/messages.js';
  import Icon from '../components/Icon.svelte';
  import { activeLocale } from '../lib/i18n/locale.svelte.js';
  import { resolveLocalized } from '../lib/content/localized.js';
  import { loadAllLessons } from '../lib/lesson/loader.js';
  import { isLessonUnlocked } from '../lib/lesson/state-machine.js';
  import {
    buildSkillNodes,
    CHAPTER_MAGIC_SLOTS,
    isMagicUnlocked,
    type SkillNode
  } from '../lib/lesson/skill-tree.js';
  import type { AppState } from '../lib/profiles/app-state.svelte.js';
  import type { Router } from '../lib/router/hash-router.svelte.js';
  import type { ProgressRecord } from '../lib/storage/types.js';

  interface Props {
    app: AppState;
    router: Router;
  }

  const { app, router }: Props = $props();
  const lessons = loadAllLessons();
  const nodes = $derived(buildSkillNodes(lessons));
  const chapters = $derived([...new Set(nodes.map((node) => node.chapter))].sort((a, b) => a - b));

  let progress = $state<ProgressRecord[]>([]);
  let loaded = $state(false);

  async function refresh(): Promise<void> {
    loaded = false;
    progress = await app.loadAllProgress();
    loaded = true;
  }

  $effect(() => {
    void app.activeProfile();
    void refresh();
  });

  const completed = $derived.by(() => {
    const result = new Set<string>();
    for (const record of progress) {
      if (record.completedAt !== undefined) result.add(record.skillId);
    }
    return result;
  });
  const recommendedSkillId = $derived(
    nodes.find(
      (node) => !completed.has(node.skillId) && isLessonUnlocked(node.prerequisites, completed)
    )?.skillId
  );

  function recordFor(skillId: string): ProgressRecord | undefined {
    return progress.find((record) => record.skillId === skillId);
  }

  function nodeLocked(node: SkillNode): boolean {
    return !isLessonUnlocked(node.prerequisites, completed);
  }

  function chapterCompleted(chapterNodes: SkillNode[]): number {
    return chapterNodes.filter((node) => completed.has(node.skillId)).length;
  }

  function openLesson(skillId: string): void {
    globalThis.location.hash = `#/lesson?id=${encodeURIComponent(skillId)}`;
  }

  function openMagic(magicId: string): void {
    globalThis.location.hash = `#/magic?id=${encodeURIComponent(magicId)}`;
  }
</script>

<section class="journey" aria-labelledby="journey-title">
  <header class="journey-head">
    <div>
      <h1 id="journey-title">{m.tree_heading()}</h1>
      <p>{m.lessons_locked_hint()}</p>
    </div>
    {#if loaded}
      <div class="journey-progress">
        <span>{m.tree_summary({ done: completed.size, total: nodes.length })}</span>
        <div
          class="journey-meter"
          role="progressbar"
          aria-label={m.home_lessons_done()}
          aria-valuemin="0"
          aria-valuemax={nodes.length}
          aria-valuenow={completed.size}
        >
          <span style={`--journey-progress: ${(completed.size / Math.max(nodes.length, 1)) * 100}%`}></span>
        </div>
      </div>
    {/if}
  </header>

  {#if !loaded}
    <div class="journey-loading" role="status">
      <span></span><span></span><span></span>
      <p>{m.loading()}</p>
    </div>
  {:else}
    <div class="chapters">
      {#each chapters as chapter (chapter)}
        {@const chapterNodes = nodes.filter((node) => node.chapter === chapter)}
        {@const magicSlot = CHAPTER_MAGIC_SLOTS[chapter]}
        {@const magicOpen = magicSlot ? isMagicUnlocked(chapter, nodes, completed) : false}
        {@const done = chapterCompleted(chapterNodes)}
        <section class="chapter" aria-labelledby={`chapter-${chapter}`}>
          <header class="chapter-head">
            <h2 id={`chapter-${chapter}`}>{m.tree_chapter({ n: chapter })}</h2>
            <span>{done}/{chapterNodes.length}</span>
          </header>

          <div class="chapter-nodes">
            {#each chapterNodes as node (node.skillId)}
              {@const isDone = completed.has(node.skillId)}
              {@const locked = nodeLocked(node)}
              {@const recommended = node.skillId === recommendedSkillId}
              {@const record = recordFor(node.skillId)}
              <article class="lesson" class:locked class:completed={isDone} class:recommended>
                <div class="lesson-status" aria-hidden="true">
                  {#if isDone}
                    <Icon name="check" />
                  {:else if locked}
                    <Icon name="lock" />
                  {:else}
                    <Icon name="diamond" />
                  {/if}
                </div>
                <div class="lesson-body">
                  {#if recommended}<span class="next-label">{m.tree_next_stage()}</span>{/if}
                  <h3>{resolveLocalized(node.title, activeLocale())}</h3>
                  {#if isDone && record}
                    <div class="stars" aria-label={m.lessons_stars({ n: record.stars })}>
                      {#each Array(record.stars) as _}<span>★</span>{/each}
                      {#each Array(3 - record.stars) as _}<span class="empty">★</span>{/each}
                    </div>
                  {/if}
                </div>
                <div class="lesson-action">
                  {#if locked}
                    <span class="lock-text">{m.tree_locked()}</span>
                  {:else}
                    <button
                      class:btn--primary={recommended}
                      class:btn--secondary={!recommended}
                      onclick={() => openLesson(node.skillId)}
                    >
                      {isDone ? m.lessons_replay() : m.lessons_start()}
                    </button>
                  {/if}
                </div>
              </article>
            {/each}

            {#if magicSlot}
              <article class="lesson magic-slot" class:open={magicOpen}>
                <div class="lesson-status magic" aria-hidden="true">
                  <Icon name={magicOpen ? 'top-hat' : 'sparkle'} />
                </div>
                <div class="lesson-body">
                  <h3>{m.tree_magic_slot()}</h3>
                  <p>{magicOpen ? m.tree_magic_open() : m.tree_magic_locked()}</p>
                </div>
                <div class="lesson-action">
                  {#if magicOpen}
                    <button class="btn--secondary" onclick={() => openMagic(magicSlot)}>
                      {m.tree_magic_open()}
                    </button>
                  {:else}
                    <span class="lock-text">{m.tree_locked()}</span>
                  {/if}
                </div>
              </article>
            {/if}
          </div>
        </section>
      {/each}
    </div>
  {/if}

  <button class="btn--ghost back-btn" onclick={() => router.navigate('home')}>
    ← {m.lesson_back_home()}
  </button>
</section>

<style>
  .journey {
    max-width: 62rem;
    margin-inline: auto;
    display: flex;
    flex-direction: column;
    gap: clamp(var(--space-6), 6vw, var(--space-8));
  }

  .journey-head {
    display: grid;
    gap: var(--space-5);
    padding-block-end: var(--space-5);
    border-bottom: 1px solid var(--color-rule-2);
  }

  .journey-head h1 { font-size: clamp(2.5rem, 8vw, 5.25rem); }
  .journey-head p { margin-block-start: var(--space-2); color: var(--color-muted); }

  .journey-progress {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    color: var(--color-neutral);
    font-family: var(--font-outlier);
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
  }

  .journey-meter {
    height: 0.5rem;
    overflow: hidden;
    border-radius: var(--radius-pill);
    background: var(--color-paper-3);
  }

  .journey-meter span {
    display: block;
    width: var(--journey-progress);
    height: 100%;
    border-radius: inherit;
    background: var(--color-success);
  }

  .chapters {
    display: flex;
    flex-direction: column;
    gap: clamp(var(--space-xl), 8vw, var(--space-3xl));
  }

  .chapter {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .chapter-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .chapter-head h2 { font-size: var(--text-xl); }
  .chapter-head > span {
    color: var(--color-muted);
    font-family: var(--font-outlier);
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
  }

  .chapter-nodes {
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .chapter-nodes::before {
    content: '';
    position: absolute;
    z-index: -1;
    inset-block: var(--space-5);
    inset-inline-start: calc(var(--tap) / 2);
    width: 1px;
    background: var(--color-rule-2);
  }

  .lesson {
    min-width: 0;
    display: grid;
    grid-template-columns: var(--tap) minmax(0, 1fr);
    align-items: center;
    gap: var(--space-3);
    padding-block: var(--space-4);
    border-bottom: 1px solid var(--color-rule);
  }

  .lesson.recommended,
  .lesson.magic-slot.open {
    margin-block: var(--space-2);
    padding: var(--space-4);
    border: 1px solid var(--color-rule-2);
    border-radius: var(--radius-card);
    background: var(--color-paper-2);
    box-shadow: var(--shadow-card);
  }

  .lesson-status {
    position: relative;
    z-index: 1;
    width: var(--tap);
    height: var(--tap);
    display: grid;
    place-items: center;
    border: 1px solid var(--color-rule-2);
    border-radius: 50%;
    background: var(--color-paper);
    color: var(--color-accent-strong);
    font-size: var(--text-lg);
  }

  .lesson.completed .lesson-status {
    border-color: var(--color-success);
    background: var(--color-success-surface);
    color: var(--color-success);
  }

  .lesson.locked { opacity: 0.58; }
  .lesson.locked .lesson-status { color: var(--color-muted); }

  .lesson-body { min-width: 0; }
  .lesson-body h3 { font-size: var(--text-md); font-weight: 780; }
  .lesson-body p { margin-block-start: var(--space-1); color: var(--color-muted); font-size: var(--text-sm); }

  .next-label {
    display: block;
    margin-block-end: var(--space-1);
    color: var(--color-accent-strong);
    font-size: var(--text-xs);
    font-weight: 800;
    letter-spacing: var(--tracking-label);
  }

  .stars {
    display: flex;
    gap: var(--space-3xs);
    margin-block-start: var(--space-1);
    color: var(--color-accent-strong);
    font-size: var(--text-sm);
  }

  .stars .empty { color: var(--color-rule-2); }

  .lesson-action {
    grid-column: 1 / -1;
    padding-inline-start: calc(var(--tap) + var(--space-3));
  }

  .lesson-action button { width: 100%; }
  .lock-text { color: var(--color-muted); font-size: var(--text-sm); white-space: nowrap; }
  .magic-slot .lesson-status { color: var(--color-insight); }
  .back-btn { align-self: flex-start; }

  .journey-loading {
    min-height: 22rem;
    display: grid;
    grid-template-columns: repeat(3, var(--tap));
    justify-content: center;
    align-content: center;
    gap: var(--space-4);
  }

  .journey-loading > span {
    width: var(--tap);
    height: var(--tap);
    border: 1px solid var(--color-rule);
    border-radius: 50%;
    background: var(--color-paper-3);
  }

  .journey-loading p { grid-column: 1 / -1; text-align: center; color: var(--color-muted); }

  @media (min-width: 40rem) {
    .journey-head {
      grid-template-columns: minmax(0, 1fr) minmax(13rem, 18rem);
      align-items: end;
    }

    .lesson {
      grid-template-columns: var(--tap) minmax(0, 1fr) auto;
    }

    .lesson-action {
      grid-column: auto;
      padding-inline-start: 0;
    }

    .lesson-action button { width: auto; }
  }
</style>
