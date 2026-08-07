<!--
  Hallmark · P4 H4 E4 S4 R4 V4 — 보호자 리포트 (docs/briefs/M3.md 산출물 7).
  이번 주 배운 전략 + "아이와 나눌 대화 소재 1개"(PLAN §4.5 — 행동 지향, 비교·순위 없음).
  대화 소재는 report.ts 순수 함수가 결정적 샘플 문제로 생성. 텍스트 ko/en Localized.
  프라이버시 안내: 모든 기록은 이 기기에만(PLAN §7.2 COPPA 정합 — 수집 자체가 없음).
-->
<script lang="ts">
  import { m } from '../lib/paraglide/messages.js';
  import { activeLocale } from '../lib/i18n/locale.svelte.js';
  import { resolveLocalized } from '../lib/content/localized.js';
  import { loadAllLessons } from '../lib/lesson/loader.js';
  import type { AppState } from '../lib/profiles/app-state.svelte.js';
  import type { Router } from '../lib/router/hash-router.svelte.js';
  import type { ProgressRecord } from '../lib/storage/types.js';
  import { buildWeeklyReport, type LearnedTechnique } from '../lib/srs/report.js';

  interface Props {
    app: AppState;
    router: Router;
  }
  const { app, router }: Props = $props();

  const lessons = loadAllLessons();

  let progress: ProgressRecord[] = $state([]);
  let loaded = $state(false);

  async function refresh(): Promise<void> {
    progress = await app.loadAllProgress();
    loaded = true;
  }
  $effect(() => {
    void app.activeProfile();
    void refresh();
  });

  // 완료된 기법 → LearnedTechnique (report.ts 입력).
  const learned = $derived.by<LearnedTechnique[]>(() => {
    const out: LearnedTechnique[] = [];
    for (const p of progress) {
      if (p.completedAt === undefined) continue;
      const lesson = lessons.find((l) => l.file.skillId === p.skillId);
      if (!lesson) continue;
      const ps = lesson.file.practice.problemSet;
      out.push({
        skillId: lesson.file.skillId,
        title: lesson.file.title,
        rule: lesson.file.rule,
        completedAt: p.completedAt,
        op: ps.op,
        method: ps.method,
        ...(ps.estOf !== undefined ? { estOf: ps.estOf } : {}),
        sampleDigits: Math.max(2, ps.digits - 1),
        sampleCarry: ps.carry
      });
    }
    return out;
  });

  const report = $derived(buildWeeklyReport(learned, Date.now()));
</script>

<section class="stack report">
  <header class="report-head">
    <h2>{m.report_heading()}</h2>
  </header>

  {#if !loaded}
    <p class="muted">{m.loading()}</p>
  {:else}
    <section aria-labelledby="week-h">
      <h3 id="week-h" class="section-h">{m.report_this_week()}</h3>
      {#if report.learnedThisWeek.length === 0}
        <p class="card muted">{m.report_no_learned()}</p>
      {:else}
        <ul class="strategy-list" role="list">
          {#each report.learnedThisWeek as t (t.skillId)}
            <li class="card strategy-item">
              <p class="strategy-title">{resolveLocalized(t.title, activeLocale())}</p>
              <p class="muted small">{resolveLocalized(t.rule, activeLocale())}</p>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    {#if report.conversationStarter}
      {@const cs = report.conversationStarter}
      <article class="card starter-card" aria-labelledby="starter-h">
        <p id="starter-h" class="starter-title">{m.report_conversation_starter_title()}</p>
        <p class="muted small">{m.report_conversation_starter_hint()}</p>
        <p class="starter-prompt" aria-live="polite">{resolveLocalized(cs.prompt, activeLocale())}</p>
      </article>
    {/if}

    <p class="muted small privacy">{m.report_privacy_note()}</p>

    <div class="row nav-row">
      <button onclick={() => router.navigate('home')}>{m.report_back()}</button>
      <button class="btn--ghost" onclick={() => router.navigate('progress')}>{m.nav_progress()}</button>
    </div>
  {/if}
</section>

<style>
  .report-head h2 {
    font-size: var(--text-title);
  }
  .section-h {
    font-size: var(--text-small);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
    margin-top: var(--space-4);
    color: var(--house-light);
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .section-h::before {
    content: '';
    width: 3px;
    height: 1em;
    background: var(--spotlight);
    border-radius: var(--radius-pill);
    display: inline-block;
  }
  .small {
    font-size: var(--text-small);
  }

  .strategy-list {
    list-style: none;
    padding: 0;
    margin: var(--space-3) 0 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .strategy-item {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    transition: border-color var(--motion-base) ease;
  }
  .strategy-item:hover {
    border-color: var(--stage-edge);
  }
  .strategy-title {
    font-weight: 700;
    margin: 0;
    overflow-wrap: anywhere;
    color: var(--spotlight);
  }

  /* 대화 소재 카드 — 스포트라이트 강조(가장 행동 지향적 정보). */
  .starter-card {
    background: color-mix(in srgb, var(--stage-mid) 85%, var(--spotlight) 15%);
    border: 1px solid color-mix(in srgb, var(--spotlight) 35%, var(--stage-line));
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-top: var(--space-4);
    box-shadow: var(--shadow-card), 0 0 20px var(--spotlight-wash);
    position: relative;
    overflow: hidden;
  }
  .starter-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0;
    width: 3px;
    height: 100%;
    background: var(--spotlight);
  }
  .starter-title {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: var(--text-lead);
    margin: 0;
  }
  .starter-prompt {
    font-size: var(--text-body);
    line-height: 1.6;
    color: var(--house-bright);
    padding: var(--space-2) var(--space-3);
    background: var(--stage-floor);
    border-radius: var(--radius);
  }

  .privacy {
    text-align: center;
    margin-top: var(--space-5);
  }

  .nav-row {
    margin-top: var(--space-3);
  }
</style>
