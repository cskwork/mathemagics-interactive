<script lang="ts">
  /**
   * Hallmark · P4 H4 E4 S4 R4 V4 — digit-cell 에디터 (브리프 §2-5 / 리서치 §2.2).
   *
   * Step[] 에서 `expect:true` 인 write 스텝(= 답 칸)만 학생 입력 대기 지점으로 쓰고,
   * 나머지(highlight·carry·strike)는 진행도에 따라 자동 공개한다.
   *
   * - **활성 셀 강조**: 현재 커서(answer 칸 1곳)에 링.
   * - **auto-advance**: 정답 입력 시 다음 expect 칸으로(방향은 스텝 순서=풀이 순서에 이미 인코딩.
   *   rtl 이면 우→좌, ltr 이면 좌→우). 틀리면 빨강+흔들림, 그대로 머무른다.
   * - **물리 키보드 병행**: 숫자키·Backspace·좌우 화살표.
   * - 모든 탭/키입력에 즉각 시각 반응(PLAN §7.2).
   *
   * 진행 모델: `completedCount` 개의 expect 칸이 올바르게 채워졌다. `frontier` 는
   * steps[0..?] 중 공개할 인덱스 — 완료한 expect 까지 + 그 뒤 따르는 비-expect(highlight/carry/strike)
   * 를 다음 expect 직전까지 자동 공개(캐리/빌림 표시가 다음 입력 전에 나타나도록).
   */
  import { m } from '../lib/paraglide/messages.js';
  import { activeLocale } from '../lib/i18n/locale.svelte.js';
  import { resolveLocalized } from '../lib/content/localized.js';
  import ColumnGrid, { type CellRender } from './ColumnGrid.svelte';
  import NumPad from './NumPad.svelte';
  import { playSound } from '../lib/ui/sound.js';
  import type { Grid, Step, WriteStep } from '../lib/engine/types.js';

  interface Props {
    grid: Grid;
    steps: readonly Step[];
    /** M2: 선두 expect 칸 N 개를 미리 채워둔다(Teach 힌트의 부분 시연). 기본 0. */
    prefill?: number;
    /** M2: 모든 expect 칸을 올바르게 채웠을 때 1회 호출. */
    oncomplete?: () => void;
  }
  const { grid, steps, prefill = 0, oncomplete }: Props = $props();

  /** 학생 입력을 기다리는 답 칸 스텝들(순서 = 풀이 순서). */
  const expectSteps = $derived(
    steps.filter((s): s is WriteStep => s.t === 'write' && s.expect === true)
  );
  const expectCount = $derived(expectSteps.length);

  let completedCount = $state(0); // 올바르게 채워진 expect 칸 수
  let activeIdx = $state(0); // 커서(다음 입력 위치). [0, completedCount] 범위.
  let feedback = $state<{ cell: string; state: 'correct' | 'wrong'; value: string } | undefined>(
    undefined
  );
  let fbTimer: ReturnType<typeof setTimeout> | undefined;
  // spotlight-sweep 재생용 키 — 정답 때마다 증가시켜 오버레이를 리마운트(애니메이션 재시작).
  let sweepKey = $state(0);

  function clearFeedback(): void {
    if (fbTimer !== undefined) {
      clearTimeout(fbTimer);
      fbTimer = undefined;
    }
    feedback = undefined;
  }

  /** completedCount 기준 공개 인덱스(비-expect 는 다음 expect 직전까지 자동 공개). */
  const frontier = $derived.by(() => {
    let seen = 0;
    let f = -1;
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i]!;
      const isExpect = s.t === 'write' && s.expect === true;
      if (isExpect) {
        if (seen < completedCount) {
          f = i;
          seen++;
        } else {
          break; // 다음 미완료 expect — 공개 중단
        }
      } else {
        f = i; // 비-expect: 자동 공개(선행 하이라이트 + 완료한 expect 뒤의 캐리/빌림)
      }
    }
    return f;
  });

  const completed = $derived(completedCount >= expectCount && expectCount > 0);

  // M2: Teach 힌트로 선두 칸이 미리 채워지면 completedCount 를 그만큼 앞당긴다.
  $effect(() => {
    if (prefill > completedCount && prefill <= expectCount) {
      completedCount = prefill;
      activeIdx = Math.min(prefill, Math.max(0, expectCount - 1));
    }
  });

  // M2: 모든 칸을 올바르게 채우면 1회 oncomplete.
  let completedFired = $state(false);
  $effect(() => {
    if (completed && !completedFired) {
      completedFired = true;
      playSound('complete');
      oncomplete?.();
    }
  });

  /** ColumnGrid 셀 맵(순수 계산). */
  const cells = $derived.by<Map<string, CellRender>>(() => {
    const map = new Map<string, CellRender>();
    const upto = frontier;
    for (let i = 0; i <= upto; i++) {
      const s = steps[i]!;
      if (s.t === 'write') {
        map.set(s.cell, { value: s.value, state: 'filled' });
      } else if (s.t === 'carry') {
        map.set(s.cell, { value: s.value, state: 'filled' });
      } else if (s.t === 'reveal') {
        for (const c of s.cells) map.set(c, { value: s.value, state: 'filled' });
      } else if (s.t === 'strike') {
        const prev = map.get(s.cell) ?? {};
        map.set(s.cell, { ...prev, struck: true });
      }
    }
    // 현재 highlight 열 강조(입력 위치 안내)
    const last = steps[frontier];
    if (last && last.t === 'highlight' && last.col) {
      for (const r of grid.rows) {
        const key = `${r.id}.${last.col}`;
        const prev = map.get(key) ?? {};
        map.set(key, { ...prev, state: 'highlight' });
      }
    }
    // feedback 오버레이(정답 초록 / 오답 빨강+흔들림)
    if (feedback) {
      map.set(feedback.cell, { value: feedback.value, state: feedback.state });
    }
    return map;
  });

  const activeCell = $derived(expectSteps[Math.min(activeIdx, expectCount - 1)]?.cell);

  /** 현재 커서 칸의 안내 narration(가장 최근 공개 스텝). */
  const guidance = $derived.by(() => {
    const s = steps[frontier];
    if (!s) return '';
    if ('narration' in s && s.narration) return resolveLocalized(s.narration, activeLocale());
    return '';
  });

  function inputDigit(d: string): void {
    if (completed) return;
    const step = expectSteps[activeIdx];
    if (!step) return;
    clearFeedback();
    if (d === step.value) {
      // 정답
      playSound('correct');
      feedback = { cell: step.cell, state: 'correct', value: d };
      sweepKey += 1; // spotlight-sweep 재생
      if (activeIdx === completedCount) {
        completedCount += 1;
        activeIdx = Math.min(activeIdx + 1, Math.max(0, expectCount - 1));
      }
      fbTimer = setTimeout(clearFeedback, 320);
    } else {
      // 오답 — 빨강+흔들림, 그대로
      playSound('wrong');
      feedback = { cell: step.cell, state: 'wrong', value: d };
      fbTimer = setTimeout(clearFeedback, 480);
    }
  }

  function backspace(): void {
    if (completed) return;
    clearFeedback();
    if (completedCount > 0) {
      completedCount -= 1;
      activeIdx = completedCount;
    }
  }

  function clearAll(): void {
    clearFeedback();
    completedCount = 0;
    activeIdx = 0;
  }

  function handleKey(e: KeyboardEvent): void {
    if (completed) return;
    // 폼 컨트롤(select 등)에 포커스 중에는 키보드 입력을 가로채지 않는다.
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'SELECT' || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      inputDigit(e.key);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      backspace();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      activeIdx = Math.max(0, activeIdx - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      activeIdx = Math.min(completedCount, activeIdx + 1, expectCount - 1);
    }
  }

  function statusText(): string {
    if (completed) return m.playground_completed();
    if (feedback?.state === 'correct') return m.playground_correct();
    if (feedback?.state === 'wrong') return m.playground_wrong();
    return guidance || m.playground_narration();
  }
