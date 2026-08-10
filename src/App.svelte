<!-- Hallmark · Living Stage · shared shell + adaptive learning deck. -->
<script lang="ts">
  import { m } from './lib/paraglide/messages.js';
  import { createRouter } from './lib/router/hash-router.svelte.js';
  import { createAppState } from './lib/profiles/app-state.svelte.js';
  import ProfilePicker from './routes/ProfilePicker.svelte';
  import Home from './routes/Home.svelte';
  import SettingsPage from './routes/Settings.svelte';
  import Playground from './routes/Playground.svelte';
  import Lessons from './routes/Lessons.svelte';
  import Lesson from './routes/Lesson.svelte';
  import Practice from './routes/Practice.svelte';
  import Progress from './routes/Progress.svelte';
  import Report from './routes/Report.svelte';
  import Stage from './routes/Stage.svelte';
  import Magic from './routes/Magic.svelte';
  import Catch from './routes/Catch.svelte';
  import Memory from './routes/Memory.svelte';
  import LocaleSwitcher from './components/LocaleSwitcher.svelte';
  import StageNav from './components/StageNav.svelte';
  import Icon from './components/Icon.svelte';
  import Avatar from './components/Avatar.svelte';
  import { initTheme, toggleTheme, theme, setLangAttribute } from './lib/ui/theme.svelte.js';
  import { initSound, setSoundEnabled } from './lib/ui/sound.js';
  import ToastContainer from './lib/components/ToastContainer.svelte';
  import { activeLocale } from './lib/i18n/locale.svelte.js';

  const app = createAppState();
  const router = createRouter();
  const currentTheme = $derived(theme());

  let bootError = $state<string | undefined>(undefined);

  async function boot(): Promise<void> {
    bootError = undefined;
    try {
      await app.boot();
    } catch (err: unknown) {
      bootError = err instanceof Error ? err.message : String(err);
    }
  }

  $effect(() => router.start());

  // Initialize theme as early as possible
  initTheme();
  // Initialize sound system (resumes on first user interaction)
  initSound();

  // Sync <html lang> with active locale for screen readers
  $effect(() => {
    setLangAttribute(activeLocale());
  });

  // Sync sound preference with profile settings
  $effect(() => {
    const s = app.settings();
    setSoundEnabled(s?.soundOn ?? true);
  });

  $effect(() => {
    void boot();
  });

  // 프로필이 없는데 home/settings/lessons/lesson 으로 들어오면 프로필 선택으로 되돌린다.
  // 단 playground(개발용)는 프로필 없이도 접근 가능.
  $effect(() => {
    if (!app.ready()) return;
    const r = router.current();
    if (r !== 'profiles' && r !== 'playground' && app.activeProfile() === undefined) {
      router.navigate('profiles');
    }
  });

  const profile = $derived(app.activeProfile());
  // 라우트가 바뀔 때마다 curtain-rise 를 재생하기 위한 키.
  const routeKey = $derived(router.current() ?? 'profiles');
  // 같은 라우트의 쿼리 딥링크도 독립 화면이다(예: lesson?id=A → lesson?id=B).
  const routeRenderKey = $derived(`${routeKey}:${router.locationHash()}`);
  const wideStage = $derived(
    ['profiles', 'home', 'settings', 'lessons', 'progress', 'report'].includes(routeKey)
  );

  // 라우트 전환 시 본문 영역(#main-stage)으로 포커스 옮김 — 스크린리더·키보드.
  // 최초 진입은 건너뛴다(프로필 입력 등으로 포커스를 빼앗지 않게).
  let firstRoute = true;
  $effect(() => {
    void routeRenderKey;
    if (firstRoute) {
      firstRoute = false;
      return;
    }
    document.getElementById('main-stage')?.focus();
  });

  function skipToMain(event: MouseEvent): void {
    event.preventDefault();
    const mainStage = document.getElementById('main-stage');
    mainStage?.focus();
    mainStage?.scrollIntoView({ block: 'start' });
  }
</script>

