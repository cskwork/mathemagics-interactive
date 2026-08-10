<script lang="ts">
  import { m } from '../lib/paraglide/messages.js';
  import Icon from '../components/Icon.svelte';
  import ProgressRing from '../components/ProgressRing.svelte';
  import type { AppState } from '../lib/profiles/app-state.svelte.js';
  import type { Router } from '../lib/router/hash-router.svelte.js';
  import type { ProgressRecord, SrsCard } from '../lib/storage/types.js';
  import { loadAllLessons } from '../lib/lesson/loader.js';
  import { isLessonUnlocked } from '../lib/lesson/state-machine.js';
  import { buildSkillNodes } from '../lib/lesson/skill-tree.js';

  interface Props {
    app: AppState;
    router: Router;
  }

  const { app, router }: Props = $props();
  const profile = $derived(app.activeProfile());
  const settings = $derived(app.settings());
  const lessons = loadAllLessons();
  const nodes = buildSkillNodes(lessons);
  const totalLessons = lessons.length;

  let progress = $state<ProgressRecord[]>([]);
  let cards = $state<SrsCard[]>([]);
  let loaded = $state(false);

  async function refresh(): Promise<void> {
    loaded = false;
    progress = await app.loadAllProgress();
    cards = await app.loadAllCards();
    loaded = true;
  }

  $effect(() => {
    void app.activeProfile();
    void refresh();
  });

  const completedCount = $derived(progress.filter((record) => record.completedAt !== undefined).length);
  const progressPercent = $derived(totalLessons > 0 ? completedCount / totalLessons : 0);
  const streakDays = $derived(settings?.streakCount ?? 0);
  const dueCount = $derived.by(() => {
    const now = Date.now();
    return cards.filter((card) => card.due <= now).length;
  });
  const totalReviews = $derived(cards.reduce((sum, card) => sum + (card.total ?? 0), 0));
  const totalCorrect = $derived(cards.reduce((sum, card) => sum + (card.correct ?? 0), 0));
  const accuracy = $derived(totalReviews > 0 ? totalCorrect / totalReviews : 0);
  const completedSkillIds = $derived(
    new Set(progress.filter((record) => record.completedAt !== undefined).map((record) => record.skillId))
  );
  const recommendedSkillId = $derived(
    nodes.find(
      (node) =>
        !completedSkillIds.has(node.skillId) &&
        isLessonUnlocked(node.prerequisites, completedSkillIds)
    )?.skillId
  );
  const primaryHref = $derived(
    dueCount > 0
      ? '#/practice'
      : recommendedSkillId
        ? `#/lesson?id=${encodeURIComponent(recommendedSkillId)}`
        : '#/lessons'
  );
  const primaryLabel = $derived(
    dueCount > 0
      ? m.home_quick_practice()
      : recommendedSkillId
        ? m.home_learn_new()
        : m.home_browse_tricks()
  );
  const tipText = $derived.by(() => {
    const tips = [
      m.home_tip_add(),
      m.home_tip_mul11(),
      m.home_tip_square(),
      m.home_tip_mod9(),
      m.home_tip_complement(),
      m.home_tip_estimate(),
      m.home_tip_1089(),
      m.home_tip_div(),
      m.home_tip_mul2x1(),
      m.home_tip_sub_ltr()
    ];
    const dayIndex = Math.floor(Date.now() / 86_400_000) % tips.length;
    return tips[dayIndex] ?? tips[0]!;
  });

  function switchProfile(): void {
    app.clearActiveProfile();
    router.navigate('profiles');
  }
</script>

