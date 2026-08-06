<!--
  Hallmark · P3 H4 E4 S3 R4 V3 — 기억술 연습 화면 (M6 산출물 1, Ch7).
  숫자↔단어 양방향 연습. 활성 프로필 로케일에 따라 ko(한글 자음 코드)/en(Major System) 전환.
  엔진(src/lib/memory/engine.ts) 의 순수 함수로 단어 후보 탐색·검증. 색/폰트는 M7 토큰.
-->
<script lang="ts">
  import { m } from '../lib/paraglide/messages.js';
  import { activeLocale } from '../lib/i18n/locale.svelte.js';
  import type { AppState } from '../lib/profiles/app-state.svelte.js';
  import type { Router } from '../lib/router/hash-router.svelte.js';
  import { systemForLocale, findWordsForDigits, KO_DICTIONARY, EN_DICTIONARY } from '../lib/memory/engine.js';
  import type { WordEntry } from '../lib/memory/types.js';
  import { DEFAULT_SRS_CONFIG } from '../lib/srs/config.js';
  import { initialStreak, updateStreak } from '../lib/srs/streak.js';

  interface Props {
    app: AppState;
    router: Router;
  }
  const { app, router }: Props = $props();

  // 활성 프로필이 없으면 ko 기본.
  const locale = $derived((app.settings()?.locale ?? activeLocale()) as 'ko' | 'en');
  const system = $derived(systemForLocale(locale));
  const dict = $derived(locale === 'ko' ? KO_DICTIONARY : EN_DICTIONARY);

  type Mode = 'digits-to-word' | 'word-to-digits';
  let mode = $state<Mode>('digits-to-word');

  function makeRound(): void {
    if (mode === 'digits-to-word') {
      // 사전에서 임의 항목을 골라 그 digits 를 문제로.
      const pick = dict[Math.floor(Math.random() * dict.length)];
      if (pick) {
        current = pick;
        guess = '';
        result = 'idle';
      }
    } else {
      const pick = dict[Math.floor(Math.random() * dict.length)];
      if (pick) {
        current = pick;
        guess = '';
        result = 'idle';
      }
    }
  }

  const MEMORY_SKILL_ID = 'memory-practice';
  let solvedCount = $state(0);

  async function saveMemoryProgress(): Promise<void> {
    const prog = await app.loadProgress(MEMORY_SKILL_ID);
    const base = prog ?? {
      profileId: app.activeProfileId() ?? '',
      skillId: MEMORY_SKILL_ID,
      attempts: 0,
      correct: 0,
      lastPlayedAt: Date.now(),
      stars: 0 as const
    };
    await app.saveProgress({
      ...base,
      practiceAttempts: (base.practiceAttempts ?? 0) + 1,
      practiceCorrect: (base.practiceCorrect ?? 0) + 1,
      lastPlayedAt: Date.now()
    });

    // 스트릭 갱신.
    const settings = app.settings();
    if (settings) {
      const prev = {
        streakCount: settings.streakCount ?? 0,
        lastStreakDayMs: settings.lastStreakDayMs ?? 0,
        freezesAvailable: settings.freezesAvailable ?? DEFAULT_SRS_CONFIG.streakDefaultFreezes
      };
      const streakBase = prev.streakCount === 0 ? initialStreak(DEFAULT_SRS_CONFIG) : prev;
      const upd = updateStreak(streakBase, Date.now(), 1, DEFAULT_SRS_CONFIG);
      await app.updateSettings({
        streakCount: upd.state.streakCount,
        lastStreakDayMs: upd.state.lastStreakDayMs,
        freezesAvailable: upd.state.freezesAvailable
      });
    }
  }

  let current = $state<WordEntry | undefined>(undefined);
  let guess = $state('');
  let result = $state<'idle' | 'correct' | 'wrong'>('idle');

  $effect(() => {
    // 첫 진입 또는 로케일/모드 변경 시 새 판.
    void locale;
    void mode;
    void dict.length;
    makeRound();
  });

  function check(): void {
    if (!current) return;
    if (mode === 'digits-to-word') {
      // 숫자→단어: 입력한 단어의 encode 가 current.digits 와 같으면 정답.
      const ok = system.encode(guess.trim()) === current.digits && guess.trim().length > 0;
      result = ok ? 'correct' : 'wrong';
    } else {
      // 단어→숫자: 입력이 digits 와 같으면 정답.
      result = guess.trim() === current.digits ? 'correct' : 'wrong';
    }
  }

  function next(): void {
    solvedCount += 1;
    void saveMemoryProgress();
    makeRound();
  }

  // 힌트: digits-to-word 모드에서 사전 후보 미리보기(정답이 아닌 다른 단어들).
  const hintWords = $derived(
    current ? findWordsForDigits(current.digits, dict).map((e) => e.word).slice(0, 4) : []
  );
