<!--
  ToastContainer — fixed-position container that renders all active toasts.
  Place once in App.svelte.
-->
<script lang="ts">
  import Toast from './Toast.svelte';
  import { getToasts, dismissToast } from '../ui/toast.svelte.js';

  const toasts = $derived(getToasts());
</script>

<div class="toast-container" aria-live="polite">
  {#each toasts as t (t.id)}
    <Toast
      message={t.message}
      icon={t.icon ?? 'sparkle'}
      variant={t.variant ?? 'default'}
      duration={t.duration ?? 3500}
      ondismiss={() => dismissToast(t.id)}
    />
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    top: var(--space-4);
    left: 50%;
    transform: translateX(-50%);
    z-index: 200;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    pointer-events: none;
    width: min(100% - 2rem, var(--app-max));
  }
</style>