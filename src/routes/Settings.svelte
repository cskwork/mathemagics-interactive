<script lang="ts">
  import { m } from '../lib/paraglide/messages.js';
  import LocaleSwitcher from '../components/LocaleSwitcher.svelte';
  import type { AppState } from '../lib/profiles/app-state.svelte.js';
  import type { Router } from '../lib/router/hash-router.svelte.js';

  interface Props {
    app: AppState;
    router: Router;
  }
  const { app, router }: Props = $props();

  const settings = $derived(app.settings());
</script>

<section class="stack">
  <h2>{m.settings_heading()}</h2>

  {#if settings}
    <div class="card stack">
      <div class="stack" style="gap: 0.25rem;">
        <strong>{m.settings_language()}</strong>
        <span class="muted">{m.settings_language_hint()}</span>
      </div>
      <LocaleSwitcher onchange={(locale) => app.setLocale(locale)} />
    </div>

    <div class="card row" style="justify-content: space-between;">
      <label for="sound-toggle">{m.settings_sound()}</label>
      <input
        id="sound-toggle"
        type="checkbox"
        checked={settings.soundOn}
        onchange={(e) => app.updateSettings({ soundOn: e.currentTarget.checked })}
      />
    </div>

    <div class="card row" style="justify-content: space-between;">
      <label for="daily-goal">{m.settings_daily_goal()}</label>
      <input
        id="daily-goal"
        type="number"
        min="1"
        max="60"
        style="max-width: 6rem;"
        value={settings.dailyGoalMinutes}
        onchange={(e) => app.updateSettings({ dailyGoalMinutes: Number(e.currentTarget.value) })}
      />
    </div>
  {/if}

  <div class="card stack" style="gap: 0.25rem;">
    <strong>{m.storage_mode_label()}</strong>
    <span class="muted">
      {app.storageMode() === 'server' ? m.storage_mode_server() : m.storage_mode_local()}
    </span>
    {#if app.storageMode() === 'local'}
      <span class="muted">
        {app.persistence() === 'granted' ? m.storage_persist_granted() : m.storage_persist_denied()}
      </span>
    {/if}
  </div>

  <div><button onclick={() => router.navigate('home')}>{m.settings_back()}</button></div>
</section>
