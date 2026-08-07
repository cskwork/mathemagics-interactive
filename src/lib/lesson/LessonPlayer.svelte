<!--
  Hallmark · P4 H4 E4 S4 R4 V4 — 레슨 플레이어 (docs/briefs/M2.md 산출물 2·3·4).
  5단계 상태머신(hook→example→fading→practice→done)을 순수 리듀서로 구동.
  - 훅: StepPlayer 자동 재생, 건너뛰기 가능.
  - 예제: StepPlayer 관찰, 다음 문제로.
  - 페이딩: 마지막 스텝부터 학생이 채움(expect 점진 확대).
  - 연습: 전체 입력 + 3단 힌트 사다리 + 전략 카드 + 남용 감지 복귀 권유.
  - 완료: 진도 저장 + 축하.
  모든 색/폰트는 M7 토큰(var(--*)), 컴포넌트는 Dialog/ColumnGrid/StepPlayer/DigitInput 재사용.
-->
<script lang="ts">
  import { m } from '../paraglide/messages.js';
  import Icon from '../../components/Icon.svelte';
  import Ripple from '../components/canvasui/Ripple.svelte';
  import { activeLocale } from '../i18n/locale.svelte.js';
  import { resolveLocalized } from '../content/localized.js';
  import { deriveGrid, deriveSteps } from '../engine/derive.js';
  import { partialProducts } from '../engine/derive-mul.js';
  import { estimationBand } from '../engine/derive-est.js';
  import { columnAddLayout, crossMultLayout, squareRootLayout } from '../engine/derive-paper.js';
  import { checkModSum } from '../engine/modsum.js';
  import type { Problem } from '../engine/types.js';
  import type { HintTier, Lesson, StrategyChoice } from './types.js';
  import { findLesson } from './loader.js';
  import { expectCount, fadingKForProblem, withExpectOnLastK } from './fading.js';
  import {
    createLessonState,
    nextHintTier,
    practiceAccuracy,
    reduce,
    starsFor,
    type LessonCounts,
    type LessonEvent,
    type LessonState
  } from './state-machine.js';
  import type { AppState } from '../profiles/app-state.svelte.js';
  import type { Router } from '../router/hash-router.svelte.js';
  import type { ProgressRecord } from '../storage/types.js';
  import { DEFAULT_SRS_CONFIG } from '../srs/config.js';
  import { createCardFromLesson, makeFactId } from '../srs/integration.js';
  import { paramsToBand } from '../srs/difficulty.js';
  import StepPlayer from '../../components/StepPlayer.svelte';
  import DigitInput from '../../components/DigitInput.svelte';
  import RollingCounter from '../../components/RollingCounter.svelte';
  import XDiagram from '../../components/XDiagram.svelte';
  import DivisionBracket from '../../components/DivisionBracket.svelte';
  import SubstitutionChain from '../../components/SubstitutionChain.svelte';
  import ColumnAddGrid from '../../components/ColumnAddGrid.svelte';
  import CrossMultDiagram from '../../components/CrossMultDiagram.svelte';
  import SquareRootDiagram from '../../components/SquareRootDiagram.svelte';
  import ModSumCheck from '../../components/ModSumCheck.svelte';
  import MemorySlot from '../../components/MemorySlot.svelte';
  import Celebration from '../components/canvasui/Celebration.svelte';
  import { pushToast } from '../ui/toast.svelte.js';
  import RuleCard from '../../components/RuleCard.svelte';
  import { playSound } from '../ui/sound.js';

  interface Props {
    skillId: string;
    app: AppState;
    router: Router;
  }
  const { skillId, app, router }: Props = $props();

  const lesson: Lesson | undefined = $derived(findLesson(skillId));

  const counts: LessonCounts = $derived(
    lesson
      ? {
          hook: lesson.hookProblems.length,
          example: lesson.exampleProblems.length,
          fading: lesson.fadingProblems.length,
          practice: lesson.practiceProblems.length
        }
      : { hook: 0, example: 0, fading: 0, practice: 0 }
  );

  let lessonState: LessonState = $state(createLessonState(Date.now()));
  let savedDone = $state(false);
  let celebration: Celebration | undefined = $state(undefined);
  let savedPractice = $state(false);

  function dispatch(e: LessonEvent): void {
    lessonState = reduce(lessonState, e, counts);
  }

  // ── 현재 문제 / 그리드 / 스텝 ──────────────────────────────────────────────
  const currentProblem: Problem | undefined = $derived.by(() => {
    if (!lesson) return undefined;
    if (lessonState.phase === 'hook') return lesson.hookProblems[lessonState.index];
    if (lessonState.phase === 'example') return lesson.exampleProblems[lessonState.index];
    if (lessonState.phase === 'fading') return lesson.fadingProblems[lessonState.index];
    if (lessonState.phase === 'practice') return lesson.practiceProblems[lessonState.index];
    return undefined; // done
  });

  const grid = $derived(currentProblem ? deriveGrid(currentProblem) : undefined);
  const baseSteps = $derived(currentProblem ? deriveSteps(currentProblem) : undefined);

  // M6: 8장 메모리 슬롯 — store 스텝들을 모아 MemorySlot 카드로 보여준다(slot 최신값).
  const memoryEntries = $derived.by(() => {
    if (!baseSteps) return [];
    const map = new Map<string, { slot: string; value: number; digits?: string }>();
    for (const s of baseSteps) {
      if (s.t === 'memory' && s.action === 'store') {
        map.set(s.slot, { slot: s.slot, value: s.value, ...(s.digits !== undefined ? { digits: s.digits } : {}) });
      }
    }
    return [...map.values()];
  });

  // 페이딩: 마지막 K 스텝만 입력. K 는 문제 인덱스에 따라 점진 확대.
  const renderSteps = $derived.by(() => {
    if (!baseSteps) return undefined;
    if (lessonState.phase === 'fading') {
      const total = expectCount(baseSteps);
      const k = fadingKForProblem(lessonState.index, total);
      return withExpectOnLastK(baseSteps, k);
    }
    return baseSteps;
  });

  const problemKey = $derived(`${lessonState.phase}-${lessonState.index}`);

  // ── 기법별 시각 컴포넌트(부분곱 롤링 / X-다이어그램 / 브래킷 / 치환 체인 / 지필 4종) ────
  // hook·example 단계에서 StepPlayer 와 함께 보여준다. add/sub 은 시각 없음.
  type TechniqueVisual =
    | { kind: 'roller'; parts: ReturnType<typeof partialProducts> }
    | { kind: 'xdiagram'; base: number }
    | { kind: 'bracket'; problem: Problem }
    | { kind: 'chain'; problem: Problem }
    | { kind: 'coladd'; layout: ReturnType<typeof columnAddLayout> }
    | { kind: 'xmult'; layout: ReturnType<typeof crossMultLayout> }
    | { kind: 'sqrt'; layout: ReturnType<typeof squareRootLayout> }
    | { kind: 'modsum'; result: ReturnType<typeof checkModSum> }
    | { kind: 'adv'; base?: number }
    | null;

  const techniqueVisual = $derived.by<TechniqueVisual>(() => {
    if (!currentProblem) return null;
    const p = currentProblem;
    if (p.op === 'mul') {
      if (p.method === 'square') return { kind: 'xdiagram', base: p.operands[0] ?? 0 };
      // M6 8장 고급 곱셈: 메모리 슬롯(±d 다이어그램은 제곱 계열에만).
      if (p.method === 'square-4digit' || p.method === 'square-5digit') {
        return { kind: 'adv', base: p.operands[0] ?? 0 };
      }
      if (p.method === 'mul-3x2' || p.method === 'mul-3x3' || p.method === 'mul-5x5') {
        return { kind: 'adv' };
      }
      if (p.method === 'paper-cross-mult') return { kind: 'xmult', layout: crossMultLayout(p) };
      if (p.method === 'mod-sum-check') {
        const [a, b] = [p.operands[0] ?? 0, p.operands[1] ?? 0];
        return { kind: 'modsum', result: checkModSum('mul', [a, b], a * b) };
      }
      const parts = partialProducts(p);
      if (parts.length > 0) return { kind: 'roller', parts };
    }
    if (p.op === 'add' && p.method === 'paper-column-add') {
      return { kind: 'coladd', layout: columnAddLayout(p) };
    }
    if (p.op === 'sqrt') return { kind: 'sqrt', layout: squareRootLayout(p) };
    if (p.op === 'div') return { kind: 'bracket', problem: p };
    if (p.op === 'est') return { kind: 'chain', problem: p };
    return null;
  });

  /** 치환 체인 세그먼트 빌드(est 문제 → 반올림 치환 화살표). */
  function chainSegments(p: Problem): { from: number | string; to: number | string; label?: string }[] {
    const band = estimationBand(p);
    return [{ from: band.roundingNote.ko, to: band.estimate, label: '≈' }];
  }

  // ── 연습 단계 UI 보조 상태 ──────────────────────────────────────────────────
  type PracticeMode = 'input' | 'strategy' | 'revealed' | 'review';
  let practiceMode: PracticeMode = $state('input');
  let hintsThisProblem: HintTier[] = $state([]);
  let teachPrefill = $state(0);
  let hintBubble: { tier: HintTier; text: string } | undefined = $state(undefined);

  function resetPracticeProblem(): void {
    hintsThisProblem = [];
    teachPrefill = 0;
    hintBubble = undefined;
  }

  function phaseLabel(): string {
    if (lessonState.phase === 'hook') return m.lesson_phase_hook();
    if (lessonState.phase === 'example') return m.lesson_phase_example();
    if (lessonState.phase === 'fading') return m.lesson_phase_fading();
    if (lessonState.phase === 'practice') return m.lesson_phase_practice();
    return m.lesson_phase_done(); // done
  }

  // ── 연습: 힌트 사다리 ───────────────────────────────────────────────────────
  const hints = $derived(lesson?.file.practice.hints);

  function requestHint(): void {
    if (!hints) return;
    const tier = nextHintTier(hintsThisProblem);
    if (!tier) return;
    if (tier === 'bottom-out') {
      // 답 공개 모드로 전환(아래 'revealed' 에서 continue 시 bottom-out 전파).
      hintsThisProblem = [...hintsThisProblem, 'bottom-out'];
      hintBubble = { tier: 'bottom-out', text: resolveLocalized(hints.bottomOut, activeLocale()) };
      practiceMode = 'revealed';
      return;
    }
    hintsThisProblem = [...hintsThisProblem, tier];
    dispatch({ t: 'hint', tier });
    if (tier === 'teach') teachPrefill = 1;
    hintBubble = { tier, text: resolveLocalized(tier === 'point' ? hints.point : hints.teach, activeLocale()) };
  }

  const hintButtonLabel = $derived.by(() => {
    const tier = nextHintTier(hintsThisProblem);
    if (!tier) return m.lesson_hint();
    if (tier === 'point') return m.lesson_hint();
    if (tier === 'teach') return m.lesson_hint_more();
    return m.lesson_hint_bottom_out();
  });

  // ── 연습: 정답 처리 ─────────────────────────────────────────────────────────
  function onPracticeComplete(): void {
    if (practiceMode !== 'input') return;
    practiceMode = 'strategy'; // 정답 → 전략 카드(아직 advance 안 함)
  }

  function pickStrategy(choice: StrategyChoice | 'skip'): void {
    dispatch({ t: 'solved-correct' });
    if (choice !== 'skip') dispatch({ t: 'strategy', choice });
    resetPracticeProblem();
    if (lessonState.phase !== 'done') practiceMode = 'input';
  }

  // ── 연습: bottom-out 공개 후 계속 ────────────────────────────────────────────
  function continueAfterReveal(): void {
    dispatch({ t: 'bottom-out' });
    resetPracticeProblem();
    if (lessonState.suggestReview) {
      practiceMode = 'review';
    } else {
      practiceMode = 'input';
    }
  }

  function acceptReview(): void {
    dispatch({ t: 'review-accepted' });
    practiceMode = 'input';
  }
  function dismissReview(): void {
    dispatch({ t: 'review-dismissed' });
    practiceMode = 'input';
  }

  // ── 진도 저장: practice 진입 시 + done 시 ────────────────────────────────────
  const profileId = $derived(app.activeProfileId());
  async function writeProgress(patch: Partial<ProgressRecord>): Promise<void> {
    if (!profileId || !lesson) return;
    const base: ProgressRecord = {
      profileId,
      skillId: lesson.file.skillId,
      attempts: lessonState.attempts,
      correct: lessonState.correct,
      lastPlayedAt: Date.now(),
      stars: starsFor(lessonState, lesson.file.practice.passAccuracy)
    };
    await app.saveProgress({ ...base, ...patch });
  }

  // practice 단계에 들어오면 진도 기록(새로고침 후 진도 유지).
  $effect(() => {
    if (!lesson || lessonState.phase !== 'practice' || savedPractice || !profileId) return;
    savedPractice = true;
    void writeProgress({ lessonStepReached: 'practice' });
  });

  // done 시 최종 진도 기록 + SRS 카드 생성(브리프: 레슨 완료 → 카드 생성).
  $effect(() => {
    if (!lesson || lessonState.phase !== 'done' || savedDone || !profileId) return;
    savedDone = true;
    playSound('achievement');
    // Fire confetti celebration
    setTimeout(() => celebration?.rain(50), 100);
    setTimeout(() => celebration?.rain(30), 400);
    // Show achievement toast
    const stars = starsFor(lessonState, lesson.file.practice.passAccuracy);
    if (stars === 3) {
      pushToast(`⭐ ${resolveLocalized(lesson.file.title, activeLocale())} — Perfect!`, {
        icon: 'star', variant: 'achievement', duration: 4000
      });
    } else {
      pushToast(`${resolveLocalized(lesson.file.title, activeLocale())} ✓`, {
        icon: 'check', variant: 'success', duration: 3000
      });
    }
    void (async (): Promise<void> => {
      await writeProgress({
        lessonStepReached: 'done',
        hintsUsed: lessonState.hintsUsed.length,
        bottomOuts: lessonState.bottomOuts,
        strategyCounts: { ...lessonState.strategyCounts },
        completedAt: Date.now()
      });
      // 카드 생성(멱등 — 이미 있으면 덮어쓰지 않음). 기법 × 밴드 1장.
      const ps = lesson.file.practice.problemSet;
      const band = Math.min(
        DEFAULT_SRS_CONFIG.maxDifficultyBand,
        paramsToBand({ digits: ps.digits, carry: ps.carry })
      );
      const factId = makeFactId(lesson.file.skillId, band);
      const existing = await app.loadAllCards();
      const hasCard = existing.some((c) => c.factId === factId);
      if (!hasCard) {
        const card = createCardFromLesson({
          profileId,
          skillId: lesson.file.skillId,
          op: ps.op,
          method: ps.method,
          practiceDigits: ps.digits,
          practiceCarry: ps.carry,
          ...(ps.estOf !== undefined ? { estOf: ps.estOf } : {}),
          now: Date.now(),
          config: DEFAULT_SRS_CONFIG
        });
        await app.upsertCard(card);
      }
    })();
  });

  const finalStars = $derived(lesson ? starsFor(lessonState, lesson.file.practice.passAccuracy) : 0);
  const finalAcc = $derived(Math.round(practiceAccuracy(lessonState) * 100));
  const phaseProblemTotal: number = $derived.by(() => {
    if (!lesson) return 0;
    if (lessonState.phase === 'hook') return counts.hook;
    if (lessonState.phase === 'example') return counts.example;
    if (lessonState.phase === 'fading') return counts.fading;
    if (lessonState.phase === 'practice') return counts.practice;
    return 0; // done
  });

  function goLessons(): void {
    router.navigate('lessons');
  }

  /** 답 공개 모드의 수식 표시(모든 연산 대응). */
  function revealExpression(p: Problem): string {
    const a = p.operands[0] ?? 0; const b = p.operands[1] ?? 0;
    if (p.method === 'square') return `${a}²`;
    const sign = p.op === 'add' ? '+' : p.op === 'sub' ? '−' : p.op === 'mul' ? '×' : p.op === 'div' ? '÷' : '≈';
    return `${a} ${sign} ${b}`;
  }
  /** 답 공개 모드의 답(모든 연산 대응). div 는 몫 R 나머지, est 는 어림 대표값. */
  function revealAnswer(p: Problem): string {
    const a = p.operands[0] ?? 0; const b = p.operands[1] ?? 0;
    if (p.op === 'mul') return String(a * b);
    if (p.op === 'div') {
      const q = Math.floor(a / b);
      const r = a - q * b;
      return r === 0 ? String(q) : `${q} ${m.math_remainder()} ${r}`;
    }
    if (p.op === 'est') {
      const band = estimationBand(p);
      return `≈ ${band.estimate}`;
    }
    return String(p.op === 'add' ? a + b : a - b);
  }
