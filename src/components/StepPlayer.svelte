<script lang="ts">
  /**
   * Hallmark · P3 H4 E4 S3 R4 V3 — 스텝 재생기 (브리프 §2-4 / 리서치 §3).
   *
   * 현재 스텝 인덱스 하나로 재생/일시정지/이전/다음/처음부터/속도(1x·0.5x)를 전부 구현한다
   * (리서치 §3.1 "스텝 상태 기계"). 애니메이션은 스텝 전환의 부수 효과 — CSS transition 기본,
   * 시퀀싱은 setTimeout 하나. Motion mini(~5KB)는 쓰지 않는다(사유: 단일 타이머 시퀀싱으로
   * 충분, 병렬·스프링 불필요 → 의존성 0 유지).
   *
   * `narration` 은 말풍선 + `aria-live="polite"` 낭독 영역(리서치 §1.5/§3.1).
   * `prefers-reduced-motion` 시 셀 전환을 즉시(very short duration)로 만든다.
   */
  import { m } from '../lib/paraglide/messages.js';
  import Icon from './Icon.svelte';
  import { activeLocale } from '../lib/i18n/locale.svelte.js';
  import { resolveLocalized } from '../lib/content/localized.js';
  import ColumnGrid, { type CellRender } from './ColumnGrid.svelte';
  import { playSound } from '../lib/ui/sound.js';
  import type { Grid, Step } from '../lib/engine/types.js';

  interface Props {
    grid: Grid;
    steps: readonly Step[];
    /** M2: 마운트 시 자동 재생(레슨 훅 데모). 기본 false. */
    autoplay?: boolean;
    /** M2: 끝 스텝에 도달했을 때 1회 호출(레슨 훅→예제 전환 등). */
    oncomplete?: () => void;
  }
  const { grid, steps, autoplay = false, oncomplete }: Props = $props();

  let index = $state(0);
  let playing = $state(false);
  let speed = $state(1);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let completedFired = $state(false);

  const BASE_MS: Record<Step['t'], number> = {
    highlight: 950,
    write: 750,
    carry: 650,
    strike: 650,
    reveal: 750,
    running: 850,
    branch: 800,
    memory: 900
  };

  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function stepDuration(s: Step): number {
    const base = BASE_MS[s.t];
    const scaled = base / speed;
    // reduced-motion: 전환을 사실상 즉시로(짧은 고정값). 순서는 유지.
    return reduceMotion ? Math.min(scaled, 120) : scaled;
  }

  function clearTimer(): void {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  }

  function advance(): void {
    if (index < steps.length - 1) {
      index += 1;
      playSound('tick');
    } else {
      playing = false;
      if (!completedFired) {
        completedFired = true;
        oncomplete?.();
      }
    }
  }

  // 재생 중이면 현재 스텝 duration 후 다음 스텝으로.
  $effect(() => {
    if (!playing) return;
    const cur = steps[index];
    if (!cur || index >= steps.length - 1) {
      playing = false;
      if (!completedFired) {
        completedFired = true;
        playSound('complete');
        oncomplete?.();
      }
      return;
    }
    timer = setTimeout(() => {
      advance();
    }, stepDuration(cur));
    return () => clearTimer();
  });

  // M2: 마운트 시 자동 재생(레슨 훅 데모).
  $effect(() => {
    if (autoplay && !playing && !completedFired && steps.length > 0) {
      playing = true;
    }
  });

  function play(): void {
    if (index >= steps.length - 1) index = 0; // 끝에서 재생 → 처음부터
    playing = true;
  }
  function pause(): void {
    playing = false;
  }
  function next(): void {
    playing = false;
    if (index < steps.length - 1) { index += 1; playSound('tick'); }
  }
  function prev(): void {
    playing = false;
    if (index > 0) index -= 1;
  }
  function restart(): void {
    playing = false;
    index = 0;
  }
  function toggleSpeed(): void {
    speed = speed === 1 ? 0.5 : 1;
  }

  const total = $derived(steps.length);
  const current = $derived(steps[index]);
  const atEnd = $derived(index >= total - 1);
  const narrationText = $derived(
    current?.narration ? resolveLocalized(current.narration, activeLocale()) : ''
  );

  /** steps[0..index] 를 reduce 해 ColumnGrid 용 셀 맵을 만든다(순수 계산). */
  const cells = $derived.by<Map<string, CellRender>>(() => {
    const map = new Map<string, CellRender>();
    for (let i = 0; i <= index && i < steps.length; i++) {
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
    // 현재 highlight 스텝의 열/셀을 강조(일시적 — 현재 스텝에만).
    const cur = steps[index];
    if (cur && cur.t === 'highlight') {
      const markCol = (col: string) => {
        for (const r of grid.rows) {
          const key = `${r.id}.${col}`;
          const prev = map.get(key) ?? {};
          map.set(key, { ...prev, state: 'highlight' });
        }
      };
      if (cur.col) markCol(cur.col);
      if (cur.cells) for (const c of cur.cells) {
        const prev = map.get(c) ?? {};
        map.set(c, { ...prev, state: 'highlight' });
      }
    }
    return map;
  });
</script>

<div class="stack" style="gap: 1rem;">
  <ColumnGrid {grid} {cells} />

  <div class="bubble" aria-live="polite" role="status">
    {narrationText || m.playground_narration()}
  </div>

  <div class="progress-bar" role="progressbar" aria-valuenow={index + 1} aria-valuemin={1} aria-valuemax={total}>
    <div class="progress-fill" style="width: {total > 0 ? ((index + 1) / total) * 100 : 0}%"></div>
  </div>
  <div class="row controls" role="group" aria-label={m.player_play()}>
    <button onclick={restart} aria-label={m.player_restart()} disabled={index === 0 && !playing}><Icon name="restart" /></button>
    <button onclick={prev} aria-label={m.player_prev()} disabled={index === 0}><Icon name="prev" /></button>
    {#if playing}
      <button class="primary" onclick={pause} aria-label={m.player_pause()}><Icon name="pause" /></button>
    {:else}
      <button class="primary" onclick={play} aria-label={m.player_play()} disabled={atEnd}><Icon name="play" /></button>
    {/if}
    <button onclick={next} aria-label={m.player_next()} disabled={atEnd}><Icon name="play" /></button>
    <button class="speed" onclick={toggleSpeed} aria-label={m.player_speed()} aria-pressed={speed === 0.5}>
      {speed}×
    </button>
  </div>

  <p class="muted step-counter">{m.player_step({ n: index + 1, total })}</p>
</div>

<style>
  /* 자막바(caption) — aria-live 낭독 영역을 시각적으로도 보이게(M7 산출물 7).
   * 무대 앞 자막: 하단 가로형 바, 본문 대비 뚜렷한 표면. */
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
  .controls {
    justify-content: center;
    flex-wrap: wrap;
  }
  .controls button {
    min-width: var(--tap);
  }
  .speed {
    font-family: var(--font-numeric);
    font-variant-numeric: tabular-nums;
    font-weight: 800;
  }
  .step-counter {
    text-align: center;
    font-family: var(--font-numeric);
    font-variant-numeric: tabular-nums;
    margin: 0;
  }
  .progress-bar {
    width: 100%;
    height: 6px;
    background: var(--stage-line);
    border-radius: var(--radius-pill);
    overflow: hidden;
    opacity: 0.8;
  }
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--spotlight), var(--spotlight-bright));
    border-radius: var(--radius-pill);
    transition: width var(--motion-base) var(--ease-stage);
    box-shadow: 0 0 8px var(--spotlight-glow);
  }
</style>
