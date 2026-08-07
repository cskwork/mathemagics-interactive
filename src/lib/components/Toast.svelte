<!--
  Toast — transient notification card that slides in from the top.
  Used for achievements, milestones, and feedback.
  Auto-dismisses after duration. Respects reduced-motion.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Icon, { type IconName } from '../../components/Icon.svelte';

  interface Props {
    message: string;
    icon?: IconName;
    variant?: 'default' | 'success' | 'achievement';
    duration?: number;
    ondismiss?: () => void;
  }
  let { message, icon = 'sparkle', variant = 'default', duration = 3500, ondismiss }: Props = $props();

  let visible = $state(false);
  onMount(() => {
    // Slight delay for entrance animation
    requestAnimationFrame(() => { visible = true; });
    setTimeout(() => dismiss(), duration);
  });

  function dismiss(): void {
    visible = false;
    setTimeout(() => ondismiss?.(), 300);
  }
</script>

<div class="toast {variant}" class:visible role="status" aria-live="polite">
  <span class="toast-icon" aria-hidden="true"><Icon name={icon} /></span>
  <span class="toast-msg">{message}</span>
  <button class="toast-close" onclick={dismiss} aria-label="Close">
    <Icon name="x" />
  </button>
</div>

<style>
  .toast {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background: var(--gradient-card);
    border: 1px solid var(--stage-line);
    border-radius: var(--radius);
    box-shadow: var(--shadow-stage);
    transform: translateY(-100px);
    opacity: 0;
    transition: transform var(--motion-slow) var(--ease-spring), opacity var(--motion-base) ease;
    pointer-events: auto;
  }
  .toast.visible {
    transform: translateY(0);
    opacity: 1;
  }
  .toast.success {
    border-color: color-mix(in srgb, var(--applause) 40%, var(--stage-line));
    box-shadow: var(--shadow-stage), 0 0 20px var(--applause-wash);
  }
  .toast.achievement {
    border-color: color-mix(in srgb, var(--spotlight) 40%, var(--stage-line));
    box-shadow: var(--shadow-stage), 0 0 24px var(--spotlight-glow);
    background: linear-gradient(135deg,
      color-mix(in srgb, var(--spotlight) 10%, var(--stage-mid)) 0%,
      var(--stage-mid) 100%);
  }
  .toast-icon {
    font-size: 1.4rem;
    color: var(--spotlight);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .toast.success .toast-icon {
    color: var(--applause);
  }
  .toast-msg {
    font-size: var(--text-body);
    font-weight: 600;
    color: var(--house-bright);
    flex: 1;
  }
  .toast-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: calc(var(--tap) * 0.6);
    height: calc(var(--tap) * 0.6);
    min-width: auto;
    min-height: auto;
    padding: 0;
    background: none;
    border: none;
    color: var(--house-light);
    font-size: 1rem;
    cursor: pointer;
    border-radius: var(--radius-sm);
    opacity: 0.6;
    transition: opacity var(--motion-base) ease;
  }
  .toast-close:hover {
    opacity: 1;
    background: var(--stage-lit);
  }
  @media (prefers-reduced-motion: reduce) {
    .toast {
      transition: opacity var(--motion-fast) ease;
      transform: none;
    }
  }
</style>