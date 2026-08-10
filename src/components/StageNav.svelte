<!--
  Living Stage learning deck — a domain-specific route rail, not a marketing nav.
  Four persistent destinations mirror the learner's real loop.
-->
<script lang="ts">
  import { m } from '../lib/paraglide/messages.js';
  import type { Route } from '../lib/router/hash-router.svelte.js';
  import Icon, { type IconName } from './Icon.svelte';

  interface Props {
    current: Route;
  }

  const { current }: Props = $props();

  const items: { route: Route; href: string; label: () => string; icon: IconName }[] = [
    { route: 'home', href: '#/home', label: m.nav_home, icon: 'diamond' },
    { route: 'lessons', href: '#/lessons', label: m.nav_lessons, icon: 'sparkle' },
    { route: 'practice', href: '#/practice', label: m.nav_practice, icon: 'play' },
    { route: 'progress', href: '#/progress', label: m.nav_progress, icon: 'bar-chart' }
  ];

  function isActive(route: Route): boolean {
    return current === route || (route === 'lessons' && current === 'lesson');
  }
</script>

<nav class="learning-deck" aria-label={m.app_learning_nav()}>
  {#each items as item (item.route)}
    <a
      class="deck-link"
      class:active={isActive(item.route)}
      href={item.href}
      aria-current={isActive(item.route) ? 'page' : undefined}
    >
      <span class="deck-icon" aria-hidden="true"><Icon name={item.icon} /></span>
      <span class="deck-label">{item.label()}</span>
    </a>
  {/each}
</nav>

<style>
  .learning-deck {
    position: fixed;
    z-index: 30;
    inset-inline: max(var(--space-2), env(safe-area-inset-left))
      max(var(--space-2), env(safe-area-inset-right));
    inset-block-end: max(var(--space-2), env(safe-area-inset-bottom));
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--space-1);
    padding: var(--space-1);
    border: 1px solid var(--color-rule-2);
    border-radius: var(--radius-large);
    background: color-mix(in oklch, var(--color-paper-2) 94%, transparent);
    box-shadow: var(--shadow-stage);
    backdrop-filter: blur(16px) saturate(130%);
  }

  .deck-link {
    min-width: 0;
    min-height: var(--tap);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-3xs);
    padding: var(--space-1) var(--space-1);
    border-radius: var(--radius-card);
    color: var(--color-muted);
    text-decoration: none;
    white-space: nowrap;
    transition:
      background-color var(--dur-short) var(--ease-out),
      color var(--dur-short) var(--ease-out),
      transform var(--dur-micro) var(--ease-out);
  }

  .deck-link.active {
    color: var(--color-accent-ink);
    background: var(--color-accent);
  }

  .deck-link:active {
    transform: translateY(1px);
  }

  .deck-icon {
    display: flex;
    font-size: 1rem;
  }

  .deck-label {
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: clamp(0.62rem, 2.8vw, var(--text-xs));
    font-weight: 750;
    line-height: 1.15;
  }

  @media (hover: hover) and (pointer: fine) {
    .deck-link:hover {
      color: var(--color-ink);
      background: var(--color-paper-3);
    }

    .deck-link.active:hover {
      color: var(--color-accent-ink);
      background: var(--color-accent);
    }
  }

  @media (min-width: 58rem) {
    .learning-deck {
      position: static;
      inset: auto;
      display: flex;
      justify-self: center;
      padding: var(--space-1);
      border-color: var(--color-rule);
      border-radius: var(--radius-pill);
      background: var(--color-paper-3);
      box-shadow: none;
      backdrop-filter: none;
    }

    .deck-link {
      min-width: 7rem;
      flex-direction: row;
      gap: var(--space-2);
      padding-inline: var(--space-3);
      border-radius: var(--radius-pill);
    }

    .deck-label {
      font-size: var(--text-sm);
    }
  }
</style>
