<script lang="ts">
  import { m } from '../lib/paraglide/messages.js';
  import Icon from '../components/Icon.svelte';
  import ProgressRing from '../components/ProgressRing.svelte';
  import type { AppState } from '../lib/profiles/app-state.svelte.js';
  import type { Router } from '../lib/router/hash-router.svelte.js';
  import type { ProgressRecord, SrsCard } from '../lib/storage/types.js';
  import { loadAllLessons } from '../lib/lesson/loader.js';
  import { DEFAULT_SRS_CONFIG } from '../lib/srs/config.js';

  interface Props {
    app: AppState;
    router: Router;
  }
  const { app, router }: Props = $props();

  const profile = $derived(app.activeProfile());
  const settings = $derived(app.settings());
  const lessons = loadAllLessons();
  const totalLessons = lessons.length;

  let progress = $state<ProgressRecord[]>([]);
  let cards = $state<SrsCard[]>([]);
  let loaded = $state(false);

  async function refresh(): Promise<void> {
    progress = await app.loadAllProgress();
    cards = await app.loadAllCards();
    loaded = true;
  }

  $effect(() => {
    void app.activeProfile();
    void refresh();
  });

  const completedCount = $derived(
    progress.filter((r) => r.completedAt !== undefined).length
  );
  const progressPercent = $derived(
    totalLessons > 0 ? completedCount / totalLessons : 0
  );
  const streakDays = $derived(settings?.streakCount ?? 0);
  const dueCount = $derived.by(() => {
    const now = Date.now();
    return cards.filter((c) => c.due <= now).length;
  });
  const totalReviews = $derived(
    cards.reduce((sum, c) => sum + (c.total ?? 0), 0)
  );
  const totalCorrect = $derived(
    cards.reduce((sum, c) => sum + (c.correct ?? 0), 0)
  );
  const tipText = $derived.by(() => {
    const tips = [
      m.home_tip_add(), m.home_tip_mul11(), m.home_tip_square(),
      m.home_tip_mod9(), m.home_tip_complement(), m.home_tip_estimate(),
      m.home_tip_1089(),
    ];
    const dayIdx = Math.floor(Date.now() / 86400000) % tips.length;
    return tips[dayIdx] ?? tips[0]!;
  });
  const accuracy = $derived(totalReviews > 0 ? totalCorrect / totalReviews : 0);
</script>