</script>

<section class="stack">
  <h2>{m.memory_heading()}</h2>
  <p class="muted">{m.memory_hint()}</p>

  <div class="row mode-switch">
    <button class:active={mode === 'digits-to-word'} onclick={() => (mode = 'digits-to-word')}>
      {m.memory_digits_prompt()}
    </button>
    <button class:active={mode === 'word-to-digits'} onclick={() => (mode = 'word-to-digits')}>
      {m.memory_word_prompt()}
    </button>
  </div>

  {#if current}
    <div class="card stack prompt">
      <div class="big">
        {#if mode === 'digits-to-word'}
          {current.digits}
        {:else}
          {current.word}
        {/if}
      </div>
      <label class="field">
        <span class="muted">{mode === 'digits-to-word' ? m.memory_digits_prompt() : m.memory_word_prompt()}</span>
        <input
          bind:value={guess}
          onkeydown={(e) => {
            if (e.key === 'Enter') (result === 'correct' ? next() : check());
          }}
          autocomplete="off"
        />
      </label>
      {#if result === 'wrong'}
        <p class="feedback wrong" role="alert">
          {m.memory_wrong()} {m.memory_answer({ answer: mode === 'digits-to-word' ? current.word : current.digits })}
        </p>
        <!-- 숫자→단어 모드: 사전의 다른 후보도 보여준다(학습 보조). -->
        {#if mode === 'digits-to-word' && hintWords.length > 1}
          <p class="muted">단어 후보: {hintWords.join(', ')}</p>
        {/if}
      {:else if result === 'correct'}
        <p class="feedback ok" role="status">{m.memory_correct()}</p>
      {/if}
      <div class="row" style="gap: var(--space-2);">
        {#if result === 'correct'}
          <button class="btn--primary" onclick={next}>{m.memory_next()}</button>
        {:else}
          <button class="btn--primary" onclick={check}>{m.memory_check()}</button>
        {/if}
      </div>
    </div>
  {/if}

  <!-- 매핑 표(학습 보조). -->
  <div class="card stack">
    <strong>{m.memory_table_title()} ({locale})</strong>
    <div class="table-grid">
      {#each system.table as entry (entry.digit)}
        <div class="cell"><span class="num">{entry.digit}</span><span class="cons">{entry.consonants.join(', ')}</span></div>
      {/each}
    </div>
  </div>

  <div><button onclick={() => router.navigate('home')}>{m.memory_back()}</button></div>
</section>

<style>
  .mode-switch {
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .mode-switch button {
    flex: 1 1 8rem;
    min-width: 0;
  }
  .mode-switch button.active {
    background: var(--spotlight);
    color: var(--spotlight-ink);
    border-color: var(--spotlight);
  }
  .prompt .big {
    font-family: var(--font-numeric);
    font-variant-numeric: tabular-nums;
    font-size: clamp(2rem, 8vw, 3.5rem);
    font-weight: 800;
    color: var(--spotlight);
    text-align: center;
    padding: var(--space-4);
    background: var(--stage-floor);
    border-radius: var(--radius-lg);
    word-break: break-all;
    overflow-wrap: anywhere;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .field input {
    width: 100%;
    font-size: 1.25rem;
    text-align: center;
  }
  .feedback.ok {
    color: var(--applause);
    margin: 0;
  }
  .feedback.wrong {
    color: var(--miss);
    margin: 0;
  }
  .table-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(5rem, 1fr));
    gap: var(--space-2);
  }
  .cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-2);
    background: var(--stage-floor);
    border-radius: var(--radius);
  }
  .num {
    font-family: var(--font-numeric);
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--spotlight);
  }
  .cons {
    color: var(--house-bright);
    font-size: var(--text-small);
  }
</style>
