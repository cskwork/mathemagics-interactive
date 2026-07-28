<!--
  Hallmark · P4 H4 E4 S4 R4 V4 — 열 덧셈 그리드 (M5 산출물 2).
  ColumnGrid 의 4-행 고정 모델(carry/op1/op2/answer) 은 N-피연산자 열 덧셈에 맞지 않아
  형제 컴포넌트로 제작(회귀 0). 같은 시각 언어 재사용: tabular-nums · 숫자 카드 깊이 · 토큰.
  book-content-map §6-1 / §4-2(우→좌, 올림 위첨자).
-->
<script lang="ts">
  import { m } from '../lib/paraglide/messages.js';
  import { digitsOf } from '../lib/engine/derive-internals.js';
  import type { ColumnAddLayout } from '../lib/engine/types.js';

  interface Props {
    layout: ColumnAddLayout;
    /** 현재 진행 중인 자리(0=일의 자리) — 해당 열 하이라이트. */
    activePlace?: number | undefined;
  }
  const { layout, activePlace }: Props = $props();

  const digitCols = $derived(Math.max(layout.digitCols, String(layout.sum).length));
  const cols = $derived(Array.from({ length: digitCols }, (_, i) => digitCols - 1 - i)); // 큰 자리부터(좌→우 표시)

  /** addend 를 자릿수 배열로(일의 자리가 인덱스 0). */
  function digs(n: number): number[] {
    const d = digitsOf(n);
    while (d.length < digitCols) d.push(0);
    return d;
  }
  /** 열(place) → 표시용 자리. */
  function placeLabel(place: number): string {
    return place === 0 ? m.place_units() : place === 1 ? m.place_tens() : place === 2 ? m.place_hundreds() : m.place_thousands();
  }
  const carries = $derived(layout.carries);
</script>

<div
  class="cag"
  role="grid"
  aria-label={m.playground_problem()}
  style={`grid-template-columns: repeat(${digitCols}, var(--cell-size));`}
>
  <!-- 올림 행(위첨자)  -->
  {#each cols as place (place)}
    <div class="cell cell--carry" role="gridcell" aria-label={placeLabel(place)}>
      <span class="cell-value">{(carries[place] ?? 0) > 0 ? String(carries[place]) : ''}</span>
    </div>
  {/each}

  <!-- 피연산자 행들  -->
  {#each layout.addends as addend, rowIdx (rowIdx)}
    {#each cols as place (place)}
      {@const d = digs(addend)[place] ?? 0}
      <div
        class="cell cell--addend"
        class:cell--highlight={activePlace === place}
        class:cell--idle={d === 0 && place >= String(addend).length}
        role="gridcell"
        aria-label={`${placeLabel(place)}, ${d}`}
      >
        <span class="cell-value">{d}</span>
      </div>
    {/each}
  {/each}

  <!-- 합 행(밑줄 위)  -->
  {#each cols as place (place)}
    <div class="cell cell--sum cell--underlined" role="gridcell">
      <span class="cell-value"></span>
    </div>
  {/each}
  {#each cols as place (place)}
    {@const d = digs(layout.sum)[place] ?? 0}
    <div
      class="cell cell--sum"
      class:cell--highlight={activePlace === place}
      role="gridcell"
      aria-label={`${placeLabel(place)} 합 ${d}`}
    >
      <span class="cell-value">{d}</span>
    </div>
  {/each}
</div>

<style>
  .cag {
    display: grid;
    gap: 0;
    --cell-size: 2.75rem;
    font-family: var(--font-numeric);
    font-variant-numeric: tabular-nums;
    font-feature-settings: 'tnum' 1;
    justify-content: start;
  }
  .cell {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--cell-size);
    height: var(--cell-size);
    font-size: 1.5rem;
    font-weight: 700;
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-inset), var(--shadow-cell);
    transition: background-color var(--motion-base) ease, color var(--motion-base) ease;
    color: var(--house-bright);
  }
  .cell--carry {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--spotlight);
    height: calc(var(--cell-size) * 0.7);
    box-shadow: none;
  }
  .cell--addend {
    color: var(--house-bright);
  }
  .cell--idle {
    color: transparent;
  }
  .cell--sum {
    color: var(--spotlight);
  }
  .cell--underlined {
    border-bottom: 3px solid var(--house-bright);
    height: 0;
    box-shadow: none;
    overflow: visible;
  }
  .cell--underlined .cell-value {
    display: none;
  }
  .cell--highlight {
    background: var(--spotlight-wash-strong);
    box-shadow: inset 0 0 0 2px var(--spotlight), var(--shadow-cell);
  }
  @media (prefers-reduced-motion: reduce) {
    .cell {
      transition-duration: 0.01ms;
    }
  }
</style>