<main class="app">
  <a class="skip-link" href="#main-stage" onclick={skipToMain}>{m.app_skip_to_content()}</a>
  <header class="proscenium">
    <a class="wordmark" href={profile ? '#/home' : '#/profiles'} aria-label={m.app_title()}>
      <span class="wordmark-mark" aria-hidden="true"><Icon name="diamond" /></span>
      <span class="wordmark-text">{m.app_title()}</span>
    </a>

    {#if profile}<StageNav current={routeKey} />{/if}

    <div class="header-tail">
      {#if profile}
        <a class="chip" href="#/profiles" aria-label={m.stage_chip_label()}>
          <span class="chip-avatar" aria-hidden="true"><Avatar id={profile.avatar} /></span>
          <span class="chip-name">{profile.name}</span>
        </a>
      {/if}
      <button
        class="theme-toggle"
        onclick={() => toggleTheme()}
        aria-label={currentTheme === 'light' ? m.theme_dark() : m.theme_light()}
        title={currentTheme === 'light' ? m.theme_dark() : m.theme_light()}
      >
        <Icon name={currentTheme === 'light' ? 'moon' : 'sun'} />
      </button>
      <LocaleSwitcher onchange={(locale) => app.setLocale(locale)} />
    </div>
  </header>

  <div
    class="stage"
    class:wide={wideStage}
    id="main-stage"
    tabindex="-1"
    role="group"
    aria-label={m.app_stage_label()}
  >
    {#key routeRenderKey}
      <div class="rise">
        {#if bootError}
          <section class="load-state card" role="alert">
            <Icon name="x" />
            <h1>{m.app_load_error()}</h1>
            <button class="btn--primary" onclick={boot}>{m.app_retry()}</button>
          </section>
        {:else if !app.ready()}
          <div class="loading-stage" role="status" aria-label={m.loading()}>
            <span></span><span></span><span></span>
            <p>{m.loading()}</p>
          </div>
        {:else if router.unknownHash()}
          <section class="stack">
            <p class="card">{m.not_found()}</p>
            <div><button onclick={() => router.navigate('profiles')}>{m.nav_profiles()}</button></div>
          </section>
        {:else if router.current() === 'home'}
          <Home {app} {router} />
        {:else if router.current() === 'settings'}
          <SettingsPage {app} {router} />
        {:else if router.current() === 'lessons'}
          <Lessons {app} {router} />
        {:else if router.current() === 'lesson'}
          <Lesson {app} {router} />
        {:else if router.current() === 'practice'}
          <Practice {app} {router} />
        {:else if router.current() === 'progress'}
          <Progress {app} {router} />
        {:else if router.current() === 'report'}
          <Report {app} {router} />
        {:else if router.current() === 'stage'}
          <Stage {app} {router} />
        {:else if router.current() === 'magic'}
          <Magic {app} {router} />
        {:else if router.current() === 'catch'}
          <Catch {app} {router} />
        {:else if router.current() === 'memory'}
          <Memory {app} {router} />
        {:else if router.current() === 'playground'}
          <Playground />
        {:else}
          <ProfilePicker {app} {router} />
        {/if}
      </div>
    {/key}
  </div>
  <ToastContainer />
</main>

<style>
  .proscenium {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-3);
    width: min(100%, var(--app-wide));
    margin-inline: auto;
    padding-block-end: var(--space-3);
    margin-block-end: clamp(var(--space-5), 4vw, var(--space-7));
    border-bottom: 1px solid var(--color-rule);
  }
  .wordmark {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    text-decoration: none;
    color: var(--house-bright);
    font-family: var(--font-display);
    font-weight: 800;
    letter-spacing: var(--tracking-display);
    font-size: 1rem;
    min-width: var(--tap);
    justify-content: flex-start;
    min-height: var(--tap);
    transition: color var(--dur-short) var(--ease-out);
  }
  .wordmark-mark {
    color: var(--color-accent-strong);
    font-size: 0.7rem;
  }
  .wordmark-text {
    white-space: nowrap;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--tap);
    padding: 0 var(--space-3) 0 var(--space-2);
    background: var(--stage-mid);
    border: 1px solid var(--stage-line);
    border-radius: var(--radius-pill);
    color: var(--color-ink);
    text-decoration: none;
  }
  .chip-avatar {
    font-size: 1.05rem;
    line-height: 1;
  }
  .chip-name {
    font-size: var(--text-small);
    font-weight: 600;
    max-width: 9rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .header-tail {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .theme-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--tap);
    height: var(--tap);
    min-width: var(--tap);
    min-height: var(--tap);
    padding: 0;
    border: 1px solid var(--stage-line);
    border-radius: var(--radius-pill);
    background: var(--stage-mid);
    color: var(--house-light);
    font-size: 1.05rem;
    cursor: pointer;
    transition:
      color var(--dur-short) var(--ease-out),
      background-color var(--dur-short) var(--ease-out);
  }
  .theme-toggle:hover {
    color: var(--spotlight);
    border-color: var(--stage-edge);
    background: var(--stage-mid);
  }

  .stage {
    min-width: 0;
    width: min(100%, var(--app-max));
    margin-inline: auto;
  }
  .stage.wide {
    width: min(100%, var(--app-wide));
  }
  .stage:focus {
    outline: none;
  }

  .skip-link {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    border: 0;
    clip-path: inset(50%);
    overflow: hidden;
    white-space: nowrap;
  }
  .skip-link:focus {
    position: fixed;
    top: var(--space-3);
    left: var(--space-3);
    z-index: 20;
    width: auto;
    height: auto;
    margin: 0;
    clip-path: none;
    padding: var(--space-2) var(--space-3);
    background: var(--spotlight);
    color: var(--spotlight-ink);
    border-radius: var(--radius);
    font-weight: 800;
  }

  .load-state,
  .loading-stage {
    min-height: 15rem;
    display: grid;
    place-items: center;
    align-content: center;
    gap: var(--space-4);
    text-align: center;
  }
  .load-state > :global(svg) {
    font-size: var(--text-2xl);
    color: var(--color-error);
  }
  .load-state h1 {
    font-size: var(--text-xl);
  }
  .loading-stage {
    grid-template-columns: repeat(3, 0.65rem);
  }
  .loading-stage span {
    width: 0.65rem;
    aspect-ratio: 1;
    border-radius: var(--radius-pill);
    background: var(--color-accent-strong);
    opacity: 0.3;
    animation: load-beat 900ms var(--ease-in-out) infinite alternate;
  }
  .loading-stage span:nth-child(2) { animation-delay: 120ms; }
  .loading-stage span:nth-child(3) { animation-delay: 240ms; }
  .loading-stage p { grid-column: 1 / -1; color: var(--color-muted); }

  @keyframes load-beat {
    to { opacity: 1; transform: translateY(-3px); }
  }

  @media (max-width: 23rem) {
    .wordmark-text { display: none; }
    .chip-name {
      display: none;
    }
  }

  @media (max-width: 57.99rem) {
    .chip { display: none; }
  }

  @media (min-width: 58rem) {
    .proscenium {
      grid-template-columns: auto minmax(28rem, 1fr) auto;
    }
  }
</style>