{#if profile}
  <section class="home" aria-labelledby="home-title">
    <header class="welcome">
      <div>
        <p class="welcome-line">{m.home_welcome_back()}</p>
        <h1 id="home-title">{profile.name}!</h1>
      </div>
      {#if streakDays > 0}
        <div class="streak" aria-label={`${m.home_streak_label()} ${streakDays}`}>
          <Icon name="flame" />
          <strong>{streakDays}</strong>
        </div>
      {/if}
    </header>

    <div class="dashboard">
      <article class="today" aria-labelledby="today-title">
        <div class="today-copy">
          <h2 id="today-title">{m.home_today_show()}</h2>
          {#if loaded && dueCount > 0}
            <p class="today-status">{m.home_cards_due({ n: dueCount })}</p>
            <p class="today-hint" id="today-hint">{m.home_practice_hint()}</p>
          {:else if loaded}
            <p class="today-status">{m.home_no_cards()}</p>
            <p class="today-hint" id="today-hint">{m.home_practice_empty()}</p>
          {:else}
            <p class="today-hint" id="today-hint">{m.loading()}</p>
          {/if}
          {#if loaded}
            <a class="today-action btn--primary" href={primaryHref} aria-describedby="today-hint">
              <Icon name={dueCount > 0 ? 'play' : 'diamond'} />
              <span>{primaryLabel}</span>
              <Icon name="chevron-right" />
            </a>
          {:else}
            <button class="today-action btn--primary" disabled>
              <Icon name="diamond" />
              <span>{m.loading()}</span>
            </button>
          {/if}
        </div>

        <div class="math-beat" aria-hidden="true">
          <span>47 × 6</span>
          <span class="math-bridge">40×6 + 7×6</span>
          <strong>282</strong>
        </div>
      </article>

      <section class="pulse-board" aria-label={m.home_progress_cta()}>
        {#if loaded}
          <ProgressRing
            value={progressPercent}
            size={104}
            strokeWidth={9}
            label={`${completedCount}/${totalLessons}`}
            sublabel={m.home_lessons_done()}
          />
          <dl>
            <div>
              <dt>{m.progress_heading()}</dt>
              <dd>{Math.round(accuracy * 100)}%</dd>
            </div>
            <div>
              <dt>{m.home_streak_label()}</dt>
              <dd>{streakDays}</dd>
            </div>
            <div>
              <dt>{m.home_cards_due({ n: dueCount })}</dt>
              <dd>{dueCount}</dd>
            </div>
          </dl>
        {:else}
          <div class="metric-skeleton" aria-hidden="true"></div>
          <p class="muted">{m.loading()}</p>
        {/if}
      </section>

      {#if loaded}
        <aside class="daily-tip" aria-labelledby="tip-title">
          <span class="tip-mark" aria-hidden="true"><Icon name="sparkle" /></span>
          <div>
            <h2 id="tip-title">{m.home_tip_title()}</h2>
            <p>{tipText}</p>
          </div>
        </aside>
      {/if}
    </div>

    <section class="repertoire" aria-labelledby="repertoire-title">
      <div class="section-head">
        <h2 id="repertoire-title">{m.home_repertoire()}</h2>
        <p>{m.home_ready_stage()}</p>
      </div>
      <div class="repertoire-grid">
        <a class="repertoire-link lessons" href="#/lessons">
          <span class="repertoire-icon" aria-hidden="true"><Icon name="diamond" /></span>
          <strong>{m.home_browse_tricks()}</strong>
          <span>{completedCount}/{totalLessons}</span>
          <Icon name="chevron-right" />
        </a>
        <a class="repertoire-link progress" href="#/progress">
          <span class="repertoire-icon" aria-hidden="true"><Icon name="bar-chart" /></span>
          <strong>{m.home_progress_cta()}</strong>
          <Icon name="chevron-right" />
        </a>
        <a class="repertoire-link" href="#/stage">
          <span class="repertoire-icon" aria-hidden="true"><Icon name="masks" /></span>
          <strong>{m.nav_stage()}</strong>
          <Icon name="chevron-right" />
        </a>
        <a class="repertoire-link magic" href="#/magic">
          <span class="repertoire-icon" aria-hidden="true"><Icon name="top-hat" /></span>
          <strong>{m.nav_magic()}</strong>
          <Icon name="chevron-right" />
        </a>
        <a class="repertoire-link" href="#/catch">
          <span class="repertoire-icon" aria-hidden="true"><Icon name="search" /></span>
          <strong>{m.catch_heading()}</strong>
          <Icon name="chevron-right" />
        </a>
        <a class="repertoire-link memory" href="#/memory">
          <span class="repertoire-icon" aria-hidden="true"><Icon name="brain" /></span>
          <strong>{m.memory_heading()}</strong>
          <Icon name="chevron-right" />
        </a>
      </div>
    </section>

    <nav class="utility-nav" aria-label={m.nav_settings()}>
      <a href="#/settings"><Icon name="settings" /><span>{m.nav_settings()}</span></a>
      <a href="#/report"><Icon name="chat" /><span>{m.home_report_cta()}</span></a>
      <button class="btn--ghost" onclick={switchProfile}>
        <Icon name="users" /><span>{m.home_switch_profile()}</span>
      </button>
    </nav>
  </section>
{/if}

<style>
  .home {
    display: flex;
    flex-direction: column;
    gap: clamp(var(--space-6), 5vw, var(--space-8));
  }

  .welcome {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .welcome-line {
    margin-block-end: var(--space-1);
    color: var(--color-muted);
    font-weight: 650;
  }

  .welcome h1 {
    font-size: clamp(2.25rem, 8vw, 4.75rem);
  }

  .streak {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--tap);
    padding-inline: var(--space-3);
    border: 1px solid var(--color-rule-2);
    border-radius: var(--radius-pill);
    background: var(--color-paper-2);
    color: var(--color-accent-strong);
    font-variant-numeric: tabular-nums;
  }

  .dashboard {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-4);
  }

  .today {
    position: relative;
    min-width: 0;
    overflow: hidden;
    display: grid;
    gap: var(--space-5);
    padding: clamp(var(--space-5), 6vw, var(--space-7));
    border: 1px solid var(--color-rule-2);
    border-radius: var(--radius-large);
    background: var(--color-stage);
    color: var(--color-stage-ink);
    box-shadow: var(--shadow-stage);
  }

  .today-copy {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
  }

  .today h2 {
    max-width: 9ch;
    font-size: clamp(2.5rem, 10vw, 5.5rem);
    letter-spacing: var(--tracking-display);
  }

  .today-status {
    color: var(--color-accent);
    font-size: var(--text-lg);
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  .today-hint {
    max-width: 34rem;
    color: var(--color-stage-muted);
  }

  .today-action {
    min-height: var(--tap);
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    margin-block-start: var(--space-2);
    padding-inline: var(--space-4);
    border: 1px solid var(--color-accent);
    border-radius: var(--radius-input);
    background: var(--color-accent);
    color: var(--color-accent-ink);
    font-weight: 820;
    line-height: 1;
    text-decoration: none;
    white-space: nowrap;
    transition: transform var(--dur-micro) var(--ease-out);
  }

  .today-action:active { transform: translateY(1px); }
  .today-action > :global(svg:last-child) { margin-inline-start: auto; }

  .math-beat {
    min-width: 0;
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: var(--space-3);
    padding-block-start: var(--space-5);
    border-top: 1px solid color-mix(in oklch, var(--color-stage-ink) 18%, transparent);
    color: var(--color-stage-muted);
    font-family: var(--font-outlier);
    font-size: clamp(var(--text-lg), 6vw, var(--text-2xl));
    font-variant-numeric: tabular-nums;
  }

  .math-bridge {
    font-size: var(--text-sm);
  }

  .math-beat strong {
    margin-inline-start: auto;
    color: var(--color-accent);
    font-size: 1.35em;
  }

  .pulse-board {
    min-width: 0;
    min-height: 13rem;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: var(--space-5);
    padding: var(--space-5);
    border: 1px solid var(--color-rule);
    border-radius: var(--radius-card);
    background: var(--color-paper-2);
  }

  .pulse-board dl {
    min-width: 0;
    margin: 0;
  }

  .pulse-board dl > div {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2);
    padding-block: var(--space-2);
    border-bottom: 1px solid var(--color-rule);
  }

  .pulse-board dl > div:last-child { border-bottom: 0; }
  .pulse-board dt { color: var(--color-muted); font-size: var(--text-xs); font-weight: 700; }
  .pulse-board dd {
    margin: 0;
    color: var(--color-ink);
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  .metric-skeleton {
    width: 6rem;
    aspect-ratio: 1;
    border: 9px solid var(--color-rule);
    border-radius: 50%;
  }

  .daily-tip {
    display: flex;
    align-items: flex-start;
    gap: var(--space-4);
    padding: var(--space-5);
    border: 1px solid color-mix(in oklch, var(--color-insight) 30%, var(--color-rule));
    border-radius: var(--radius-card);
    background: var(--color-insight-surface);
    color: var(--color-ink);
  }

  .tip-mark {
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    width: var(--tap);
    height: var(--tap);
    border-radius: var(--radius-small);
    background: var(--color-paper-2);
    color: var(--color-insight);
    font-size: var(--text-lg);
  }

  .daily-tip h2 { margin-block-end: var(--space-2); font-size: var(--text-lg); }
  .daily-tip p { max-width: 66ch; color: var(--color-neutral); }

  .section-head {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-block-end: var(--space-4);
  }

  .section-head p { color: var(--color-muted); }

  .repertoire-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-3);
  }

  .repertoire-link {
    min-width: 0;
    min-height: 5.5rem;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4);
    border: 1px solid var(--color-rule);
    border-radius: var(--radius-card);
    background: var(--color-paper-2);
    color: var(--color-ink);
    text-decoration: none;
    transition:
      background-color var(--dur-short) var(--ease-out),
      transform var(--dur-micro) var(--ease-out);
  }

  .repertoire-link > span:not(.repertoire-icon) {
    color: var(--color-muted);
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
  }

  .repertoire-icon {
    display: grid;
    place-items: center;
    width: var(--tap);
    height: var(--tap);
    border-radius: var(--radius-small);
    background: var(--color-paper-3);
    color: var(--color-accent-strong);
    font-size: var(--text-lg);
  }

  .repertoire-link > :global(svg:last-child) { color: var(--color-muted); }
  .repertoire-link:active { transform: translateY(1px); }

  .utility-nav {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-2);
    padding-block-start: var(--space-4);
    border-top: 1px solid var(--color-rule);
  }

  .utility-nav a,
  .utility-nav button {
    min-width: 0;
    min-height: var(--tap);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding-inline: var(--space-2);
    color: var(--color-neutral);
    font-size: var(--text-xs);
    font-weight: 700;
    text-align: center;
    text-decoration: none;
    white-space: nowrap;
  }

  @media (hover: hover) and (pointer: fine) {
    .today-action:hover { transform: translateY(-1px); }
    .repertoire-link:hover { background: var(--color-paper-3); transform: translateY(-1px); }
  }

  @media (min-width: 40rem) {
    .repertoire-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .section-head { flex-direction: row; align-items: baseline; justify-content: space-between; }
    .utility-nav a,
    .utility-nav button { font-size: var(--text-sm); }
  }

  @media (min-width: 60rem) {
    .dashboard { grid-template-columns: repeat(12, minmax(0, 1fr)); }
    .today { grid-column: span 8; grid-row: span 2; }
    .pulse-board { grid-column: span 4; grid-template-columns: minmax(0, 1fr); justify-items: center; }
    .pulse-board dl { width: 100%; }
    .daily-tip { grid-column: span 4; }
    .repertoire-grid { grid-template-columns: repeat(12, minmax(0, 1fr)); }
    .repertoire-link:nth-child(1) { grid-column: span 5; }
    .repertoire-link:nth-child(2) { grid-column: span 3; }
    .repertoire-link:nth-child(3) { grid-column: span 4; }
    .repertoire-link:nth-child(4) { grid-column: span 4; }
    .repertoire-link:nth-child(5) { grid-column: span 3; }
    .repertoire-link:nth-child(6) { grid-column: span 5; }
  }
</style>
