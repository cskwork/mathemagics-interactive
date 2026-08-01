<!-- Hallmark · P4 H4 E4 S4 R4 V4 — 프로시니엄 프레임 + 라우트 스위치 (M7 산출물 3).
  - 헤더 = 무대 프롬프트: 좌 워드마크 · (중앙) 활성 공연자 칩 · 우 로케일 스위처.
  - 하단 얇은 앰버 선 = 프로시니엄(edge of stage) 암시. 과하지 않게 1px.
  - 라우트 영역 진입 시 curtain-rise(막 올림). reduced-motion 은 전역 즉시 전환. -->
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
  import Icon from './components/Icon.svelte';
  import Avatar from './components/Avatar.svelte';
  import { initTheme, toggleTheme, theme, setLangAttribute } from './lib/ui/theme.svelte.js';
  import { activeLocale } from './lib/i18n/locale.svelte.js';

  const app = createAppState();
  const router = createRouter();
  const currentTheme = $derived(theme());

  let bootError = $state<string | undefined>(undefined);

  $effect(() => router.start());

  // Initialize theme as early as possible
  initTheme();

  // Sync <html lang> with active locale for screen readers
  $effect(() => {
    setLangAttribute(activeLocale());
  });

  $effect(() => {
    app.boot().catch((err: unknown) => {
      bootError = err instanceof Error ? err.message : String(err);
    });
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

  // 라우트 전환 시 본문 영역(#main-stage)으로 포커스 옮김 — 스크린리더·키보드.
  // 최초 진입은 건너뛴다(프로필 입력 등으로 포커스를 빼앗지 않게).
  let firstRoute = true;
  $effect(() => {
    void routeKey;
    if (firstRoute) {
      firstRoute = false;
      return;
    }
    document.getElementById('main-stage')?.focus();
  });
</script>

<main class="app">
  <a class="skip-link" href="#main-stage">{m.app_skip_to_content()}</a>
  <header class="proscenium">
    <a class="wordmark" href="#/profiles" aria-label={m.app_title()}>
      <span class="wordmark-mark" aria-hidden="true"><Icon name="diamond" /></span>
      <span class="wordmark-text">{m.app_title()}</span>
    </a>

    {#if profile}
      <div class="chip" aria-label={m.stage_chip_label()}>
        <span class="chip-avatar" aria-hidden="true"><Avatar id={profile.avatar} /></span>
        <span class="chip-name">{profile.name}</span>
      </div>
    {/if}

    <div class="header-tail">
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

  <div class="stage" id="main-stage" tabindex="-1" role="group" aria-label={m.app_stage_label()}>
    {#key routeKey}
      <div class="rise">
        {#if bootError}
          <p class="card" role="alert">{bootError}</p>
        {:else if !app.ready()}
          <p class="muted">{m.loading()}</p>
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
          <Catch {router} />
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
</main>

<style>
  .proscenium {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
    padding-bottom: var(--space-4);
    margin-bottom: var(--space-6);
    border-bottom: 1px solid var(--stage-line);
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
    transition: opacity var(--motion-base) ease;
  }
  .wordmark:hover {
    opacity: 0.8;
  }
  .wordmark-mark {
    color: var(--spotlight);
    font-size: 0.65rem;
    transform: translateY(-1px);
  }
  .wordmark-text {
    white-space: nowrap;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: calc(var(--tap) * 0.68);
    padding: 0 var(--space-3) 0 var(--space-2);
    background: var(--stage-mid);
    border: 1px solid var(--stage-line);
    border-radius: var(--radius-pill);
    box-shadow: var(--shadow-card);
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
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .theme-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: calc(var(--tap) * 0.68);
    height: calc(var(--tap) * 0.68);
    min-width: auto;
    min-height: auto;
    padding: 0;
    border: 1px solid var(--stage-line);
    border-radius: var(--radius-pill);
    background: var(--stage-mid);
    color: var(--house-light);
    font-size: 1.05rem;
    cursor: pointer;
    transition: color var(--motion-base) ease, border-color var(--motion-base) ease;
  }
  .theme-toggle:hover {
    color: var(--spotlight);
    border-color: var(--stage-edge);
    background: var(--stage-mid);
  }

  .stage {
    min-width: 0;
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

  @media (max-width: 360px) {
    .chip-name {
      max-width: 5rem;
    }
  }
</style>
