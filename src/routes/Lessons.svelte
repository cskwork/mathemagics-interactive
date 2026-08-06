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
  const chapters = $derived([...new Set(nodes.map((n) => n.chapter))].sort((a, b) => a - b));

  let progress = $state<ProgressRecord[]>([]);
  let loaded = $state(false);

  async function refresh(): Promise<void> {
    progress = await app.loadAllProgress();
    loaded = true;
  }

  $effect(() => {
    void app.activeProfile();
    void refresh();
  });

  function completedSet(): Set<string> {
    const set = new Set<string>();
    for (const r of progress) {
      if (r.completedAt !== undefined) set.add(r.skillId);
    }
    return set;
  }
  function recordFor(skillId: string): ProgressRecord | undefined {
    return progress.find((r) => r.skillId === skillId);
  }
  function isCompleted(skillId: string, completed: Set<string>): boolean {
    return completed.has(skillId);
  }
  function nodeLocked(node: SkillNode, completed: Set<string>): boolean {
    return !isLessonUnlocked(node.prerequisites, completed);
  }
  function completedCount(chapterNodes: SkillNode[], completed: Set<string>): number {
    return chapterNodes.filter((n) => completed.has(n.skillId)).length;
  }

  function openLesson(skillId: string): void {
    globalThis.location.hash = `#/lesson?id=${encodeURIComponent(skillId)}`;
  }
  function openMagic(magicId: string): void {
    globalThis.location.hash = `#/magic?id=${encodeURIComponent(magicId)}`;
  }
  function chapterLabel(ch: number): string {
    return m.tree_chapter({ n: ch });
  }
</script>

