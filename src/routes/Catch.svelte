<!--
  Hallmark · P4 H4 E4 S4 R4 V4 — "오답 잡아내기" 라우트 (M5 산출물 3). #/catch
  CatchWrongGame 컴포넌트를 감싸는 얇은 셸. 모드섬 검산(6장) 의 응용 게임.
-->
<script lang="ts">
  import { m } from '../lib/paraglide/messages.js';
  import CatchWrongGame from '../components/CatchWrongGame.svelte';
  import type { AppState } from '../lib/profiles/app-state.svelte.js';
  import type { Router } from '../lib/router/hash-router.svelte.js';
  import type { ProgressRecord } from '../lib/storage/types.js';
  import { DEFAULT_SRS_CONFIG } from '../lib/srs/config.js';
  import { initialStreak, updateStreak } from '../lib/srs/streak.js';

  interface Props {
    app: AppState;
    router: Router;
  }
  const { app, router }: Props = $props();

  const CATCH_SKILL_ID = 'catch-wrong';
  let catchesSolved = $state(0);

  /** CatchWrongGame 이 오답을 잡을 때마다 호출된다. */
  async function onCaught(): Promise<void> {
    catchesSolved += 1;
    const prog = await app.loadProgress(CATCH_SKILL_ID);
    const base = prog ?? {
      profileId: app.activeProfileId() ?? '',
      skillId: CATCH_SKILL_ID,
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
</script>

<section class="stack">
  <CatchWrongGame oncaught={onCaught} />
  <div class="row">
    <button class="btn--ghost" onclick={() => router.navigate('home')}>{m.lesson_back_home()}</button>
  </div>
</section>
