<!--
  Hallmark · P4 H4 E4 S4 R4 V4 — 마술 라우트 (M5 산출물 5). #/magic
  ?id= 로 특정 트릭 재생, 없으면 해금된 트릭 목록. 스킬트리 해금 슬롯 클릭이 여기로 연결.
-->
<script lang="ts">
  import { m } from '../lib/paraglide/messages.js';
  import Icon from '../components/Icon.svelte';
  import { activeLocale } from '../lib/i18n/locale.svelte.js';
  import { resolveLocalized } from '../lib/content/localized.js';
  import { MAGIC_TRICKS, findMagicTrick } from '../lib/magic/tricks.js';
  import { loadAllLessons } from '../lib/lesson/loader.js';
  import { isChapterComplete } from '../lib/lesson/skill-tree.js';
  import { buildSkillNodes } from '../lib/lesson/skill-tree.js';
  import MagicTrick from '../components/MagicTrick.svelte';
  import type { AppState } from '../lib/profiles/app-state.svelte.js';
  import type { Router } from '../lib/router/hash-router.svelte.js';
  import type { ProgressRecord } from '../lib/storage/types.js';

  interface Props {
    app: AppState;
    router: Router;
  }
  const { app, router }: Props = $props();

  const lessons = loadAllLessons();
  const nodes = buildSkillNodes(lessons);

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
    const s = new Set<string>();
    for (const r of progress) if (r.completedAt !== undefined) s.add(r.skillId);
    return s;
  }
  function trickUnlocked(chapter: number): boolean {
    return isChapterComplete(chapter, nodes, completedSet());
  }

  // ?id= 쿼리에서 트릭 id 추출.
  let trickId = $state<string | undefined>(undefined);
  function readHash(): void {
    const h = globalThis.location?.hash ?? '';
    const q = h.split('?')[1] ?? '';
    const params = new URLSearchParams(q);
    trickId = params.get('id') ?? undefined;
  }
  $effect(() => {
    readHash();
    globalThis.addEventListener?.('hashchange', readHash);
    return () => globalThis.removeEventListener?.('hashchange', readHash);
  });

  const activeTrick = $derived(trickId ? findMagicTrick(trickId) : undefined);
</script>

<section class="stack">
  {#if activeTrick}
    <MagicTrick trick={activeTrick} />
    <div class="row">
      <button class="btn--ghost" onclick={() => { trickId = undefined; globalThis.location.hash = '#/magic'; }}>
        {m.lessons_back_to_list()}
      </button>
    </div>
  {:else if !loaded}
    <p class="muted">{m.loading()}</p>
  {:else}
    <header>
      <h2>{m.magic_heading()}</h2>
      <p class="muted">{m.magic_pick_any()}</p>
    </header>
    <ul class="trick-list" role="list">
      {#each MAGIC_TRICKS as trick (trick.id)}
        {@const open = trickUnlocked(trick.unlockChapter)}
        <li>
          <button
            class="card trick-card"
            class:locked={!open}
            disabled={!open}
            onclick={() => (globalThis.location.hash = `#/magic?id=${trick.id}`)}
          >
            <span class="trick-mark" aria-hidden="true">{#if open}<Icon name="top-hat" />{:else}<Icon name="sparkle" />{/if}</span>
            <span class="trick-title">{resolveLocalized(trick.title, activeLocale())}</span>
            {#if !open}<span class="muted small">{m.magic_locked()}</span>{/if}
          </button>
        </li>
      {/each}
    </ul>
    <div class="row">
      <button onclick={() => router.navigate('home')}>{m.lesson_back_home()}</button>
    </div>
  {/if}
</section>

<style>
  h2 {
    font-size: var(--text-title);
    margin: 0;
  }
  .trick-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    gap: var(--space-3);
  }
  .trick-card {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-4);
    cursor: pointer;
    text-align: center;
    min-height: calc(var(--tap) * 2.4);
    justify-content: center;
  }
  .trick-card:hover:not(.locked) {
    border-color: var(--spotlight);
  }
  .trick-card.locked {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .trick-mark {
    font-size: 1.8rem;
    color: var(--spotlight);
  }
  .trick-title {
    font-weight: 700;
    color: var(--house-bright);
  }
</style>
