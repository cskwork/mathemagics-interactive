<!--
  Hallmark · P4 H4 E4 S4 R4 V4 — 오늘의 연습 (docs/briefs/M3.md 산출물 4).
  due 카드 기반 혼합 세트(interleaving): 서로 다른 기법이 번갈아 나온다.
  - 숫자는 DigitInput, 배수 판정은 ChoiceInput 으로 풀이(자동채점). 정답 → good, "답 보기" → again(lapse).
  - 세션은 백로그 캡(maxBacklog) 분량 — 5–10분, 자연스러운 종료 화면. 무한 이어하기 금지.
  - 종료 시: 카드 reschedule, streak 갱신, 적응 난이도 밴드 조정, 게이트 통과 표시.
  모든 색/폰트는 M7 토큰(var(--*)), 컴포넌트는 DigitInput 재사용. 손실 압박·비교 없음.
-->
<script lang="ts">
  import { m } from '../lib/paraglide/messages.js';
  import Icon from '../components/Icon.svelte';
  import { activeLocale } from '../lib/i18n/locale.svelte.js';
  import { resolveLocalized } from '../lib/content/localized.js';
  import { deriveGrid, deriveSteps } from '../lib/engine/derive.js';
  import { generateProblem } from '../lib/engine/generate.js';
  import type { Problem } from '../lib/engine/types.js';
  import type { AppState } from '../lib/profiles/app-state.svelte.js';
  import type { Router } from '../lib/router/hash-router.svelte.js';
  import type { Settings, SrsCard } from '../lib/storage/types.js';
  import { DEFAULT_SRS_CONFIG, DAY_MS } from '../lib/srs/config.js';
  import { buildSession, reviewCard, rebandCard, proficiencyOf } from '../lib/srs/integration.js';
  import { loadAllLessons } from '../lib/lesson/loader.js';
  import { initialStreak, updateStreak } from '../lib/srs/streak.js';
  import DigitInput from '../components/DigitInput.svelte';
  import ChoiceInput from '../components/ChoiceInput.svelte';
  import Celebration from '../lib/components/canvasui/Celebration.svelte';
  import { playSound } from '../lib/ui/sound.js';
  import AnimatedCounter from '../components/AnimatedCounter.svelte';
  import { pushToast } from '../lib/ui/toast.svelte.js';
  import { PracticeSessionPersistence } from '../lib/practice/persistence.js';

  interface Props {
    app: AppState;
    router: Router;
  }
  const { app, router }: Props = $props();

  const lessons = loadAllLessons();

  type Phase = 'loading' | 'playing' | 'saving' | 'done' | 'empty' | 'error';
  let phase: Phase = $state('loading');
  let session: SrsCard[] = $state([]);
  let index = $state(0);
  let correctCount = $state(0);
  /** 복습 결과(원본 카드 → 갱신된 카드 + rating). 종료 시 일괄 persist. */
  let results: { original: SrsCard; updated: SrsCard; rating: 'again' | 'good' }[] = $state([]);
  let celebration: Celebration | undefined = $state(undefined);
  let startGeneration = 0;
  let sessionPersistence: PracticeSessionPersistence | undefined;
  let sessionSettings: Settings | undefined;

  async function startSession(profileId: string): Promise<void> {
    const generation = ++startGeneration;
    phase = 'loading';
    sessionPersistence = undefined;
    sessionSettings = undefined;
    const now = Date.now();
    const due = await app.getDueCardsForProfile(profileId, now, 200);
    if (generation !== startGeneration) return;
    if (due.length === 0) {
      phase = 'empty';
      return;
    }
    const built = buildSession(due, now, DEFAULT_SRS_CONFIG, Math.floor(now / DAY_MS));
    // overflow 카드 due 재분산 저장(밀린 카드 폭탄 방지).
    for (const c of built.deferred) {
      if (generation !== startGeneration) return;
      await app.upsertCard(c);
    }
    if (generation !== startGeneration) return;
    session = [...built.session];
    if (session.length === 0) {
      phase = 'empty';
      return;
    }
    index = 0;
    correctCount = 0;
    results = [];
    sessionPersistence = new PracticeSessionPersistence(app, profileId);
    if (app.activeProfileId() === profileId) sessionSettings = app.settings();
    phase = 'playing';
  }

  // 활성 프로필 진입 시 세션 시작.
  $effect(() => {
    void app.activeProfile();
    const profileId = app.activeProfileId();
    if (profileId) void startSession(profileId);
  });

  const currentCard = $derived(session[index]);

  const currentProblem: Problem | undefined = $derived.by(() => {
    const c = currentCard;
    if (!c || !c.op || !c.method || !c.digits) return undefined;
    const seed = Math.floor((c.factId.charCodeAt(0) ?? 1) * 1000 + index * 31 + Date.now() / DAY_MS);
    try {
      return generateProblem(
        seed >>> 0,
        {
          op: c.op,
          method: c.method,
          digits: c.digits,
          carry: c.carry ?? true,
          ...(c.estOf !== undefined ? { estOf: c.estOf } : {})
        }
      );
    } catch {
      return undefined;
    }
  });

  const grid = $derived(currentProblem ? deriveGrid(currentProblem) : undefined);
  const steps = $derived(currentProblem ? deriveSteps(currentProblem) : undefined);
  const expectsChoice = $derived(
    steps?.some((step) => step.t === 'choice' && step.expect === true) ?? false
  );

  function techniqueTitle(skillId: string): string {
    const lesson = lessons.find((l) => l.file.skillId === skillId);
    return lesson ? resolveLocalized(lesson.file.title, activeLocale()) : skillId;
  }
  function techniqueRule(skillId: string): string | undefined {
    const lesson = lessons.find((l) => l.file.skillId === skillId);
    return lesson ? resolveLocalized(lesson.file.rule, activeLocale()) : undefined;
  }

  function onSolved(): void {
    if (phase !== 'playing') return;
    const c = currentCard;
    if (!c) return;
    const updated = reviewCard(c, 'good', Date.now(), DEFAULT_SRS_CONFIG);
    results = [...results, { original: c, updated, rating: 'good' }];
    correctCount += 1;
    // 진도 즉시 저장: 문제를 풀 때마다 저장(중간에 나가도 진도 유지).
    sessionPersistence?.record(c.skillId ?? '', true);
    advance();
  }

  function showAnswer(): void {
    if (phase !== 'playing') return;
    const c = currentCard;
    if (!c) return;
    const updated = reviewCard(c, 'again', Date.now(), DEFAULT_SRS_CONFIG);
    results = [...results, { original: c, updated, rating: 'again' }];
    sessionPersistence?.record(c.skillId ?? '', false);
    advance();
  }

  function advance(): void {
    if (index + 1 < session.length) {
      index += 1;
    } else {
      finishSession();
    }
  }

  function finishSession(): void {
    if (phase !== 'playing' || !sessionPersistence) return;

    phase = 'saving';
    const generation = startGeneration;
    const persistence = sessionPersistence;
    const profileId = persistence.profileId;
    const settings = sessionSettings;
    const sessionResults = [...results];
    const sessionCorrect = correctCount;

    void persistence
      .finishOnce(async () => {
        const now = Date.now();
        // 1. 복습한 카드 persist.
        for (const r of sessionResults) await app.upsertCard(r.updated);

        // 2. 적응 난이도: 기법별 최근 정확도 → 밴드 조정(밴드 바뀌면 구 factId 삭제 후 새 카드 upsert).
        const bySkill = new Map<string, { correct: number; total: number; cards: SrsCard[] }>();
        for (const r of sessionResults) {
          const sid = r.original.skillId ?? '';
          const e = bySkill.get(sid) ?? { correct: 0, total: 0, cards: [] };
          e.correct += r.rating === 'good' ? 1 : 0;
          e.total += 1;
          e.cards.push(r.updated);
          bySkill.set(sid, e);
        }
        const allCards = await app.loadAllCardsForProfile(profileId);
        for (const [sid, agg] of bySkill) {
          const acc = agg.total > 0 ? agg.correct / agg.total : 0.5;
          for (const c of agg.cards) {
            const { card: rebanded, bandChanged } = rebandCard(c, acc, DEFAULT_SRS_CONFIG);
            if (bandChanged) {
              // 구 factId 제거는 저장소가 upsert 기반이라 factId 가 바뀌면 별도 삭제 필요.
              // 어댑터에 deleteCard 가 없으므로, 구 카드 due 를 먼 미래로 밀어 사실상 비활성(단순화).
              await app.upsertCard({ ...c, due: now + 365 * DAY_MS });
              await app.upsertCard(rebanded);
            }
          }

          // 3. 게이트 통과 표시(단조 잠금).
          // 연습 누적 진도는 위의 직렬화된 개별 저장에서 이미 반영했으므로 여기서 중복 저장하지 않음.
          const prog = await app.loadProgressForProfile(profileId, sid);
          const decision = proficiencyOf(sid, allCards, prog, DEFAULT_SRS_CONFIG);
          if (decision.newlyPassed) {
            await app.saveProgress({
              ...(prog ?? emptyProgress(profileId, sid)),
              profileId,
              gatePassedAt: now
            });
          }
        }

        // 4. 스트릭 갱신(관대 — 최소량 1 이상이면).
        if (settings) {
          const prev = {
            streakCount: settings.streakCount ?? 0,
            lastStreakDayMs: settings.lastStreakDayMs ?? 0,
            freezesAvailable: settings.freezesAvailable ?? DEFAULT_SRS_CONFIG.streakDefaultFreezes
          };
          const base = prev.streakCount === 0 ? initialStreak(DEFAULT_SRS_CONFIG) : prev;
          const upd = updateStreak(base, now, sessionResults.length, DEFAULT_SRS_CONFIG);
          await app.updateSettingsForProfile(profileId, {
            streakCount: upd.state.streakCount,
            lastStreakDayMs: upd.state.lastStreakDayMs,
            freezesAvailable: upd.state.freezesAvailable
          });
        }
      })
      .then(() => {
        if (generation !== startGeneration) return;
        playSound('achievement');
        setTimeout(() => celebration?.rain(40), 200);
        if (sessionCorrect === sessionResults.length && sessionResults.length > 0) {
          pushToast(m.practice_completion_perfect(), {
            icon: 'star', variant: 'achievement', duration: 4000
          });
        } else if (sessionResults.length > 0) {
          pushToast(
            m.practice_completion_result({ correct: sessionCorrect, total: sessionResults.length }),
            { icon: 'check', variant: 'success', duration: 3000 }
          );
        }
        phase = 'done';
      })
      .catch(() => {
        if (generation === startGeneration) phase = 'error';
      });
  }

  function emptyProgress(profileId: string, skillId: string) {
    return {
      profileId,
      skillId,
      attempts: 0,
      correct: 0,
      lastPlayedAt: Date.now(),
      stars: 0 as const
    };
  }

  const sessionTotal = $derived(session.length);
