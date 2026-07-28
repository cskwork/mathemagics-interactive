<!-- Hallmark · P4 H4 E4 S3 R4 V4 — 백스테이지 대시보드 뼈대 (M7 산출물 3).
  - "오늘의 공연" 스포트라이트 카드(입장 CTA) + "내 레퍼토리" 자리표(M2+ 콘텐츠가 채울 자리).
  - 솔직성: 레슨은 M2부터. "공연 시작" CTA 는 가짜 기능이 아니라 비활성 + 안내 문구로 둔다. -->
<script lang="ts">
  import { m } from '../lib/paraglide/messages.js';
  import type { AppState } from '../lib/profiles/app-state.svelte.js';
  import type { Router } from '../lib/router/hash-router.svelte.js';

  interface Props {
    app: AppState;
    router: Router;
  }
  const { app, router }: Props = $props();

  const profile = $derived(app.activeProfile());
</script>

{#if profile}
  <section class="stack backstage">
    <div class="greet">
      <h2>{m.home_greeting({ name: profile.name })}</h2>
    </div>

    <article class="spotlight-card" aria-labelledby="today-show">
      <div class="spotlight-card-beam" aria-hidden="true"></div>
      <div class="spotlight-card-body">
        <p class="kicker">{m.home_today_show()}</p>
        <p class="muted lead">{m.home_practice_hint()}</p>
        <div class="cta-row">
          <button class="btn--primary cta" onclick={() => router.navigate('practice')}>
            {m.home_practice_cta()}
          </button>
          <button class="btn--ghost" onclick={() => router.navigate('lessons')}>
            {m.nav_lessons()}
          </button>
        </div>
      </div>
    </article>

    <section class="repertoire" aria-labelledby="repertoire-h">
      <h3 id="repertoire-h" class="muted">{m.home_repertoire()}</h3>
      <p class="muted small">{m.home_repertoire_hint()}</p>
      <div class="repertoire-grid">
        <button class="card rep-card" onclick={() => router.navigate('progress')}>
          <span class="rep-mark" aria-hidden="true">📊</span>
          <span>{m.home_progress_cta()}</span>
        </button>
        <button class="card rep-card" onclick={() => router.navigate('report')}>
          <span class="rep-mark" aria-hidden="true">💬</span>
          <span>{m.home_report_cta()}</span>
        </button>
        <button class="card rep-card" onclick={() => router.navigate('stage')}>
          <span class="rep-mark" aria-hidden="true">🎭</span>
          <span>{m.nav_stage()}</span>
        </button>
        <button class="card rep-card" onclick={() => router.navigate('magic')}>
          <span class="rep-mark" aria-hidden="true">🎩</span>
          <span>{m.nav_magic()}</span>
        </button>
        <button class="card rep-card" onclick={() => router.navigate('catch')}>
          <span class="rep-mark" aria-hidden="true">🔍</span>
          <span>{m.catch_heading()}</span>
        </button>
        <button class="card rep-card" onclick={() => router.navigate('memory')}>
          <span class="rep-mark" aria-hidden="true">🧠</span>
          <span>{m.memory_heading()}</span>
        </button>
      </div>
    </section>

    <div class="row nav-row">
      <button onclick={() => router.navigate('settings')}>{m.nav_settings()}</button>
      <button
        class="btn--ghost"
        onclick={() => {
          app.clearActiveProfile();
          router.navigate('profiles');
        }}>{m.home_switch_profile()}</button
      >
    </div>
  </section>
{/if}

<style>
  .greet h2 {
    font-size: var(--text-title);
  }

  /* 오늘의 공연 — 스포트라이트 받은 무대 중앙. 엷은 방사광 + 양각. */
  .spotlight-card {
    position: relative;
    overflow: hidden;
    border-radius: var(--radius-lg);
    background: var(--stage-mid);
    border: 1px solid var(--stage-line);
    box-shadow: var(--shadow-stage);
  }
  .spotlight-card-beam {
    position: absolute;
    inset: 0;
    background: var(--stage-spotlight-bg);
    pointer-events: none;
  }
  .spotlight-card-body {
    position: relative;
    padding: var(--space-6) var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .kicker {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: var(--text-display);
    letter-spacing: var(--tracking-display);
    color: var(--house-bright);
    margin: 0;
    line-height: 1.1;
  }
  .lead {
    font-size: var(--text-lead);
  }
  .cta-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
    margin-top: var(--space-3);
  }
  .cta {
    min-width: 10rem;
  }

  .repertoire h3 {
    font-size: var(--text-small);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
  }
  .small {
    font-size: var(--text-small);
  }
  .repertoire-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
    gap: var(--space-3);
    margin-top: var(--space-3);
  }
  .rep-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: 5.5rem;
    text-align: center;
    font-weight: 600;
    cursor: pointer;
  }
  .rep-card:hover {
    border-color: var(--spotlight);
  }
  .rep-mark {
    font-size: 1.6rem;
  }

  .nav-row {
    margin-top: var(--space-2);
  }
</style>
