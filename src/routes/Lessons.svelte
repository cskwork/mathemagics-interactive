<!--
  Hallmark · P4 H4 E4 S4 R4 V4 — 스킬 트리 화면 (docs/briefs/M4.md 산출물 7).
  #/lessons 를 챕터별 트리 뷰로 확장: 잠금/해제(PLAN §3.2 의존성) + 마술 해금 슬롯(내용물은 M5).
  잠금/완료 판정은 순수 함수(isLessonUnlocked + 진도 레코드). 트리 구조는 skill-tree.ts.
-->
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
    void app.activeProfile(); // 의존성 — 프로필 전환 시 재실행
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

<section class="stack tree">
  <header class="tree-head">
    <h2>{m.tree_heading()}</h2>
    <p class="muted small">{m.lessons_locked_hint()}</p>
  </header>

  {#if !loaded}
    <p class="muted">{m.loading()}</p>
  {:else}
    {#each chapters as ch (ch)}
      {@const completed = completedSet()}
      {@const chapterNodes = nodes.filter((n) => n.chapter === ch)}
      {@const magicSlot = CHAPTER_MAGIC_SLOTS[ch]}
      {@const magicOpen = magicSlot ? isMagicUnlocked(ch, nodes, completed) : false}
      <section class="chapter-block">
        <h3 class="chapter-title">{chapterLabel(ch)}</h3>
        <div class="chapter-nodes">
          {#each chapterNodes as node (node.skillId)}
            {@const done = isCompleted(node.skillId, completed)}
            {@const locked = nodeLocked(node, completed)}
            {@const rec = recordFor(node.skillId)}
            <article class="card lesson-row" class:locked class:completed={done}>
              <div class="lesson-mark" aria-hidden="true">
                {#if done}<Icon name="star" />{:else if locked}<Icon name="lock" />{:else}<Icon name="diamond" />{/if}
              </div>
              <div class="lesson-body">
                <h4>{resolveLocalized(node.title, activeLocale())}</h4>
                {#if done && rec}
                  <p class="muted small meta">{m.lessons_stars({ n: rec.stars })}</p>
                {/if}
              </div>
              <div class="lesson-action">
                {#if locked}
                  <span class="lock-label">{m.tree_locked()}</span>
                {:else}
                  <button
                    class="btn--primary"
                    onclick={() => openLesson(node.skillId)}
                    aria-label={done ? m.lessons_replay() : m.lessons_start()}
                  >
                    {done ? m.lessons_replay() : m.lessons_start()}
                  </button>
                {/if}
              </div>
            </article>
          {/each}
          {#if magicSlot}
            <article class="card magic-slot" class:open={magicOpen}>
              <div class="lesson-mark" aria-hidden="true">
                {#if magicOpen}<Icon name="top-hat" />{:else}<Icon name="sparkle" />{/if}
              </div>
              <div class="lesson-body">
                <h4>{m.tree_magic_slot()}</h4>
                <p class="muted small">{magicOpen ? m.tree_magic_open() : m.tree_magic_locked()}</p>
              </div>
              {#if magicOpen}
                <div class="lesson-action">
                  <button class="btn--secondary" onclick={() => openMagic(magicSlot)}>
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

  <div class="row nav-row">
    <button onclick={() => router.navigate('home')}>{m.lesson_back_home()}</button>
  </div>
</section>

<style>
  .tree-head h2 {
    font-size: var(--text-title);
  }
  .tree-head p {
    margin: 0;
  }
  .chapter-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3) 0;
    border-top: 1px solid var(--stage-edge);
  }
  .chapter-block:first-of-type {
    border-top: none;
  }
  .chapter-title {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: var(--text-lead);
    color: var(--spotlight);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: 0;
  }
  .chapter-nodes {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
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
    opacity: 0.6;
  }
  .lesson-row.locked .lesson-mark {
    color: var(--house-light);
  }
  .lesson-body {
    min-width: 0;
  }
  .lesson-body h4 {
    margin: 0;
    font-size: var(--text-body);
  }
  .meta {
    color: var(--house-light);
    margin: 0;
  }
  .lesson-action {
    min-width: var(--tap);
  }
  .lock-label {
    font-size: var(--text-small);
    color: var(--house-light);
    white-space: nowrap;
  }
  /* 마술 해금 슬롯 — 보상 자리표. 내용물은 M5. */
  .magic-slot {
    border: 1px dashed var(--stage-line);
    background: var(--stage-spotlight-bg);
  }
  .magic-slot.open {
    border-style: solid;
    border-color: var(--spotlight);
  }
  .magic-slot .lesson-mark {
    color: var(--spotlight);
  }
  .magic-slot .lesson-body h4 {
    color: var(--spotlight);
  }
  .nav-row {
    margin-top: var(--space-3);
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
