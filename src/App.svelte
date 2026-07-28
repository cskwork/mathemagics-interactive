<script lang="ts">
  import { m } from './lib/paraglide/messages.js';
  import { createRouter } from './lib/router/hash-router.svelte.js';
  import { createAppState } from './lib/profiles/app-state.svelte.js';
  import ProfilePicker from './routes/ProfilePicker.svelte';
  import Home from './routes/Home.svelte';
  import SettingsPage from './routes/Settings.svelte';
  import Playground from './routes/Playground.svelte';

  const app = createAppState();
  const router = createRouter();

  let bootError = $state<string | undefined>(undefined);

  $effect(() => router.start());

  $effect(() => {
    app.boot().catch((err: unknown) => {
      bootError = err instanceof Error ? err.message : String(err);
    });
  });

  // 프로필이 없는데 home/settings 로 들어오면 프로필 선택으로 되돌린다.
  // 단 playground(개발용)는 프로필 없이도 접근 가능.
  $effect(() => {
    if (!app.ready()) return;
    if (router.current() !== 'profiles' && router.current() !== 'playground' && app.activeProfile() === undefined) {
      router.navigate('profiles');
    }
  });
</script>

<main class="app">
  <header class="stack" style="margin-bottom: 1.5rem;">
    <div>
      <h1>{m.app_title()}</h1>
      <p class="muted" style="margin: 0;">{m.app_tagline()}</p>
    </div>
  </header>

  {#if bootError}
    <p class="card" role="alert">{bootError}</p>
  {:else if !app.ready()}
    <p class="muted">{m.loading()}</p>
  {:else if router.unknownHash()}
    <div class="stack">
      <p class="card">{m.not_found()}</p>
      <div><button onclick={() => router.navigate('profiles')}>{m.nav_profiles()}</button></div>
    </div>
  {:else if router.current() === 'home'}
    <Home {app} {router} />
  {:else if router.current() === 'settings'}
    <SettingsPage {app} {router} />
  {:else if router.current() === 'playground'}
    <Playground />
  {:else}
    <ProfilePicker {app} {router} />
  {/if}
</main>
