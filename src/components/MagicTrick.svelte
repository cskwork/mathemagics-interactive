<!--
  Hallmark · P4 H4 E4 S4 R4 V4 — 마술 트릭 플레이어 (M5 산출물 5).
  시연(demo) → 비밀 공개(secret = 배운 원리) → 연습 → "가족에게 보여주기" 미션 카드.
  4단계는 간단한 단계 상태로 전환. M7 토큰·curtain-rise 만으로 무대 연출.
-->
<script lang="ts">
  import { m } from '../lib/paraglide/messages.js';
  import Icon from './Icon.svelte';
  import { activeLocale } from '../lib/i18n/locale.svelte.js';
  import { resolveLocalized } from '../lib/content/localized.js';
  import type { MagicTrick } from '../lib/magic/tricks.js';

  interface Props {
    trick: MagicTrick;
    seed?: number;
  }
  const { trick, seed = 7 }: Props = $props();

  type Phase = 'demo' | 'secret' | 'practice' | 'mission';
  let phase: Phase = $state('demo');

  const demo = $derived(trick.demo(seed));
  let revealedStep = $state(0);

  function next(): void {
    if (phase === 'demo') {
      if (revealedStep < demo.steps.length) {
        revealedStep += 1;
        return;
      }
      phase = 'secret';
      return;
    }
    if (phase === 'secret') {
      phase = 'practice';
      return;
    }
    if (phase === 'practice') {
      phase = 'mission';
      return;
    }
  }
  function back(): void {
    if (phase === 'mission') phase = 'practice';
    else if (phase === 'practice') phase = 'secret';
    else if (phase === 'secret') phase = 'demo';
  }
  function replay(): void {
    phase = 'demo';
    revealedStep = 0;
  }
  function title(): string {
    return resolveLocalized(trick.title, activeLocale());
  }
</script>

<section class="stack trick">
  <header class="trick-head">
    <p class="phase-tag" aria-live="polite">{m.magic_heading()}</p>
    <h2>{title()}</h2>
  </header>

  {#if phase === 'demo'}
    <div class="card stage-deck" role="group" aria-label={m.magic_demo()}>
      <p class="kicker">{m.magic_demo()}</p>
      <ol class="steps">
        {#each demo.steps as st, i (i)}
          {#if i < revealedStep}
            <li class="step">
              <span class="step-label">{resolveLocalized(st.label, activeLocale())}</span>
              <strong class="step-val">{st.value}</strong>
            </li>
          {/if}
        {/each}
      </ol>
      {#if revealedStep >= demo.steps.length}
        <p class="finale">{resolveLocalized(demo.finale, activeLocale())}</p>
      {/if}
    </div>
  {:else if phase === 'secret'}
    <div class="card stage-deck" role="group" aria-label={m.magic_secret()}>
      <p class="kicker">{m.magic_secret()}</p>
      <p class="reveal">{resolveLocalized(trick.secret, activeLocale())}</p>
      <p class="muted principle">
        <strong>{m.magic_reveal_principle()}:</strong> {resolveLocalized(trick.principle, activeLocale())}
      </p>
    </div>
  {:else if phase === 'practice'}
    <div class="card stage-deck" role="group" aria-label={m.magic_practice()}>
      <p class="kicker">{m.magic_practice()}</p>
      <p class="muted">{resolveLocalized(demo.finale, activeLocale())}</p>
      <button class="btn--secondary" onclick={replay}>{m.catch_reveal()}</button>
    </div>
  {:else if phase === 'mission'}
    <div class="card stage-deck mission" role="group" aria-label={m.magic_mission()}>
      <p class="kicker">{m.magic_mission()}</p>
      <p class="mission-title">{m.magic_mission_hint()}</p>
      <p class="done-emoji" aria-hidden="true"><Icon name="top-hat" /></p>
      <p class="muted">{m.magic_done()}</p>
    </div>
  {/if}

  <div class="row controls">
    {#if phase !== 'demo' || revealedStep > 0}
      <button class="btn--ghost" onclick={back}>{m.practice_wrong()}</button>
    {/if}
    <button class="btn--primary" onclick={next}>
      {phase === 'mission' ? m.lesson_done_title() : m.lesson_continue()}
    </button>
  </div>
</section>

<style>
  .trick-head {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .phase-tag {
    font-size: var(--text-small);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--spotlight);
    font-weight: 700;
  }
  .stage-deck {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    background-image: var(--stage-spotlight-bg);
    align-items: flex-start;
  }
  .kicker {
    font-family: var(--font-display);
    font-weight: 800;
    color: var(--spotlight);
    margin: 0;
    font-size: var(--text-lead);
  }
  .steps {
    margin: 0;
    padding-left: 1.2rem;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    width: 100%;
  }
  .step {
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
    align-items: baseline;
    font-size: var(--text-body);
    animation: card-settle var(--motion-base) var(--ease-stage);
  }
  .step-label {
    color: var(--house-light);
  }
  .step-val {
    font-family: var(--font-numeric);
    font-variant-numeric: tabular-nums;
    color: var(--house-bright);
  }
  .finale {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: var(--text-title);
    color: var(--spotlight);
    margin: 0;
    align-self: center;
  }
  .reveal {
    font-size: var(--text-lead);
    color: var(--house-bright);
    margin: 0;
  }
  .principle {
    font-size: var(--text-body);
  }
  .mission {
    align-items: center;
    text-align: center;
  }
  .mission-title {
    font-size: var(--text-lead);
    color: var(--house-bright);
  }
  .done-emoji {
    font-size: 3rem;
    margin: 0;
    color: var(--spotlight);
  }
  .controls {
    justify-content: center;
  }
  @media (prefers-reduced-motion: reduce) {
    .stage-deck {
      background-image: none;
    }
    .step {
      animation: none;
    }
  }
</style>
