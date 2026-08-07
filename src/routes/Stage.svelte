<!--
  Hallmark · P4 H4 E4 S4 R4 V4 — 공연 모드 (M5 산출물 4). #/stage
  opt-in: 정확도 게이트(M3) 통과 기법만 입장(PLAN §4.2-8). 무대 프레임(막·조명 수준 경량 연출).
  비교는 오직 자기 기록(개인 최고 갱신 축하). 리더보드·타인 비교 없음(PLAN §7.2).
  count-up(카운트다운 아님) + beat-your-own-time(teaching-trends §4.4 절충안).
-->
<script lang="ts">
  import { m } from '../lib/paraglide/messages.js';
  import Icon from '../components/Icon.svelte';
  import Ripple from '../lib/components/canvasui/Ripple.svelte';
  import { activeLocale } from '../lib/i18n/locale.svelte.js';
  import { resolveLocalized } from '../lib/content/localized.js';
  import { loadAllLessons } from '../lib/lesson/loader.js';
  import { proficiencyOf } from '../lib/srs/integration.js';
  import { generateProblem } from '../lib/engine/generate.js';
  import { computeAnswer } from '../lib/engine/derive.js';
  import type { AppState } from '../lib/profiles/app-state.svelte.js';
  import type { Router } from '../lib/router/hash-router.svelte.js';
  import type { ProgressRecord, SrsCard } from '../lib/storage/types.js';
  import { DEFAULT_SRS_CONFIG } from '../lib/srs/config.js';
  import { initialStreak, updateStreak } from '../lib/srs/streak.js';
  import { playSound } from '../lib/ui/sound.js';
  import Celebration from '../lib/components/canvasui/Celebration.svelte';

  interface Props {
    app: AppState;
    router: Router;
  }
  const { app, router }: Props = $props();

  const lessons = loadAllLessons();

  let progress = $state<ProgressRecord[]>([]);
  let cards = $state<SrsCard[]>([]);
  let loaded = $state(false);

  async function refresh(): Promise<void> {
    progress = await app.loadAllProgress();
    cards = await app.loadAllCards();
    loaded = true;
  }
  $effect(() => {
    void app.activeProfile();
    void refresh();
  });

  /** 게이트 통과(공연 가능) 기법 목록. */
  const eligible = $derived.by(() => {
    if (!loaded) return [];
    return lessons
      .filter((l) => {
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
  let currentProblem = $state<{ a: number; b: number; sign: string } | undefined>(undefined);
  let currentAnswer = $state(0);
  let currentInput = $state('');
  let currentSeed = $state(1);
  let finished = $state(false);
  let timer: ReturnType<typeof setInterval> | undefined;

  const TARGET = 5; // 한 판에 풀 문제 수(beat-your-own-time: 고정 N, 시간 측정).

  function startShow(): void {
    if (!pickedSkill) return;
    playing = true;
    finished = false;
    solvedCount = 0;
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
    const a = p.operands[0] ?? 0;
    const b = p.operands[1] ?? 0;
    const sign = p.method === 'square' ? '²' : p.op === 'add' ? '+' : p.op === 'sub' ? '−' : p.op === 'mul' ? '×' : p.op === 'div' ? '÷' : '≈';
    currentProblem = { a, b, sign };
    currentAnswer = computeAnswer(p);
    currentInput = '';
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
    }
  }
  function typeKey(k: string): void {
    if (!playing) return;
    if (k === '⌫') {
      currentInput = currentInput.slice(0, -1);
      return;
    }
    currentInput += k;
    if (currentInput.length >= String(currentAnswer).length) {
      submitDigit();
    }
  }
  async function finishShow(): Promise<void> {
    playing = false;
    finished = true;
    playSound('achievement');
    setTimeout(() => celebration?.rain(50), 200);
    if (timer) {
      clearInterval(timer);
      timer = undefined;
    }
    elapsed = Date.now() - startMs;
    // 자기 최고 기록 갱신(더 짧은 시간 = 더 좋음). 리더보드 없음.
    if (pickedSkill) {
      const bests = { ...(app.settings()?.stageBests ?? {}) };
      const prev = bests[pickedSkill];
      if (prev === undefined || elapsed < prev) {
        bests[pickedSkill] = elapsed;
        await app.updateSettings({ stageBests: bests });
      }

      // 진도 저장: 공연에서 푼 문제를 진도에 누적.
      const prog = await app.loadProgress(pickedSkill);
      const base = prog ?? {
        profileId: app.activeProfileId() ?? '',
        skillId: pickedSkill,
        attempts: 0,
        correct: 0,
        lastPlayedAt: Date.now(),
        stars: 0 as const
      };
      await app.saveProgress({
        ...base,
        practiceAttempts: (base.practiceAttempts ?? 0) + solvedCount,
        practiceCorrect: (base.practiceCorrect ?? 0) + solvedCount,
        lastPlayedAt: Date.now()
      });

      // 스트릭 갱신.
      const settings = app.settings();
      if (settings) {
        const prevStreak = {
          streakCount: settings.streakCount ?? 0,
          lastStreakDayMs: settings.lastStreakDayMs ?? 0,
          freezesAvailable: settings.freezesAvailable ?? DEFAULT_SRS_CONFIG.streakDefaultFreezes
        };
        const streakBase = prevStreak.streakCount === 0 ? initialStreak(DEFAULT_SRS_CONFIG) : prevStreak;
        const upd = updateStreak(streakBase, Date.now(), solvedCount, DEFAULT_SRS_CONFIG);
        await app.updateSettings({
          streakCount: upd.state.streakCount,
          lastStreakDayMs: upd.state.lastStreakDayMs,
          freezesAvailable: upd.state.freezesAvailable
        });
      }
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
</script>

<section class="stack stage-route">
  <header class="stage-head">
    <p class="phase-tag" aria-live="polite">{m.stage_heading()}</p>
    <h2>{m.stage_heading()}</h2>
    <p class="muted">{m.stage_intro()}</p>
  </header>

  {#if !playing && !finished}
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
      <p class="prompt" aria-live="polite">{currentProblem ? `${currentProblem.a}${currentProblem.sign}${currentProblem.sign === '²' ? '' : currentProblem.b} = ?` : ''}</p>
      <div class="input-line">
        <span class="input-val">{currentInput}</span>
      </div>
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
      <div class="card stage-deck done" role="group" aria-label={m.stage_done_title()}>
        <p class="done-emoji" aria-hidden="true"><Icon name="masks" /></p>
        <p class="done-title">{m.stage_done_title()}</p>
        <p class="muted">{m.stage_done_subtitle()}</p>
        <p class="muted small">{m.stage_problems_solved({ n: solvedCount })} · {m.stage_time()}: {fmt(elapsed)}</p>
        {#if isNewRecord}
          <p class="record">{m.stage_new_record()}</p>
        {/if}
        <div class="row controls">
          <button class="btn--primary" onclick={() => { finished = false; }}>{m.stage_again()}</button>
          <button class="btn--ghost" onclick={goHome}>{m.lesson_back_home()}</button>
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
  .record {
    font-family: var(--font-display);
    font-weight: 800;
    color: var(--applause);
    font-size: var(--text-lead);
    animation: bounce-in var(--motion-slow) var(--ease-spring) both;
    text-shadow: 0 0 12px var(--applause-wash);
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