</script>

{#snippet techniqueView()}
  {#if techniqueVisual?.kind === 'roller'}
    <RollingCounter parts={techniqueVisual.parts} />
  {:else if techniqueVisual?.kind === 'xdiagram'}
    <XDiagram base={techniqueVisual.base} />
  {:else if techniqueVisual?.kind === 'bracket'}
    <DivisionBracket problem={techniqueVisual.problem} />
  {:else if techniqueVisual?.kind === 'chain' && currentProblem}
    <SubstitutionChain segments={chainSegments(currentProblem)} />
  {:else if techniqueVisual?.kind === 'coladd'}
    <ColumnAddGrid layout={techniqueVisual.layout} />
  {:else if techniqueVisual?.kind === 'xmult'}
    <CrossMultDiagram layout={techniqueVisual.layout} />
  {:else if techniqueVisual?.kind === 'sqrt'}
    <SquareRootDiagram layout={techniqueVisual.layout} />
  {:else if techniqueVisual?.kind === 'modsum'}
    <ModSumCheck result={techniqueVisual.result} />
  {:else if techniqueVisual?.kind === 'adv'}
    {#if techniqueVisual.base !== undefined}
      <XDiagram base={techniqueVisual.base} />
    {/if}
    <MemorySlot entries={memoryEntries} />
  {/if}
{/snippet}

{#if !lesson}
  <section class="stack">
    <p class="card" role="alert">{m.lesson_missing()}</p>
    <button onclick={goLessons}>{m.lessons_back_to_list()}</button>
  </section>
{:else}
  <section class="stack lesson">
    <header class="lesson-head">
      <p class="phase-tag" aria-live="polite">{phaseLabel()}</p>
      <h2>{resolveLocalized(lesson.file.title, activeLocale())}</h2>
      <p class="muted subtitle">{resolveLocalized(lesson.file.subtitle, activeLocale())}</p>
      {#if lessonState.phase !== 'done'}
        <div class="rule-wrap">
          <RuleCard rule={resolveLocalized(lesson.file.rule, activeLocale())} />
        </div>
      {/if}
      {#if lessonState.phase !== 'done' && phaseProblemTotal > 0}
        <p class="muted small">{m.lesson_problem_n({ n: lessonState.index + 1, total: phaseProblemTotal })}</p>
      {/if}
      <div class="phase-dots" aria-hidden="true">
        <span class="phase-dot {lessonState.phase === 'hook' ? 'active' : ['example','fading','practice','done'].includes(lessonState.phase) ? 'done' : ''}"></span>
        <span class="phase-dot {lessonState.phase === 'example' ? 'active' : ['fading','practice','done'].includes(lessonState.phase) ? 'done' : ''}"></span>
        <span class="phase-dot {lessonState.phase === 'fading' ? 'active' : ['practice','done'].includes(lessonState.phase) ? 'done' : ''}"></span>
        <span class="phase-dot {lessonState.phase === 'practice' ? 'active' : lessonState.phase === 'done' ? 'done' : ''}"></span>
      </div>
    </header>

    {#if lessonState.phase === 'hook' && grid && baseSteps && lesson.hookProblems[0]}
      <div class="card intro-card" role="group" aria-label={m.lesson_phase_hook()}>
        <p class="intro-text">{resolveLocalized(lesson.file.hook.intro, activeLocale())}</p>
      </div>
      <div class="stage-deck technique-stage">
        {@render techniqueView()}
        {#key problemKey}
          <StepPlayer {grid} steps={baseSteps} autoplay oncomplete={() => dispatch({ t: 'next' })} />
        {/key}
      </div>
      <div class="row controls">
        <button class="btn--ghost" onclick={() => dispatch({ t: 'skip-hook' })}>{m.lesson_hook_skip()}</button>
        <button class="btn--primary" onclick={() => dispatch({ t: 'next' })}>{m.lesson_continue()}</button>
      </div>
    {:else if lessonState.phase === 'example' && grid && baseSteps}
      <div class="card intro-card" role="group" aria-label={m.lesson_phase_example()}>
        <p class="intro-text">{resolveLocalized(lesson.file.example.intro, activeLocale())}</p>
      </div>
      <div class="stage-deck technique-stage">
        {@render techniqueView()}
        {#key problemKey}
          <StepPlayer {grid} steps={baseSteps} />
        {/key}
      </div>
      <div class="row controls">
        <button class="btn--primary" onclick={() => dispatch({ t: 'next' })}>{m.lesson_next()}</button>
      </div>
    {:else if lessonState.phase === 'fading' && grid && renderSteps}
      <div class="card intro-card" role="group" aria-label={m.lesson_phase_fading()}>
        <p class="intro-text">{resolveLocalized(lesson.file.fading.intro, activeLocale())}</p>
      </div>
      <div class="stage-deck">
        {#key problemKey}
          <DigitInput {grid} steps={renderSteps} oncomplete={() => dispatch({ t: 'next' })} />
        {/key}
      </div>
    {:else if lessonState.phase === 'practice' && grid && renderSteps && currentProblem}
      {#if practiceMode === 'input'}
        <div class="card intro-card" role="group" aria-label={m.lesson_phase_practice()}>
          <p class="intro-text">{resolveLocalized(lesson.file.practice.intro, activeLocale())}</p>
        </div>
        <div class="stage-deck">
          {#key problemKey}
            <DigitInput {grid} steps={renderSteps} prefill={teachPrefill} oncomplete={onPracticeComplete} />
          {/key}
        </div>
        {#if hintBubble}
          <div class="bubble hint" aria-live="polite" role="status">
            {hintBubble.text}
          </div>
        {/if}
        <div class="row controls">
          <button class="btn--secondary" onclick={requestHint}>{hintButtonLabel}</button>
        </div>
      {:else if practiceMode === 'strategy'}
        <div class="card strategy" role="group" aria-label={m.lesson_strategy_title()}>
          <p class="strategy-title">{m.lesson_strategy_title()}</p>
          <div class="strategy-grid">
            <button class="card strategy-card" onclick={() => pickStrategy('this-technique')}>
              {resolveLocalized(lesson.file.strategyCards.thisTechnique, activeLocale())}
            </button>
            <button class="card strategy-card" onclick={() => pickStrategy('other-technique')}>
              {resolveLocalized(lesson.file.strategyCards.otherTechnique, activeLocale())}
            </button>
            <button class="card strategy-card" onclick={() => pickStrategy('just-knew')}>
              {resolveLocalized(lesson.file.strategyCards.justKnew, activeLocale())}
            </button>
          </div>
          <div class="row">
            <button class="btn--ghost" onclick={() => pickStrategy('skip')}>{m.lesson_strategy_skip()}</button>
          </div>
        </div>
      {:else if practiceMode === 'revealed'}
        <div class="card reveal" role="group" aria-label={m.lesson_hint_bottom_out()}>
          <p class="reveal-label">{m.lesson_hint_bottom_out()}</p>
          <p class="reveal-answer">
            {revealExpression(currentProblem)} =
            <strong>{revealAnswer(currentProblem)}</strong>
          </p>
          {#if hintBubble}
            <p class="muted small">{hintBubble.text}</p>
          {/if}
          <div class="row controls">
            <button class="btn--primary" onclick={continueAfterReveal}>{m.lesson_continue()}</button>
          </div>
        </div>
      {:else if practiceMode === 'review'}
        <div class="card review" role="group" aria-label={m.lesson_review_title()}>
          <p class="review-title">{m.lesson_review_title()}</p>
          <p class="muted">{m.lesson_review_hint()}</p>
          <div class="row controls">
            <button class="btn--primary" onclick={acceptReview}>{m.lesson_review_accept()}</button>
            <button class="btn--ghost" onclick={dismissReview}>{m.lesson_review_dismiss()}</button>
          </div>
        </div>
      {/if}
    {:else if lessonState.phase === 'done'}
      <Ripple options={{ amplitude: 0.5, speed: 0.7, refraction: 70, shine: 0.7, trigger: 'click', interval: 4 }}>
        <div class="done-wrap">
          <Celebration bind:this={celebration} />
          <div class="card done" role="group" aria-label={m.lesson_done_title()}>
          <p class="done-emoji" aria-hidden="true"><Icon name="top-hat" /></p>
          <p class="done-title">{m.lesson_done_title()}</p>
          <p class="muted">{m.lesson_done_subtitle()}</p>
          <div class="done-stars" aria-label={m.lessons_stars({ n: finalStars })}>
            {#each Array(3) as _, i}
              <span class="done-star" class:filled={i < finalStars} style="animation-delay: {i * 0.15}s">
                {#if i < finalStars}★{:else}☆{/if}
              </span>
            {/each}
          </div>
          <p class="muted small">
            {m.lessons_accuracy({ pct: finalAcc })}
          </p>
          <div class="row controls">
            <button class="btn--primary" onclick={goLessons}>{m.lessons_back_to_list()}</button>
            <button class="btn--ghost" onclick={() => router.navigate('home')}>{m.lesson_back_home()}</button>
          </div>
        </div>
      </div>
      </Ripple>
    {/if}
  </section>
{/if}

<style>
  .lesson-head {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .phase-dots {
    display: flex;
    gap: var(--space-1);
    margin-top: var(--space-2);
  }
  .phase-dot {
    width: 28px;
    height: 4px;
    border-radius: var(--radius-pill);
    background: var(--stage-line);
    transition: background var(--motion-base) ease;
  }
  .phase-dot.active {
    background: var(--spotlight);
    box-shadow: 0 0 8px var(--spotlight-glow);
  }
  .phase-dot.done {
    background: var(--applause);
  }
  .phase-tag {
    font-size: var(--text-small);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--spotlight);
    font-weight: 700;
  }
  .subtitle {
    font-size: var(--text-lead);
  }
  .rule-wrap {
    margin: var(--space-2) 0;
  }
  .small {
    font-size: var(--text-small);
  }

  /* 소개/규칙 카드 — 무대 표면 위 안내문 */
  .intro-card {
    background: color-mix(in srgb, var(--stage-mid) 85%, var(--spotlight) 15%);
    border: 1px solid color-mix(in srgb, var(--spotlight) 35%, var(--stage-line));
  }
  .intro-text {
    font-size: var(--text-lead);
  }

  /* 무대 중앙 — 엷은 스포트라이트 침전(Playground 와 동일 톤) */
  .stage-deck {
    background-image: var(--stage-spotlight-bg);
    border-radius: var(--radius-lg);
    padding: var(--space-5) var(--space-4);
    min-height: var(--tap);
    display: flex;
    justify-content: center;
  }

  .controls {
    justify-content: center;
  }

  /* 힌트 말풍선 — 자막바 톤 유지하되 스포트라이트 강조 */
  .bubble.hint {
    background: var(--spotlight-wash);
    border: 1px solid color-mix(in srgb, var(--spotlight) 38%, var(--stage-line));
    border-radius: var(--radius);
    padding: 0.85rem 1rem;
    color: var(--house-bright);
    font-size: var(--text-lead);
  }

  /* 전략 카드 — 3장의 무대 카드 */
  .strategy,
  .reveal,
  .review,
  .done {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .strategy-title,
  .review-title,
  .done-title {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: var(--text-title);
  }
  .strategy-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    gap: var(--space-3);
  }
  .strategy-card {
    cursor: pointer;
    text-align: center;
    font-weight: 600;
    min-height: calc(var(--tap) * 2.2);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform var(--motion-fast) var(--ease-spring), border-color var(--motion-base) ease, box-shadow var(--motion-base) ease;
  }
  .strategy-card:hover {
    border-color: var(--spotlight);
    transform: translateY(-3px) scale(1.03);
    box-shadow: var(--shadow-card), 0 0 20px var(--spotlight-wash);
  }
  .strategy-card:active {
    transform: translateY(0) scale(0.98);
  }

  .reveal-label {
    color: var(--spotlight);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: var(--text-small);
  }
  .reveal-answer {
    font-family: var(--font-numeric);
    font-variant-numeric: tabular-nums;
    font-size: 1.6rem;
    color: var(--house-bright);
    text-align: center;
    padding: var(--space-3);
    background: var(--stage-floor);
    border-radius: var(--radius);
  }
  .reveal-answer strong {
    color: var(--spotlight);
  }

  .done-wrap {
    position: relative;
    overflow: visible;
  }
  .done {
    align-items: center;
    text-align: center;
    position: relative;
    z-index: 1;
  }
  .done-stars {
    display: flex;
    gap: var(--space-2);
    justify-content: center;
    margin: var(--space-2) 0;
  }
  .done-star {
    font-size: 2.5rem;
    color: var(--stage-edge);
    opacity: 0.4;
    animation: star-pop var(--motion-slow) var(--ease-spring) both;
  }
  .done-star.filled {
    color: var(--spotlight);
    opacity: 1;
    text-shadow: 0 0 12px var(--spotlight-glow);
  }
  @keyframes star-pop {
    0% { transform: scale(0) rotate(-180deg); opacity: 0; }
    60% { transform: scale(1.2) rotate(10deg); }
    100% { transform: scale(1) rotate(0); }
  }
  .done-emoji {
    font-size: 3rem;
    margin: 0;
    color: var(--spotlight);
  }

  @media (prefers-reduced-motion: reduce) {
    .stage-deck {
      background-image: none;
    }
  }
</style>