</script>

<svelte:window onkeydown={handleKey} />

<div class="stack" style="gap: 1rem;">
  <div class="stage-grid">
    {#if feedback?.state === 'correct'}
      {#key sweepKey}<div class="sweep-overlay" aria-hidden="true"></div>{/key}
    {/if}
    <ColumnGrid {grid} {cells} activeCell={activeCell} />
  </div>

  <div class="bubble" aria-live="polite" role="status" aria-label={m.caption_label()}>
    {statusText()}
  </div>

  {#if completed}
    <p class="done">{m.playground_completed()}</p>
  {/if}

  <NumPad ondigit={inputDigit} onbackspace={backspace} onclear={clearAll} disabled={completed} />
</div>

<style>
  .stage-grid {
    position: relative;
    display: flex;
    justify-content: start;
  }
  /* spotlight-sweep 오버레이 — 정답 때 무대를 훑는 빛. 리마운트로 재생(위 {#key}). */
  .sweep-overlay {
    position: absolute;
    inset: -0.5rem;
    pointer-events: none;
    background-image: linear-gradient(
      100deg,
      transparent 30%,
      var(--spotlight-wash-strong) 50%,
      transparent 70%
    );
    background-size: 60% 100%;
    background-repeat: no-repeat;
    animation: spotlight-sweep var(--motion-slow) ease;
    z-index: 2;
  }

  /* 자막바(caption) — 시각적으로 보이는 aria-live 영역(M7 산출물 7) */
  .bubble {
    background: var(--spotlight-wash);
    border: 1px solid color-mix(in srgb, var(--spotlight) 38%, var(--stage-line));
    border-radius: var(--radius);
    padding: 0.85rem 1rem;
    min-height: 3rem;
    line-height: 1.45;
    color: var(--house-bright);
    font-size: var(--text-lead);
  }
  .done {
    text-align: center;
    font-weight: 800;
    color: var(--applause);
    margin: 0;
  }
</style>