<section class="tree">
  <header class="tree-head">
    <h2>{m.tree_heading()}</h2>
    <p class="muted">{m.lessons_locked_hint()}</p>
  </header>

  {#if !loaded}
    <p class="muted loading">{m.loading()}</p>
  {:else}
    {#each chapters as ch (ch)}
      {@const completed = completedSet()}
      {@const chapterNodes = nodes.filter((n) => n.chapter === ch)}
      {@const magicSlot = CHAPTER_MAGIC_SLOTS[ch]}
      {@const magicOpen = magicSlot ? isMagicUnlocked(ch, nodes, completed) : false}
      {@const done = completedCount(chapterNodes, completed)}
      {@const total = chapterNodes.length}
      <section class="chapter">
        <div class="chapter-head">
          <h3 class="chapter-title">{chapterLabel(ch)}</h3>
          {#if total > 0}
            <span class="chapter-count">{done}/{total}</span>
          {/if}
        </div>
        <div class="chapter-nodes">
          {#each chapterNodes as node (node.skillId)}
            {@const isDone = isCompleted(node.skillId, completed)}
            {@const locked = nodeLocked(node, completed)}
            {@const rec = recordFor(node.skillId)}
            <article class="lesson" class:locked class:completed={isDone}>
              <div class="lesson-status" aria-hidden="true">
                {#if isDone}<Icon name="check" />{:else if locked}<Icon name="lock" />{:else}<Icon name="diamond" />{/if}
              </div>
              <div class="lesson-body">
                <h4>{resolveLocalized(node.title, activeLocale())}</h4>
                {#if isDone && rec}
                  <div class="stars" aria-label={m.lessons_stars({ n: rec.stars })}>
                    {#each Array(rec.stars) as _}<span class="star">★</span>{/each}
                    {#each Array(3 - rec.stars) as _}<span class="star-empty">★</span>{/each}
                  </div>
                {/if}
              </div>
              <div class="lesson-action">
                {#if locked}
                  <span class="lock-text">{m.tree_locked()}</span>
                {:else}
                  <button
                    class="btn--primary lesson-btn"
                    onclick={() => openLesson(node.skillId)}
                    aria-label={isDone ? m.lessons_replay() : m.lessons_start()}
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
                {#if magicOpen}<Icon name="top-hat" />{:else}<Icon name="sparkle" />{/if}
              </div>
              <div class="lesson-body">
                <h4>{m.tree_magic_slot()}</h4>
                <p class="muted small">{magicOpen ? m.tree_magic_open() : m.tree_magic_locked()}</p>
              </div>
              {#if magicOpen}
                <div class="lesson-action">
                  <button class="btn--secondary lesson-btn" onclick={() => openMagic(magicSlot)}>
                    {m.tree_magic_open()}
                  </button>
                </div>
              {/if}
            </article>
          {/if}
        </div>
      </section>
    {/each}
  {/if}

  <button class="btn--ghost back-btn" onclick={() => router.navigate('home')}>
    ← {m.lesson_back_home()}
  </button>
</section>

<style>
  .tree {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }
  .tree-head h2 {
    font-size: var(--text-title);
    margin-bottom: var(--space-1);
  }
  .tree-head p {
    font-size: var(--text-small);
  }

  /* ── Chapter ── */
  .chapter {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .chapter-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }
  .chapter-title {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: var(--text-lead);
    color: var(--spotlight);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin: 0;
  }
  .chapter-count {
    font-size: var(--text-small);
    color: var(--house-light);
    font-weight: 600;
    background: var(--stage-mid);
    padding: 0.15rem 0.6rem;
    border-radius: var(--radius-pill);
    border: 1px solid var(--stage-line);
  }
  .chapter-nodes {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  /* ── Lesson row ── */
  .lesson {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: var(--space-3);
    align-items: center;
    background: var(--gradient-card);
    border: 1px solid var(--stage-line);
    border-radius: var(--radius);
    padding: var(--space-3);
    box-shadow: var(--shadow-card);
    transition: border-color var(--motion-base) ease;
  }
  .lesson:not(.locked):hover {
    border-color: var(--stage-edge);
  }
  .lesson-status {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: var(--radius-sm);
    font-size: 1.2rem;
    color: var(--spotlight);
    background: var(--spotlight-wash);
    flex-shrink: 0;
  }
  .lesson.completed .lesson-status {
    color: var(--applause);
    background: var(--applause-wash);
  }
  .lesson.locked {
    opacity: 0.55;
  }
  .lesson.locked .lesson-status {
    color: var(--house-light);
    background: var(--stage-mid);
  }
  .lesson-body {
    min-width: 0;
  }
  .lesson-body h4 {
    margin: 0;
    font-size: var(--text-body);
    font-weight: 700;
    overflow-wrap: anywhere;
  }
  .stars {
    display: flex;
    gap: 2px;
    margin-top: 2px;
  }
  .star {
    color: var(--spotlight);
    font-size: 0.85rem;
  }
  .star-empty {
    color: var(--stage-edge);
    font-size: 0.85rem;
    opacity: 0.4;
  }
  .lesson-action {
    min-width: var(--tap);
  }
  .lesson-btn {
    font-size: var(--text-small);
    padding: 0 var(--space-4);
    min-height: calc(var(--tap) * 0.85);
  }
  .lock-text {
    font-size: var(--text-small);
    color: var(--house-light);
    white-space: nowrap;
  }

  /* ── Magic slot ── */
  .magic-slot {
    border: 1px dashed var(--stage-line);
  }
  .magic-slot.open {
    border-style: solid;
    border-color: var(--spotlight);
    box-shadow: var(--shadow-card), 0 0 16px var(--spotlight-wash);
  }
  .lesson-status.magic {
    color: var(--spotlight);
  }
  .magic-slot .lesson-body h4 {
    color: var(--spotlight);
  }

  /* ── Back ── */
  .back-btn {
    align-self: flex-start;
    margin-top: var(--space-2);
  }

  @media (max-width: 360px) {
    .lesson {
      grid-template-columns: auto 1fr;
    }
    .lesson-action {
      grid-column: 1 / -1;
    }
    .lesson-btn {
      width: 100%;
    }
  }
</style>
