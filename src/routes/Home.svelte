<script lang="ts">
  import { m } from '../lib/paraglide/messages.js';
  import Icon from '../components/Icon.svelte';
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
  <section class="home">
    <!-- Greeting -->
    <div class="greet">
      <p class="greet-sub">{m.home_greeting({ name: '' }).replace(',', '')}</p>
      <h2 class="greet-name">{profile.name}!</h2>
    </div>

    <!-- Today's Show — hero spotlight card -->
    <article class="hero" aria-labelledby="today-show">
      <div class="hero-glow" aria-hidden="true"></div>
      <div class="hero-body">
        <span class="hero-kicker" id="today-show">{m.home_today_show()}</span>
        <p class="hero-hint">{m.home_practice_hint()}</p>
        <div class="hero-cta">
          <button class="btn--primary hero-btn" onclick={() => router.navigate('practice')}>
            <span>{m.home_practice_cta()}</span>
            <span class="arrow" aria-hidden="true">→</span>
          </button>
          <button class="btn--ghost" onclick={() => router.navigate('lessons')}>
            {m.nav_lessons()}
          </button>
        </div>
      </div>
    </article>

    <!-- Repertoire grid -->
    <section class="rep" aria-labelledby="rep-h">
      <div class="rep-head">
        <h3 id="rep-h">{m.home_repertoire()}</h3>
        <p class="muted rep-hint">{m.home_repertoire_hint()}</p>
      </div>
      <div class="rep-grid">
        <button class="rep-card" onclick={() => router.navigate('progress')}>
          <span class="rep-icon" aria-hidden="true"><Icon name="bar-chart" /></span>
          <span class="rep-label">{m.home_progress_cta()}</span>
        </button>
        <button class="rep-card" onclick={() => router.navigate('report')}>
          <span class="rep-icon" aria-hidden="true"><Icon name="chat" /></span>
          <span class="rep-label">{m.home_report_cta()}</span>
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
    gap: var(--space-6);
  }

  /* ── Greeting ── */
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
  .hero-body {
    position: relative;
    padding: var(--space-6) var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
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
  .hero-hint {
    font-size: var(--text-lead);
    color: var(--house-light);
    line-height: 1.4;
  }
  .hero-cta {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
    margin-top: var(--space-2);
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
  .rep-hint {
    font-size: var(--text-small);
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
    gap: var(--space-2);
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
  }
  .rep-card:hover {
    border-color: var(--spotlight);
    transform: translateY(-2px);
    box-shadow: var(--shadow-card), 0 0 20px var(--spotlight-wash);
  }
  .rep-card:active {
    transform: translateY(0);
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
  }
  .rep-label {
    color: var(--house-bright);
  }

  /* ── Bottom nav ── */
  .bottom-nav {
    display: flex;
    gap: var(--space-3);
    padding-top: var(--space-3);
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
    padding: var(--space-2) 0;
    cursor: pointer;
    transition: color var(--motion-base) ease;
  }
  .nav-btn:hover {
    background: none;
    color: var(--house-bright);
  }
</style>