{#if profile}
  <section class="home">
    <!-- Greeting with streak flame -->
    <div class="greet-row">
      <div class="greet">
        <p class="greet-sub">{m.home_welcome_back()}</p>
        <h2 class="greet-name">{profile.name}!</h2>
      </div>
      {#if streakDays > 0}
        <div class="streak-badge" title={m.home_streak_label()}>
          <span class="streak-flame" aria-hidden="true"><Icon name="flame" /></span>
          <span class="streak-num">{streakDays}</span>
        </div>
      {/if}
    </div>

    <!-- Quick stats row -->
    {#if loaded}
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-ring">
            <ProgressRing value={progressPercent} size={72} strokeWidth={7} />
          </div>
          <div class="stat-text">
            <span class="stat-num">{completedCount}/{totalLessons}</span>
            <span class="stat-label">{m.home_lessons_done()}</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-wrap">
            <Icon name="check" />
          </div>
          <div class="stat-text">
            <span class="stat-num">{Math.round(accuracy * 100)}%</span>
            <span class="stat-label">{m.progress_heading()}</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-wrap flame-icon">
            <Icon name="flame" />
          </div>
          <div class="stat-text">
            <span class="stat-num">{streakDays}</span>
            <span class="stat-label">{m.home_streak_label()}</span>
          </div>
        </div>
      </div>
    {/if}

    <!-- Today's Show — hero spotlight card -->
    <article class="hero" aria-labelledby="today-show">
      <div class="hero-glow" aria-hidden="true"></div>
      <div class="hero-sparkles" aria-hidden="true">
        <span class="sparkle s1"><Icon name="sparkle" /></span>
        <span class="sparkle s2"><Icon name="sparkle" /></span>
        <span class="sparkle s3"><Icon name="sparkles" /></span>
      </div>
      <div class="hero-body">
        <span class="hero-kicker" id="today-show">{m.home_today_show()}</span>
        {#if loaded && dueCount > 0}
          <p class="hero-due">{m.home_cards_due({ n: dueCount })}</p>
          <p class="hero-hint">{m.home_practice_hint()}</p>
        {:else if loaded}
          <p class="hero-hint">{m.home_practice_empty()}</p>
        {:else}
          <p class="hero-hint">{m.home_today_show_hint()}</p>
        {/if}
        <div class="hero-cta">
          <button class="btn--primary hero-btn" onclick={() => router.navigate('practice')}>
            <Icon name="play" />
            <span>{loaded && dueCount > 0 ? m.home_quick_practice() : m.home_learn_new()}</span>
            <span class="arrow" aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </article>

    <!-- Tip of the Day -->
    {#if loaded}
      <div class="tip-card bounce-in">
        <span class="tip-icon" aria-hidden="true"><Icon name="sparkle" /></span>
        <div class="tip-content">
          <span class="tip-label">{m.home_tip_title()}</span>
          <p class="tip-text">{tipText}</p>
        </div>
      </div>
    {/if}

    <!-- Repertoire grid -->
    <section class="rep" aria-labelledby="rep-h">
      <div class="rep-head">
        <h3 id="rep-h">{m.home_repertoire()}</h3>
      </div>
      <div class="rep-grid">
        <button class="rep-card" onclick={() => router.navigate('lessons')}>
          <span class="rep-icon" aria-hidden="true"><Icon name="diamond" /></span>
          <span class="rep-label">{m.home_browse_tricks()}</span>
          <span class="rep-meta">{completedCount}/{totalLessons}</span>
        </button>
        <button class="rep-card" onclick={() => router.navigate('progress')}>
          <span class="rep-icon" aria-hidden="true"><Icon name="bar-chart" /></span>
          <span class="rep-label">{m.home_progress_cta()}</span>
        </button>
        <button class="rep-card" onclick={() => router.navigate('stage')}>
          <span class="rep-icon" aria-hidden="true"><Icon name="masks" /></span>
          <span class="rep-label">{m.nav_stage()}</span>
        </button>
        <button class="rep-card" onclick={() => router.navigate('magic')}>
          <span class="rep-icon" aria-hidden="true"><Icon name="top-hat" /></span>
          <span class="rep-label">{m.nav_magic()}</span>
        </button>
        <button class="rep-card" onclick={() => router.navigate('catch')}>
          <span class="rep-icon" aria-hidden="true"><Icon name="search" /></span>
          <span class="rep-label">{m.catch_heading()}</span>
        </button>
        <button class="rep-card" onclick={() => router.navigate('memory')}>
          <span class="rep-icon" aria-hidden="true"><Icon name="brain" /></span>
          <span class="rep-label">{m.memory_heading()}</span>
        </button>
      </div>
    </section>

    <!-- Bottom nav -->
    <div class="bottom-nav">
      <button class="nav-btn" onclick={() => router.navigate('settings')}>
        <Icon name="settings" />
        <span>{m.nav_settings()}</span>
      </button>
      <button class="nav-btn" onclick={() => router.navigate('report')}>
        <Icon name="chat" />
        <span>{m.home_report_cta()}</span>
      </button>
      <button
        class="nav-btn"
        onclick={() => {
          app.clearActiveProfile();
          router.navigate('profiles');
        }}>
        <Icon name="users" />
        <span>{m.home_switch_profile()}</span>
      </button>
    </div>
  </section>
{/if}

<style>
  .home {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  /* ── Greeting with streak ── */
  .greet-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }
  .greet {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .greet-sub {
    font-size: var(--text-body);
    color: var(--house-light);
    font-weight: 500;
  }
  .greet-name {
    font-size: var(--text-title);
    font-weight: 800;
    color: var(--house-bright);
    line-height: 1.15;
    letter-spacing: var(--tracking-display);
  }

  .streak-badge {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: 0.35rem 0.75rem;
    background: linear-gradient(135deg, var(--spotlight-wash-strong), var(--spotlight-wash));
    border: 1px solid color-mix(in srgb, var(--spotlight) 30%, transparent);
    border-radius: var(--radius-pill);
    box-shadow: var(--shadow-card), 0 0 12px var(--spotlight-glow);
    animation: flame-pulse 2s ease-in-out infinite;
  }
  .streak-flame {
    font-size: 1.2rem;
    color: var(--spotlight);
    display: flex;
    animation: flicker 1.5s ease-in-out infinite;
  }
  .streak-num {
    font-family: var(--font-numeric);
    font-variant-numeric: tabular-nums;
    font-weight: 800;
    color: var(--house-bright);
    font-size: 1rem;
  }

  @keyframes flame-pulse {
    0%, 100% { box-shadow: var(--shadow-card), 0 0 12px var(--spotlight-glow); }
    50% { box-shadow: var(--shadow-card), 0 0 20px var(--spotlight-glow); }
  }
  @keyframes flicker {
    0%, 100% { transform: scale(1) rotate(-2deg); }
    50% { transform: scale(1.1) rotate(2deg); }
  }

  /* ── Stats row ── */
  .stats-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-3);
  }
  .stat-card {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3);
    background: var(--gradient-card);
    border: 1px solid var(--stage-line);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
    transition: transform var(--motion-base) var(--ease-stage);
  }
  .stat-card:hover {
    transform: translateY(-2px);
  }
  .stat-ring {
    flex-shrink: 0;
  }
  .stat-icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: var(--radius-sm);
    font-size: 1.3rem;
    color: var(--spotlight);
    background: var(--spotlight-wash);
    flex-shrink: 0;
  }
  .flame-icon {
    color: var(--spotlight);
    animation: flicker 1.5s ease-in-out infinite;
  }
  .stat-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .stat-num {
    font-family: var(--font-numeric);
    font-variant-numeric: tabular-nums;
    font-weight: 800;
    font-size: 1.1rem;
    color: var(--house-bright);
    line-height: 1.1;
  }
  .stat-label {
    font-size: var(--text-caption);
    color: var(--house-light);
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ── Hero spotlight card ── */
  .hero {
    position: relative;
    overflow: hidden;
    border-radius: var(--radius-lg);
    background: var(--gradient-card);
    border: 1px solid var(--stage-line);
    box-shadow: var(--shadow-spotlight);
  }
  .hero-glow {
    position: absolute;
    inset: 0;
    background: var(--stage-spotlight-bg);
    pointer-events: none;
  }
  .hero-sparkles {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .sparkle {
    position: absolute;
    color: var(--spotlight);
    opacity: 0.4;
    animation: float-sparkle 4s ease-in-out infinite;
  }
  .sparkle.s1 { top: 15%; right: 12%; font-size: 1.2rem; animation-delay: 0s; }
  .sparkle.s2 { top: 50%; right: 8%; font-size: 0.9rem; animation-delay: 1.5s; }
  .sparkle.s3 { top: 25%; right: 25%; font-size: 1rem; animation-delay: 2.5s; }
  @keyframes float-sparkle {
    0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.3; }
    50% { transform: translateY(-10px) rotate(15deg); opacity: 0.7; }
  }

  .hero-body {
    position: relative;
    padding: var(--space-6) var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .hero-kicker {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: var(--text-display);
    letter-spacing: var(--tracking-display);
    color: var(--house-bright);
    line-height: 1.08;
    overflow-wrap: anywhere;
  }
  .hero-due {
    font-size: var(--text-lead);
    font-weight: 700;
    color: var(--spotlight);
  }
  .hero-hint {
    font-size: var(--text-body);
    color: var(--house-light);
    line-height: 1.4;
  }
  .hero-cta {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
    margin-top: var(--space-3);
  }
  .hero-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 10rem;
    font-size: var(--text-body);
    font-weight: 800;
    padding: 0 var(--space-5);
  }
  .hero-btn :global(svg) {
    font-size: 0.85rem;
  }
  .hero-btn .arrow {
    transition: transform var(--motion-base) var(--ease-stage);
    font-weight: 700;
  }
  .hero-btn:hover .arrow {
    transform: translateX(3px);
  }

  /* ── Repertoire ── */
  .rep {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .rep-head h3 {
    font-size: var(--text-small);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
    color: var(--house-light);
  }
  .rep-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
    gap: var(--space-3);
  }
  .rep-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    min-height: 6rem;
    padding: var(--space-4) var(--space-2);
    text-align: center;
    font-weight: 600;
    font-size: var(--text-small);
    background: var(--gradient-card);
    border: 1px solid var(--stage-line);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
    cursor: pointer;
    transition:
      border-color var(--motion-base) ease,
      transform var(--motion-fast) ease,
      box-shadow var(--motion-base) ease;
    position: relative;
    overflow: hidden;
  }
  .rep-card::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 50% 0%, var(--spotlight-wash) 0%, transparent 70%);
    opacity: 0;
    transition: opacity var(--motion-base) ease;
  }
  .rep-card:hover {
    border-color: var(--spotlight);
    transform: translateY(-3px);
    box-shadow: var(--shadow-card), 0 0 24px var(--spotlight-wash);
  }
  .rep-card:hover::before {
    opacity: 1;
  }
  .rep-card:active {
    transform: translateY(-1px);
  }
  .rep-icon {
    font-size: 1.8rem;
    color: var(--spotlight);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: var(--radius-sm);
    background: var(--spotlight-wash);
    position: relative;
    z-index: 1;
  }
  .rep-label {
    color: var(--house-bright);
    position: relative;
    z-index: 1;
  }
  .rep-meta {
    font-size: var(--text-caption);
    color: var(--house-light);
    font-weight: 700;
    position: relative;
    z-index: 1;
  }

  /* ── Tip card ── */
  .tip-card {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-4);
    background: linear-gradient(135deg,
      color-mix(in srgb, var(--spotlight) 8%, var(--stage-mid)) 0%,
      var(--stage-mid) 100%);
    border: 1px solid color-mix(in srgb, var(--spotlight) 20%, var(--stage-line));
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
    position: relative;
    overflow: hidden;
  }
  .tip-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0;
    width: 3px;
    height: 100%;
    background: var(--spotlight);
  }
  .tip-icon {
    font-size: 1.4rem;
    color: var(--spotlight);
    flex-shrink: 0;
    margin-top: 2px;
    animation: icon-float 3s ease-in-out infinite;
  }
  @keyframes icon-float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }
  .tip-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .tip-label {
    font-size: var(--text-caption);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 700;
    color: var(--spotlight);
  }
  .tip-text {
    font-size: var(--text-small);
    color: var(--house-bright);
    line-height: 1.45;
  }

  /* ── Bottom nav ── */
  .bottom-nav {
    display: flex;
    gap: var(--space-4);
    justify-content: center;
    padding-top: var(--space-4);
    border-top: 1px solid var(--stage-line);
  }
  .nav-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    background: none;
    border: none;
    color: var(--house-light);
    font-weight: 600;
    font-size: var(--text-small);
    padding: var(--space-2) var(--space-3);
    cursor: pointer;
    transition: color var(--motion-base) ease;
    min-width: auto;
    min-height: auto;
  }
  .nav-btn:hover {
    background: none;
    color: var(--house-bright);
  }

  @media (max-width: 380px) {
    .stats-row {
      gap: var(--space-2);
    }
    .stat-card {
      padding: var(--space-2);
    }
    .stat-label {
      font-size: 0.7rem;
    }
  }
</style>
