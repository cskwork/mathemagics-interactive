<!--
  Hallmark · P4 H4 E4 S4 R4 V4 — 크리스크로스 곱셈 다이어그램 (M5 산출물 2).
  두 수를 위아래로 쓰고 대각선 교차선을 SVG 로 그린다(book-content-map §6-5 / §4-3).
  activeDiagonal 로 현재 스텝의 대각선을 강조 — 1-2-3-2-1 리듬 재생의 핵심 자산.
-->
<script lang="ts">
  import { m } from '../lib/paraglide/messages.js';
  import { digitsOf } from '../lib/engine/derive-internals.js';
  import type { CrossMultLayout } from '../lib/engine/types.js';

  interface Props {
    layout: CrossMultLayout;
    /** 현재 진행 중인 대각선(0=일의 자리 결과). */
    activeDiagonal?: number | undefined;
  }
  const { layout, activeDiagonal }: Props = $props();

  const aD = $derived(digitsOf(layout.a));
  const bD = $derived(digitsOf(layout.b));
  // 큰 자리부터 좌→우 표시.
  const width = $derived(Math.max(aD.length, bD.length));
  const cellSize = $derived(2.75);
  // a(위 행)의 자릿수 place i 의 x 좌표. a 의 일의 자리(place0) 가 가장 오른쪽.
  function xOf(place: number, len: number): number {
    return (width - len + place) * cellSize + cellSize / 2;
  }
  function yOf(row: 'a' | 'b' | 'ans'): number {
    return row === 'a' ? cellSize : row === 'b' ? cellSize * 2.2 : cellSize * 3.6;
  }
  /** 대각선 p 의 교차선 좌표들. */
  const diagPaths = $derived(
    layout.diagonals.map((diag) => ({
      p: diag.resultPlace,
      lines: diag.pairs.map((pair) => ({
        x1: xOf(pair.aPlace, aD.length),
        y1: yOf('a'),
        x2: xOf(pair.bPlace, bD.length),
        y2: yOf('b'),
        label: `${pair.aDigit}×${pair.bDigit}`
      })),
      writeDigit: diag.writeDigit
    }))
  );
  const ansLen = $derived(String(layout.product).length);
</script>

<div class="xmult">
  <svg
    class="xmult-svg"
    role="img"
    aria-label={m.xmult_label({ a: layout.a, b: layout.b })}
    viewBox={`0 0 ${cellSize * (width + 1)} ${cellSize * 4.4}`}
  >
    <!-- a 행(위) 숫자 -->
    {#each aD as d, i (i)}
      {@const place = i}
      <text x={xOf(place, aD.length)} y={yOf('a')} class="digit digit--a">{d}</text>
    {/each}
    <!-- b 행(아래) 숫자 + 곱하기 기호 -->
    <text x={cellSize * 0.15} y={yOf('b')} class="sign">×</text>
    {#each bD as d, i (i)}
      {@const place = i}
      <text x={xOf(place, bD.length)} y={yOf('b')} class="digit digit--b">{d}</text>
    {/each}
    <!-- 밑줄 -->
    <line x1="0" y1={cellSize * 2.7} x2={cellSize * width} y2={cellSize * 2.7} class="rule" />
    <!-- 대각선 교차선들 — 활성 대각선만 강조 -->
    {#each diagPaths as dp (dp.p)}
      {#each dp.lines as ln, idx (idx)}
        <line
          x1={ln.x1}
          y1={ln.y1}
          x2={ln.x2}
          y2={ln.y2}
          class="diag"
          class:diag--active={activeDiagonal === dp.p}
        />
      {/each}
    {/each}
    <!-- 답 행(오른쪽부터 한 자리씩) -->
    {#each String(layout.product).split('') as dgt, i (i)}
      {@const place = ansLen - 1 - i}
      <text x={xOf(place, width)} y={yOf('ans')} class="digit digit--ans">{dgt}</text>
    {/each}
  </svg>
</div>

<style>
  .xmult {
    overflow-x: auto;
  }
  .xmult-svg {
    width: 100%;
    max-width: 22rem;
    height: auto;
    font-family: var(--font-numeric);
    font-variant-numeric: tabular-nums;
  }
  :global(.xmult-svg .digit) {
    font-size: 1.5rem;
    font-weight: 800;
    text-anchor: middle;
    dominant-baseline: middle;
    fill: var(--house-bright);
  }
  :global(.xmult-svg .digit--a),
  :global(.xmult-svg .digit--b) {
    fill: var(--house-bright);
  }
  :global(.xmult-svg .digit--ans) {
    fill: var(--spotlight);
    filter: drop-shadow(0 0 4px var(--spotlight-glow));
  }
  :global(.xmult-svg .sign) {
    font-size: 1.3rem;
    font-weight: 700;
    fill: var(--house-light);
    dominant-baseline: middle;
  }
  :global(.xmult-svg .rule) {
    stroke: var(--house-bright);
    stroke-width: 3;
  }
  :global(.xmult-svg .diag) {
    stroke: var(--spotlight);
    stroke-width: 1.5;
    opacity: 0.25;
    transition: opacity var(--motion-base) ease;
  }
  :global(.xmult-svg .diag--active) {
    opacity: 1;
    stroke-width: 3;
    stroke: var(--spotlight);
    filter: drop-shadow(0 0 6px var(--spotlight-glow));
  }
  @media (prefers-reduced-motion: reduce) {
    :global(.xmult-svg .diag) {
      transition-duration: 0.01ms;
    }
  }
</style>
