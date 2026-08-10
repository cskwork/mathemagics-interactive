<!--
  Hallmark · P4 H4 E4 S4 R4 V4 — 공연 모드 (M5 산출물 4). #/stage
  opt-in: 정확도 게이트(M3) 통과 기법만 입장(PLAN §4.2-8). 무대 프레임(막·조명 수준 경량 연출).
  비교는 오직 자기 기록(개인 최고 갱신 축하). 리더보드·타인 비교 없음(PLAN §7.2).
  count-up(카운트다운 아님) + beat-your-own-time(teaching-trends §4.4 절충안).
-->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { m } from '../lib/paraglide/messages.js';
  import Icon from '../components/Icon.svelte';
  import Ripple from '../lib/components/canvasui/Ripple.svelte';
  import { activeLocale } from '../lib/i18n/locale.svelte.js';
  import { resolveLocalized } from '../lib/content/localized.js';
  import { loadAllLessons } from '../lib/lesson/loader.js';
  import { proficiencyOf } from '../lib/srs/integration.js';
  import { generateProblem } from '../lib/engine/generate.js';
  import {
    isStageReadyLesson,
    stageProgressDelta,
    stageQuestion,
    type StageQuestion
  } from '../lib/stage/session.js';
  import type { AppState } from '../lib/profiles/app-state.svelte.js';
  import type { Router } from '../lib/router/hash-router.svelte.js';
  import type { ProgressRecord, SrsCard } from '../lib/storage/types.js';
  import { DEFAULT_SRS_CONFIG } from '../lib/srs/config.js';
  import { initialStreak, updateStreak } from '../lib/srs/streak.js';
  import { playSound } from '../lib/ui/sound.js';
  import AnimatedCounter from '../components/AnimatedCounter.svelte';
  import Celebration from '../lib/components/canvasui/Celebration.svelte';

  interface Props {
    app: AppState;
    router: Router;
  }
  const { app, router }: Props = $props();

  const lessons = loadAllLessons();

  let progress = $state<ProgressRecord[]>([]);
  let cards = $state<SrsCard[]>([]);
  let loadState = $state<'loading' | 'ready' | 'error'>('loading');
  let loadRequest = 0;

  async function refresh(): Promise<void> {
    const request = ++loadRequest;
    loadState = 'loading';
    try {
      const [nextProgress, nextCards] = await Promise.all([
        app.loadAllProgress(),
        app.loadAllCards()
      ]);
      if (request !== loadRequest) return;
      progress = nextProgress;
      cards = nextCards;
      loadState = 'ready';
    } catch {
      if (request === loadRequest) loadState = 'error';
    }
  }
  $effect(() => {
    void app.activeProfile();
    void refresh();
  });

  /** 게이트 통과(공연 가능) 기법 목록. */
  const eligible = $derived.by(() => {
    if (loadState !== 'ready') return [];
    return lessons
      .filter((l) => {
        if (!isStageReadyLesson(l)) return false;
        const rec = progress.find((r) => r.skillId === l.file.skillId);
        const prof = proficiencyOf(l.file.skillId, cards, rec, DEFAULT_SRS_CONFIG);
        return prof.level === 'gate-passed' || prof.level === 'fluent';
      })
      .map((l) => ({ skillId: l.file.skillId, title: l.file.title, file: l.file }));
  });

  let pickedSkill = $state<string | undefined>(undefined);
  let celebration: Celebration | undefined = $state(undefined);
  let playing = $state(false);
  let startMs = $state(0);
  let elapsed = $state(0);
  let solvedCount = $state(0);
  let currentProblem = $state<StageQuestion | undefined>(undefined);
  let currentAnswer = $state(0);
  let currentInput = $state('');
  let wrongAttempts = $state(0);
  let showWrongFeedback = $state(false);
  let currentSeed = $state(1);
  let finished = $state(false);
  let saving = $state(false);
  let saveError = $state(false);
  let timer: ReturnType<typeof setInterval> | undefined;

  const TARGET = 5; // 한 판에 풀 문제 수(beat-your-own-time: 고정 N, 시간 측정).

  function startShow(): void {
    if (!pickedSkill) return;
    if (timer) clearInterval(timer);
    playing = true;
    finished = false;
    solvedCount = 0;
    wrongAttempts = 0;
    currentSeed = Math.floor(Math.random() * 0xffffffff) >>> 0;
    nextProblem();
    startMs = Date.now();
    timer = setInterval(() => {
      elapsed = Date.now() - startMs;
    }, 100);
  }
  function nextProblem(): void {
    const lesson = lessons.find((l) => l.file.skillId === pickedSkill);
    if (!lesson) return;
    const ps = lesson.file.practice.problemSet;
    currentSeed = (currentSeed + 9) >>> 0;
    const opts = ps.estOf
      ? { op: ps.op, method: ps.method, digits: ps.digits, carry: ps.carry, estOf: ps.estOf }
      : ps.operandCount !== undefined
        ? { op: ps.op, method: ps.method, digits: ps.digits, carry: ps.carry, operandCount: ps.operandCount }
        : { op: ps.op, method: ps.method, digits: ps.digits, carry: ps.carry };
    const p = generateProblem(currentSeed, opts);
    const question = stageQuestion(p);
    if (!question) {
      currentProblem = undefined;
      playing = false;
      return;
    }
    currentProblem = question;
    currentAnswer = question.answer;
    currentInput = '';
    showWrongFeedback = false;
  }
  function submitDigit(): void {
    if (currentInput === String(currentAnswer)) {
      solvedCount += 1;
      playSound('correct');
      if (solvedCount >= TARGET) {
        finishShow();
      } else {
        nextProblem();
      }
      return;
    }
    wrongAttempts += 1;
    showWrongFeedback = true;
    playSound('wrong');
    currentInput = '';
  }
  function typeKey(k: string): void {
    if (!playing) return;
    if (k === '⌫') {
      currentInput = currentInput.slice(0, -1);
      return;
    }
    if (currentInput.length === 0) showWrongFeedback = false;
    currentInput += k;
    if (currentInput.length >= String(currentAnswer).length) {
      submitDigit();
    }
  }
  function handleKeydown(event: KeyboardEvent): void {
    if (!playing || event.altKey || event.ctrlKey || event.metaKey) return;
    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      typeKey(event.key);
      return;
    }
    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      typeKey('⌫');
    }
  }
  async function finishShow(): Promise<void> {
    const sessionSkill = pickedSkill;
    const sessionProfileId = app.activeProfileId();
    const sessionSolved = solvedCount;
    const sessionWrong = wrongAttempts;
    const sessionSettings = app.settings();

    playing = false;
    saving = true;
    finished = false;
    saveError = false;
    playSound('achievement');
    setTimeout(() => celebration?.rain(50), 200);
    if (timer) {
      clearInterval(timer);
      timer = undefined;
    }
    elapsed = Date.now() - startMs;
    // 자기 최고 기록 갱신(더 짧은 시간 = 더 좋음). 리더보드 없음.
    try {
      if (sessionSkill && sessionProfileId) {
        const bests = { ...(sessionSettings?.stageBests ?? {}) };
        const prev = bests[sessionSkill];
        if (prev === undefined || elapsed < prev) {
          bests[sessionSkill] = elapsed;
          await app.updateSettingsForProfile(sessionProfileId, { stageBests: bests });
        }

        // 진도 저장: 공연에서 푼 문제를 진도에 누적.
        const prog = await app.loadProgressForProfile(sessionProfileId, sessionSkill);
        const base = prog ?? {
          profileId: sessionProfileId,
          skillId: sessionSkill,
          attempts: 0,
          correct: 0,
          lastPlayedAt: Date.now(),
          stars: 0 as const
        };
        const delta = stageProgressDelta(sessionSolved, sessionWrong);
        await app.saveProgress({
          ...base,
          profileId: sessionProfileId,
          practiceAttempts: (base.practiceAttempts ?? 0) + delta.practiceAttempts,
          practiceCorrect: (base.practiceCorrect ?? 0) + delta.practiceCorrect,
          lastPlayedAt: Date.now()
        });

        // 스트릭 갱신.
        if (sessionSettings) {
          const prevStreak = {
            streakCount: sessionSettings.streakCount ?? 0,
            lastStreakDayMs: sessionSettings.lastStreakDayMs ?? 0,
            freezesAvailable:
              sessionSettings.freezesAvailable ?? DEFAULT_SRS_CONFIG.streakDefaultFreezes
          };
          const streakBase =
            prevStreak.streakCount === 0 ? initialStreak(DEFAULT_SRS_CONFIG) : prevStreak;
          const upd = updateStreak(streakBase, Date.now(), sessionSolved, DEFAULT_SRS_CONFIG);
          await app.updateSettingsForProfile(sessionProfileId, {
            streakCount: upd.state.streakCount,
            lastStreakDayMs: upd.state.lastStreakDayMs,
            freezesAvailable: upd.state.freezesAvailable
          });
        }
      }
    } catch {
      saveError = true;
    } finally {
      saving = false;
      finished = true;
    }
  }
  function stopEarly(): void {
    if (timer) {
      clearInterval(timer);
      timer = undefined;
    }
    playing = false;
    finished = true;
    elapsed = Date.now() - startMs;
  }
  function fmt(ms: number): string {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  function bestFor(skillId: string): number | undefined {
    return app.settings()?.stageBests?.[skillId];
  }
  const isNewRecord = $derived.by(() => {
    if (!finished || !pickedSkill) return false;
    const b = bestFor(pickedSkill);
    return b !== undefined && b >= elapsed - 1; // 방금 갱신됨
  });
  function goHome(): void {
    if (timer) clearInterval(timer);
    router.navigate('home');
  }

  onDestroy(() => {
    if (timer) clearInterval(timer);
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<section class="stack stage-route">
  <header class="stage-head">
    <p class="phase-tag" aria-live="polite">{m.stage_heading()}</p>
    <h2>{m.stage_heading()}</h2>
    <p class="muted">{m.stage_intro()}</p>
  </header>

  {#if loadState === 'loading'}
    <div class="card" role="status">
      <p class="muted">{m.loading()}</p>
    </div>
  {:else if loadState === 'error'}
    <div class="card stack" role="alert">
      <p>{m.app_load_error()}</p>
      <div><button class="btn--primary" onclick={refresh}>{m.app_retry()}</button></div>
    </div>
  {:else if saving}
    <div class="card save-state" role="status">
      <p>{m.stage_saving()}</p>
    </div>
  {:else if !playing && !finished}
    {#if eligible.length === 0}
      <div class="card" role="group">
        <p class="muted">{m.stage_none_unlocked()}</p>
      </div>
    {:else}
      <p class="muted">{m.stage_pick_skill()}</p>
      <ul class="picker" role="list">
        {#each eligible as e (e.skillId)}
          <li>
            <button
              class="card pick"
              class:picked={pickedSkill === e.skillId}
              onclick={() => (pickedSkill = e.skillId)}
            >
              <span class="pick-title">{resolveLocalized(e.title, activeLocale())}</span>
              {#if bestFor(e.skillId) !== undefined}
                <span class="muted small">{m.stage_personal_best()}: {fmt(bestFor(e.skillId)!)}</span>
              {:else}
                <span class="muted small">{m.stage_no_record()}</span>
              {/if}
            </button>
          </li>
        {/each}
      </ul>
      {#if pickedSkill}
        <div class="row controls">
          <button class="btn--primary" onclick={startShow}>{m.stage_start()}</button>
        </div>
      {/if}
    {/if}
  {:else if playing}
    <div class="card stage-deck perf" role="group" aria-label={m.stage_heading()}>
      <div class="counters">
        <div class="counter">
          <span class="counter-label">{m.stage_count_up()}</span>
          <strong class="counter-val">{solvedCount} / {TARGET}</strong>
        </div>
        <div class="counter">
          <span class="counter-label">{m.stage_time()}</span>
          <strong class="counter-val">{fmt(elapsed)}</strong>
        </div>
      </div>
      <p class="prompt" aria-live="polite">
        {currentProblem
          ? `${currentProblem.expression} ${currentProblem.answerKind === 'quotient' ? `→ ${m.stage_quotient_prompt()}` : '= ?'}`
          : ''}
      </p>
      <div
        class="input-line"
        role="textbox"
        aria-readonly="true"
        aria-label={m.stage_answer_input()}
      >
        <span class="input-val">{currentInput || '\u00a0'}</span>
      </div>
      {#if showWrongFeedback}
        {#key wrongAttempts}
          <p class="answer-feedback" role="alert">{m.stage_answer_wrong()}</p>
        {/key}
      {/if}
      <div class="numpad-mini" role="group" aria-label={m.numpad_label()}>
        {#each ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0'] as k (k)}
          <button class="np-key" onclick={() => typeKey(k)} aria-label={k === '⌫' ? m.numpad_backspace() : k}>{#if k === '⌫'}<Icon name="backspace" />{:else}{k}{/if}</button>
        {/each}
      </div>
      <div class="row controls">
        <button class="btn--ghost" onclick={stopEarly}>{m.stage_stop()}</button>
      </div>
    </div>
  {:else if finished}
    <Ripple options={{ amplitude: 0.6, speed: 0.8, refraction: 80, shine: 0.8, trigger: 'click', interval: 3 }}>
      <div class="done-wrap">
        <Celebration bind:this={celebration} />
      <div class="card stage-deck done" role="group" aria-label={m.stage_done_title()}>
        <p class="done-emoji" aria-hidden="true"><Icon name="masks" /></p>
        <p class="done-title">{m.stage_done_title()}</p>
        <p class="muted">{m.stage_done_subtitle()}</p>
        <div class="stage-done-stats">
          <div class="stage-stat">
            <AnimatedCounter value={solvedCount} />
            <span class="stage-stat-label">{m.stage_problems_solved({ n: '' }).replace(/\s*$/, '')}</span>
          </div>
          <div class="stage-stat">
            <AnimatedCounter value={Math.round(elapsed / 1000)} suffix="s" />
            <span class="stage-stat-label">{m.stage_time()}</span>
          </div>
        </div>
        {#if isNewRecord}
          <p class="record">{m.stage_new_record()}</p>
        {/if}
        {#if saveError}
          <p class="save-error" role="alert">{m.stage_save_error()}</p>
        {/if}
        <div class="row controls">
          <button class="btn--primary" onclick={() => { finished = false; }}>{m.stage_again()}</button>
          <button class="btn--ghost" onclick={goHome}>{m.lesson_back_home()}</button>
        </div>
      </div>
      </div>
    </Ripple>
  {/if}
</section>

<style>
  .stage-head {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .phase-tag {
    font-size: var(--text-small);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--spotlight);
    font-weight: 700;
  }
  .picker {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
    gap: var(--space-3);
  }
  .pick {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    align-items: flex-start;
    cursor: pointer;
    text-align: left;
  }
  .pick:hover,
  .pick.picked {
    border-color: var(--spotlight);
  }
  .pick.picked {
    background: var(--spotlight-wash);
  }
  .pick-title {
    font-weight: 700;
    color: var(--house-bright);
  }
  .stage-deck {
    background-image: var(--stage-spotlight-bg);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    align-items: center;
  }
  .counters {
    display: flex;
    gap: var(--space-6);
    justify-content: center;
    flex-wrap: wrap;
  }
  .counter {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
  }
  .counter-label {
    font-size: var(--text-small);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--house-light);
  }
  .counter-val {
    font-family: var(--font-numeric);
    font-variant-numeric: tabular-nums;
    font-size: clamp(1.3rem, 6vw, 1.8rem);
    color: var(--spotlight);
    text-shadow: 0 0 8px var(--spotlight-glow);
  }
  .prompt {
    font-family: var(--font-numeric);
    font-variant-numeric: tabular-nums;
    font-size: clamp(1.3rem, 6vw, 1.6rem);
    color: var(--house-bright);
    margin: 0;
    text-align: center;
    overflow-wrap: anywhere;
  }
  .input-line {
    min-width: 8rem;
    text-align: center;
    border-bottom: 3px solid var(--spotlight);
    padding: var(--space-2);
  }
  .input-val {
    font-family: var(--font-numeric);
    font-variant-numeric: tabular-nums;
    font-size: 1.8rem;
    color: var(--house-bright);
  }
  .answer-feedback {
    margin: calc(var(--space-2) * -1) 0 0;
    color: var(--miss);
    font-weight: 700;
    text-align: center;
  }
  .save-state {
    min-height: 12rem;
    display: grid;
    place-items: center;
    color: var(--color-muted);
  }
  .save-error {
    color: var(--color-error);
    font-weight: 700;
    text-align: center;
  }
  .numpad-mini {
    display: grid;
    grid-template-columns: repeat(3, var(--tap));
    gap: var(--space-2);
    justify-content: center;
  }
  .np-key {
    min-width: var(--tap);
    min-height: var(--tap);
    font-family: var(--font-numeric);
    font-weight: 800;
    font-size: 1.2rem;
  }
  .done {
    text-align: center;
  }
  .done-emoji {
    font-size: 3rem;
    margin: 0;
    color: var(--spotlight);
  }
  .done-title {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: var(--text-title);
    margin: 0;
  }
  .done-wrap {
    position: relative;
    overflow: visible;
  }
  .record {
    font-family: var(--font-display);
    font-weight: 800;
    color: var(--applause);
    font-size: var(--text-lead);
    animation: bounce-in var(--motion-slow) var(--ease-spring) both;
    text-shadow: 0 0 12px var(--applause-wash);
  }
  .stage-done-stats {
    display: flex;
    gap: var(--space-6);
    justify-content: center;
    margin: var(--space-3) 0;
  }
  .stage-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .stage-stat :global(.animated-counter) {
    font-size: 2rem;
    color: var(--spotlight);
    text-shadow: 0 0 8px var(--spotlight-glow);
  }
  .stage-stat-label {
    font-size: var(--text-caption);
    color: var(--house-light);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 600;
  }
  .controls {
    justify-content: center;
    flex-wrap: wrap;
  }
  @media (prefers-reduced-motion: reduce) {
    .stage-deck {
      background-image: none;
    }
  }
</style>
