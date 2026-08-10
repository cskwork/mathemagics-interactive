<script lang="ts">
  import { onDestroy } from 'svelte';
  import { m } from '../lib/paraglide/messages.js';
  import { activeLocale } from '../lib/i18n/locale.svelte.js';
  import { resolveLocalized } from '../lib/content/localized.js';
  import { playSound } from '../lib/ui/sound.js';
  import type { ChoiceStep, Step } from '../lib/engine/types.js';

  interface Props {
    steps: readonly Step[];
    oncomplete?: () => void;
  }

  const { steps, oncomplete }: Props = $props();
  const choice = $derived(
    steps.find((step): step is ChoiceStep => step.t === 'choice' && step.expect === true)
  );
  const prompt = $derived(choice?.narration ? resolveLocalized(choice.narration, activeLocale()) : '');
  const explanation = $derived(
    choice?.explanation ? resolveLocalized(choice.explanation, activeLocale()) : m.choice_correct()
  );

  let selected = $state<boolean | undefined>();
  let completed = $state(false);
  let completionTimer: ReturnType<typeof setTimeout> | undefined;

  onDestroy(() => {
    if (completionTimer !== undefined) clearTimeout(completionTimer);
  });

  function choose(value: boolean): void {
    if (!choice || completed) return;
    selected = value;
    if (value === choice.value) {
      completed = true;
      playSound('correct');
      completionTimer = setTimeout(() => oncomplete?.(), 650);
    } else {
      playSound('wrong');
    }
  }

  function handleKey(event: KeyboardEvent): void {
    if (completed) return;
    const target = event.target as HTMLElement | null;
    if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
    if (event.key.toLowerCase() === 'y') {
      event.preventDefault();
      choose(true);
    } else if (event.key.toLowerCase() === 'n') {
      event.preventDefault();
      choose(false);
    }
  }
</script>

<svelte:window onkeydown={handleKey} />

<div class="choice-card stack" role="group" aria-label={prompt}>
  <p class="choice-prompt">{prompt}</p>
  <div class="choice-buttons">
    <button
      class:correct={completed && choice?.value === true}
      class:wrong={selected === true && !completed}
      disabled={completed}
      onclick={() => choose(true)}
    >
      {m.choice_yes()}
    </button>
    <button
      class:correct={completed && choice?.value === false}
      class:wrong={selected === false && !completed}
      disabled={completed}
      onclick={() => choose(false)}
    >
      {m.choice_no()}
    </button>
  </div>
  <p class="feedback" aria-live="polite" class:success={completed}>
    {#if completed}
      {explanation}
    {:else if selected !== undefined}
      {m.choice_wrong()}
    {/if}
  </p>
</div>

<style>
  .choice-card {
    width: min(100%, 28rem);
    padding: var(--space-4);
    border: 1px solid var(--stage-line);
    border-radius: var(--radius-lg);
    background: var(--stage-mid);
  }
  .choice-prompt {
    margin: 0;
    color: var(--house-bright);
    font-size: var(--text-lead);
    text-align: center;
  }
  .choice-buttons {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3);
  }
  .choice-buttons button {
    min-height: calc(var(--tap) * 1.25);
    font-size: var(--text-lead);
    font-weight: 800;
  }
  .choice-buttons button.correct {
    color: var(--applause);
    border-color: var(--applause);
    background: var(--applause-wash);
  }
  .choice-buttons button.wrong {
    color: var(--miss);
    border-color: var(--miss);
    background: var(--miss-wash);
    animation: shake 0.32s ease;
  }
  .feedback {
    min-height: 1.5rem;
    margin: 0;
    color: var(--miss);
    text-align: center;
    font-weight: 700;
  }
  .feedback.success {
    color: var(--applause);
  }
  @keyframes shake {
    25% { transform: translateX(-4px); }
    75% { transform: translateX(4px); }
  }
  @media (prefers-reduced-motion: reduce) {
    .choice-buttons button.wrong { animation: none; }
  }
</style>
