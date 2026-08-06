<!--
  Hallmark · P4 H4 E4 S4 R4 V4 — 학습자 진도 화면 (docs/briefs/M3.md 산출물 6).
  기법별 숙련도(학습 전/학습 중/게이트 통과/유창) + 최근 활동 + 관대한 스트릭.
  비교·순위 없음(PLAN §4.2-11). 게이트 통과한 기법만 속도 모드 표시.
  모든 색/폰트 M7 토큰, 컴포넌트 재사용. gate/difficulty 순수 함수로 숙련도 산출.
-->
<script lang="ts">
  import { m } from '../lib/paraglide/messages.js';
  import Icon from '../components/Icon.svelte';
  import { activeLocale } from '../lib/i18n/locale.svelte.js';
  import { resolveLocalized } from '../lib/content/localized.js';
  import { loadAllLessons } from '../lib/lesson/loader.js';
  import type { AppState } from '../lib/profiles/app-state.svelte.js';
  import type { Router } from '../lib/router/hash-router.svelte.js';
  import type { ProgressRecord, SrsCard } from '../lib/storage/types.js';
  import { DEFAULT_SRS_CONFIG } from '../lib/srs/config.js';
  import { proficiencyOf, techniqueStats } from '../lib/srs/integration.js';
  import type { ProficiencyLevel } from '../lib/srs/types.js';

  interface Props {
    app: AppState;
    router: Router;
  }
  const { app, router }: Props = $props();

  const lessons = loadAllLessons();

  let cards: SrsCard[] = $state([]);
  let progress: ProgressRecord[] = $state([]);
  let loaded = $state(false);

  async function refresh(): Promise<void> {
    cards = await app.loadAllCards();
    progress = await app.loadAllProgress();
    loaded = true;
  }
  $effect(() => {
    void app.activeProfile();
    void refresh();
  });

  function proficiencyKey(level: ProficiencyLevel): string {
    switch (level) {
      case 'pre-learning':
        return m.proficiency_pre_learning();
      case 'learning':
        return m.proficiency_learning();
      case 'gate-passed':
        return m.proficiency_gate_passed();
      case 'fluent':
        return m.proficiency_fluent();
    }
  }

  /** 완료된 기법(숙련도 표시 대상) — 레슨 completedAt 기준. */
  const techniques = $derived(
    lessons
      .filter((l) => progress.some((p) => p.skillId === l.file.skillId && p.completedAt !== undefined))
      .map((l) => {
        const prog = progress.find((p) => p.skillId === l.file.skillId);
        const stats = techniqueStats(l.file.skillId, cards, prog);
        const decision = proficiencyOf(l.file.skillId, cards, prog, DEFAULT_SRS_CONFIG);
        return { lesson: l, prog, stats, decision };
      })
  );

  const streak = $derived.by(() => {
    const s = app.settings();
    return {
      count: s?.streakCount ?? 0,
      freezes: s?.freezesAvailable ?? DEFAULT_SRS_CONFIG.streakDefaultFreezes
    };
  });

  // 최근 활동: completedAt 기준 최신순 5.
  const recent = $derived(
    progress
      .filter((p) => p.completedAt !== undefined)
      .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
      .slice(0, 5)
  );

  function skillTitle(skillId: string): string {
    const l = lessons.find((x) => x.file.skillId === skillId);
    return l ? resolveLocalized(l.file.title, activeLocale()) : skillId;
  }
</script>

<section class="stack progress">
  <header class="progress-head">
    <h2>{m.progress_heading()}</h2>
  </header>

  {#if !loaded}
    <p class="muted">{m.loading()}</p>
  {:else}
    {@const st = streak}
    {#if st.count > 0}
      <article class="card streak-card" aria-label={m.progress_streak_label()}>
        <span class="streak-mark" aria-hidden="true"><Icon name="flame" /></span>
        <span class="streak-text">{m.progress_streak_days({ n: st.count })}</span>
      </article>
    {/if}

    <section aria-labelledby="tech-h">
      <h3 id="tech-h" class="section-h">{m.progress_per_technique()}</h3>
      {#if techniques.length === 0}
        <p class="card muted">{m.progress_no_techniques()}</p>
      {:else}
        <ul class="tech-list" role="list">
          {#each techniques as t (t.lesson.file.skillId)}
            <li class="card tech-row">
              <div class="tech-main">
                <p class="tech-title">{resolveLocalized(t.lesson.file.title, activeLocale())}</p>
                <p class="badge level-{t.decision.level}">{proficiencyKey(t.decision.level)}</p>
              </div>
              <div class="tech-meta">
                {#if t.stats.total > 0}
                  <span class="muted small"
                    >{m.progress_accuracy({ pct: Math.round(t.decision.accuracy * 100) })} ·
                    {m.progress_reviews({ n: t.stats.total })}</span
                  >
                {/if}
                {#if t.decision.level === 'learning'}
                  <span class="muted small">{m.progress_time_locked()}</span>
                {/if}
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <section aria-labelledby="recent-h">
      <h3 id="recent-h" class="section-h">{m.progress_recent_activity()}</h3>
      {#if recent.length === 0}
        <p class="muted small">{m.progress_no_activity()}</p>
      {:else}
        <ul class="recent-list" role="list">
          {#each recent as r (r.skillId)}
            <li class="recent-row">
              <span>{skillTitle(r.skillId)}</span>
              {#if r.completedAt}
                <span class="muted small">{new Date(r.completedAt).toLocaleDateString()}</span>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <div class="row nav-row">
      <button class="btn--primary" onclick={() => router.navigate('practice')}>{m.nav_practice()}</button>
      <button onclick={() => router.navigate('home')}>{m.practice_back_home()}</button>
    </div>
  {/if}
</section>

<style>
  .progress-head h2 {
    font-size: var(--text-title);
  }
  .section-h {
    font-size: var(--text-small);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
    margin-top: var(--space-4);
  }
  .small {
    font-size: var(--text-small);
  }

  /* 스트릭 카드 — 손실 프레임 아님, "N일 연속" 축하 톤. */
  .streak-card {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    background: var(--applause-wash);
    border: 1px solid color-mix(in srgb, var(--applause) 40%, var(--stage-line));
  }
  .streak-mark {
    font-size: 1.4rem;
    color: var(--spotlight);
  }
  .streak-text {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: var(--text-lead);
  }

  .tech-list,
  .recent-list {
    list-style: none;
    padding: 0;
    margin: var(--space-3) 0 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .tech-row {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .tech-main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  .tech-title {
    font-weight: 600;
    margin: 0;
    overflow-wrap: anywhere;
  }
  .badge {
    font-size: var(--text-small);
    font-weight: 700;
    padding: 2px var(--space-2);
    border-radius: var(--radius-pill);
    border: 1px solid var(--stage-line);
  }
  .level-pre-learning {
    color: var(--house-light);
  }
  .level-learning {
    color: var(--spotlight);
    border-color: var(--spotlight);
  }
  .level-gate-passed {
    color: var(--applause);
    border-color: var(--applause);
  }
  .level-fluent {
    color: var(--spotlight-ink);
    background: var(--spotlight);
    border-color: var(--spotlight);
  }
  .tech-meta {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .recent-row {
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-1) 0;
  }

  .nav-row {
    margin-top: var(--space-4);
  }
</style>