</script>

<section class="stack practice">
  <header class="practice-head">
    <h2>{m.practice_heading()}</h2>
    {#if phase === 'playing'}
      <p class="muted small">{m.practice_intro()}</p>
    {/if}
  </header>

  {#if phase === 'loading'}
    <p class="muted">{m.loading()}</p>
  {:else if phase === 'saving'}
    <p class="muted" role="status">{m.practice_saving()}</p>
  {:else if phase === 'error'}
    <div class="card empty" role="alert">
      <p>{m.practice_save_error()}</p>
      <button class="btn--primary" onclick={() => router.navigate('home')}>{m.practice_back_home()}</button>
    </div>
  {:else if phase === 'empty'}
    <div class="card empty">
      <p class="emoji" aria-hidden="true"><Icon name="sparkles" /></p>
      <p>{m.practice_empty()}</p>
      <div class="row controls">
        <button class="btn--primary" onclick={() => router.navigate('home')}>{m.practice_back_home()}</button>
        <button class="btn--ghost" onclick={() => router.navigate('lessons')}>{m.nav_lessons()}</button>
      </div>
    </div>
  {:else if phase === 'playing' && currentCard && grid && steps && currentProblem}
    <div class="card trick-banner" role="group" aria-label={m.practice_which_trick()}>
      <p class="kicker">{m.practice_which_trick()}</p>
      <p class="trick-name">{techniqueTitle(currentCard.skillId ?? '')}</p>
      {#if techniqueRule(currentCard.skillId ?? '')}
        <p class="trick-rule">{techniqueRule(currentCard.skillId ?? '')}</p>
      {/if}
      <p class="muted small">{m.practice_problem_n({ n: index + 1, total: sessionTotal })}</p>
    </div>

    <div class="stage-deck">
      {#key `${currentCard.factId}-${index}`}
        {#if expectsChoice}
          <ChoiceInput {steps} oncomplete={onSolved} />
        {:else}
          <DigitInput {grid} {steps} oncomplete={onSolved} />
        {/if}
      {/key}
    </div>

    <div class="row controls">
      <button class="btn--ghost" onclick={showAnswer}>{m.lesson_hint_bottom_out()}</button>
    </div>
  {:else if phase === 'done'}
    <div class="done-wrap">
      <Celebration bind:this={celebration} />
      <div class="card done" role="group" aria-label={m.practice_done_title()}>
      <p class="done-emoji bounce-in" aria-hidden="true"><Icon name="top-hat" /></p>
      <p class="done-title">{m.practice_done_title()}</p>
      <p class="muted">{m.practice_done_subtitle()}</p>
      <div class="done-accuracy">
        <div class="accuracy-numbers">
          <AnimatedCounter value={correctCount} />
          <span class="accuracy-sep">/</span>
          <span class="accuracy-total">{results.length}</span>
        </div>
        <div class="accuracy-bar">
          <div class="accuracy-fill" style="width: {results.length > 0 ? (correctCount / results.length) * 100 : 0}%"></div>
        </div>
        <p class="muted small">{m.practice_session_stats({ correct: correctCount, total: results.length })}</p>
      </div>
      <div class="row controls">
        <button class="btn--primary" onclick={() => router.navigate('home')}>{m.practice_back_home()}</button>
        <button class="btn--ghost" onclick={() => router.navigate('progress')}>{m.practice_see_progress()}</button>
      </div>
    </div>
    </div>
  {/if}
</section>

<style>
  .practice-head h2 {
    font-size: var(--text-title);
  }
  .small {
    font-size: var(--text-small);
  }

  .empty,
  .done {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    align-items: center;
    text-align: center;
  }
  .emoji,
  .done-emoji {
    font-size: 3rem;
    margin: 0;
    color: var(--spotlight);
  }
  .done-title {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: var(--text-title);
  }

  /* "어떤 트릭?" 판단 배너 — interleaving 의 핵심(전략 선택 훈련). */
  .trick-banner {
    background: color-mix(in srgb, var(--stage-mid) 85%, var(--spotlight) 15%);
    border: 1px solid color-mix(in srgb, var(--spotlight) 35%, var(--stage-line));
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .kicker {
    font-size: var(--text-small);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--spotlight);
    font-weight: 700;
  }
  .trick-name {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: var(--text-lead);
    margin: 0;
    overflow-wrap: anywhere;
  }

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

  @media (prefers-reduced-motion: reduce) {
    .stage-deck {
      background-image: none;
    }
  }
</style>
