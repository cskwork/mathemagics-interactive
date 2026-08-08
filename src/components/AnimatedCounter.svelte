<!--
  AnimatedCounter — counts up from 0 to target value with easing.
  Great for showing scores, accuracy, and stats dramatically.
-->
<script lang="ts">
  interface Props {
    value: number;
    duration?: number;
    suffix?: string;
    prefix?: string;
  }
  let { value, duration = 800, suffix = '', prefix = '' }: Props = $props();

  let display = $state(0);
  let rafId: number | undefined;

  function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  $effect(() => {
    if (rafId !== undefined) cancelAnimationFrame(rafId);
    const reduceMotion = typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion) {
      display = value;
      return;
    }

    const start = performance.now();
    const from = 0;

    function tick(now: number): void {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      display = Math.round(from + (value - from) * eased);
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      }
    }
    rafId = requestAnimationFrame(tick);
  });
</script>

<span class="animated-counter" aria-hidden="true">{prefix}{display}{suffix}</span>

<style>
  .animated-counter {
    font-family: var(--font-numeric);
    font-variant-numeric: tabular-nums;
    font-weight: 800;
  }
</style>