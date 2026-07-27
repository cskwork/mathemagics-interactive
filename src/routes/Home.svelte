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

<section class="stack">
  {#if profile}
    <h2>{m.home_greeting({ name: profile.name })}</h2>
    <p class="card muted">{m.home_placeholder()}</p>
    <div class="row">
      <button onclick={() => router.navigate('settings')}>{m.nav_settings()}</button>
      <button
        onclick={() => {
          app.clearActiveProfile();
          router.navigate('profiles');
        }}>{m.home_switch_profile()}</button
      >
    </div>
  {/if}
</section>
