<!--
  Hallmark · P4 H4 E4 S4 R4 V4 — 오늘의 연습 (docs/briefs/M3.md 산출물 4).
  due 카드 기반 혼합 세트(interleaving): 서로 다른 기법이 번갈아 나온다.
  - DigitInput 으로 풀이(자동채점). 정답 → good, "답 보기" → again(lapse).
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
  import type { SrsCard, ProgressRecord } from '../lib/storage/types.js';
  import { DEFAULT_SRS_CONFIG, DAY_MS } from '../lib/srs/config.js';
  import { buildSession, reviewCard, rebandCard, proficiencyOf } from '../lib/srs/integration.js';
  import { loadAllLessons } from '../lib/lesson/loader.js';
  import { initialStreak, updateStreak } from '../lib/srs/streak.js';
  import DigitInput from '../components/DigitInput.svelte';
  import Celebration from '../lib/components/canvasui/Celebration.svelte';
  import { playSound } from '../lib/ui/sound.js';

  interface Props {
    app: AppState;
    router: Router;
  }
  const { app, router }: Props = $props();

  const lessons = loadAllLessons();

  type Phase = 'loading' | 'playing' | 'done' | 'empty';
  let phase: Phase = $state('loading');
  let session: SrsCard[] = $state([]);
  let index = $state(0);
  let correctCount = $state(0);
  /** 복습 결과(원본 카드 → 갱신된 카드 + rating). 종료 시 일괄 persist. */
  let results: { original: SrsCard; updated: SrsCard; rating: 'again' | 'good' }[] = $state([]);
  let celebration: Celebration | undefined = $state(undefined);

  async function startSession(): Promise<void> {
    phase = 'loading';
    const now = Date.now();
    const due = await app.getDueCards(now, 200);
    if (due.length === 0) {
      phase = 'empty';
      return;
    }
    const built = buildSession(due, now, DEFAULT_SRS_CONFIG, Math.floor(now / DAY_MS));
    // overflow 카드 due 재분산 저장(밀린 카드 폭탄 방지).
    for (const c of built.deferred) await app.upsertCard(c);
    session = [...built.session];
    if (session.length === 0) {
      phase = 'empty';
      return;
    }
    index = 0;
    correctCount = 0;
    results = [];
    phase = 'playing';
  }

  // 활성 프로필 진입 시 세션 시작.
  $effect(() => {
    void app.activeProfile();
    if (app.activeProfileId()) void startSession();
  });

  const currentCard = $derived(session[index]);

  const currentProblem: Problem | undefined = $derived.by(() => {
    const c = currentCard;
    if (!c || !c.op || !c.method || !c.digits) return undefined;
    const seed = Math.floor((c.factId.charCodeAt(0) ?? 1) * 1000 + index * 31 + Date.now() / DAY_MS);
    try {
      return generateProblem(
        seed >>> 0,
        { op: c.op, method: c.method, digits: c.digits, carry: c.carry ?? true }
      );
    } catch {
      return undefined;
    }
  });

  const grid = $derived(currentProblem ? deriveGrid(currentProblem) : undefined);
  const steps = $derived(currentProblem ? deriveSteps(currentProblem) : undefined);

  function techniqueTitle(skillId: string): string {
    const lesson = lessons.find((l) => l.file.skillId === skillId);
    return lesson ? resolveLocalized(lesson.file.title, activeLocale()) : skillId;
  }

  function onSolved(): void {
    const c = currentCard;
    if (!c) return;
    const updated = reviewCard(c, 'good', Date.now(), DEFAULT_SRS_CONFIG);
    results = [...results, { original: c, updated, rating: 'good' }];
    correctCount += 1;
    // 진도 즉시 저장: 문제를 풀 때마다 저장(중간에 나가도 진도 유지).
    void savePracticeProgress(c.skillId ?? '', 1, 1);
    advance();
  }

  function showAnswer(): void {
    const c = currentCard;
    if (!c) return;
    const updated = reviewCard(c, 'again', Date.now(), DEFAULT_SRS_CONFIG);
    results = [...results, { original: c, updated, rating: 'again' }];
    void savePracticeProgress(c.skillId ?? '', 1, 0);
    advance();
  }

  /** 개별 문제 풀이 시 즉시 진도 저장(세션 중간 종료 대비). */
  async function savePracticeProgress(skillId: string, attempts: number, correct: number): Promise<void> {
    if (!skillId) return;
    const prog = await app.loadProgress(skillId);
    const base = prog ?? emptyProgress(skillId);
    await app.saveProgress({
      ...base,
      practiceAttempts: (base.practiceAttempts ?? 0) + attempts,
      practiceCorrect: (base.practiceCorrect ?? 0) + correct,
      lastPlayedAt: Date.now()
    });
  }

  function advance(): void {
    if (index + 1 < session.length) {
      index += 1;
    } else {
      void finishSession();
    }
  }

  async function finishSession(): Promise<void> {
    playSound('achievement');
    setTimeout(() => celebration?.rain(40), 200);
    const now = Date.now();
    // 1. 복습한 카드 persist.
    for (const r of results) await app.upsertCard(r.updated);

    // 2. 적응 난이도: 기법별 최근 정확도 → 밴드 조정(밴드 바뀌면 구 factId 삭제 후 새 카드 upsert).
    const bySkill = new Map<string, { correct: number; total: number; cards: SrsCard[] }>();
    for (const r of results) {
      const sid = r.original.skillId ?? '';
      const e = bySkill.get(sid) ?? { correct: 0, total: 0, cards: [] };
      e.correct += r.rating === 'good' ? 1 : 0;
      e.total += 1;
      e.cards.push(r.updated);
      bySkill.set(sid, e);
    }
    const allCards = await app.loadAllCards();
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
      // 연습 누적 진도는 onSolved/showAnswer 에서 이미 개별 저장했으므로 여기서 중복 저장하지 않음.
      const prog = await app.loadProgress(sid);
      const decision = proficiencyOf(sid, allCards, prog, DEFAULT_SRS_CONFIG);
      if (decision.newlyPassed) {
        await app.saveProgress({ ...(prog ?? emptyProgress(sid)), gatePassedAt: now });
      }
    }

    // 4. 스트릭 갱신(관대 — 최소량 1 이상이면).
    const settings = app.settings();
    if (settings) {
      const prev = {
        streakCount: settings.streakCount ?? 0,
        lastStreakDayMs: settings.lastStreakDayMs ?? 0,
        freezesAvailable: settings.freezesAvailable ?? DEFAULT_SRS_CONFIG.streakDefaultFreezes
      };
      const base = prev.streakCount === 0 ? initialStreak(DEFAULT_SRS_CONFIG) : prev;
      const upd = updateStreak(base, now, results.length, DEFAULT_SRS_CONFIG);
      await app.updateSettings({
        streakCount: upd.state.streakCount,
        lastStreakDayMs: upd.state.lastStreakDayMs,
        freezesAvailable: upd.state.freezesAvailable
      });
    }

    phase = 'done';
  }

  function emptyProgress(skillId: string): ProgressRecord {
    return {
      profileId: app.activeProfileId() ?? '',
      skillId,
      attempts: 0,
      correct: 0,
      lastPlayedAt: Date.now(),
      stars: 0
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
      <p class="muted small">{m.practice_problem_n({ n: index + 1, total: sessionTotal })}</p>
    </div>

    <div class="stage-deck">
      {#key `${currentCard.factId}-${index}`}
        <DigitInput {grid} {steps} oncomplete={onSolved} />
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
