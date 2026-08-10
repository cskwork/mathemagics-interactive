<script lang="ts">
  /**
   * Hallmark · P4 H4 E4 S4 R4 V4 — 세로셈 그리드 렌더러 (리서치 vertical-notation-editors.md §1.3).
   *
   * 자릿수 1개 = 그리드 셀 1개. `font-variant-numeric: tabular-nums` 로 숫자 폭을 통일한다.
   * 행(위→아래): carry(받아올림, 위첨자 크기) · op1 · op2(부호+밑줄) · answer(답).
   *
   * 셀의 값·상태는 부모(StepPlayer / DigitInput)가 `cells` prop 으로 주입한다 —
   * 이 컴포넌트는 순수 렌더러(상태 없음). 셀 상태: idle/highlight/filled/correct/wrong.
   * 받아내림 취소선은 `struck` 플래그로 대각선을 긋는다(rtl 뺄셈).
   *
   * 접근성: 각 셀에 자릿값 기반 `aria-label`("십의 자리, 7"). 부호 셀은 연산 이름.
   * DOM 소스 순서는 위→아래/좌→우(시각 순서 = 읽기 순서). 단계별 낭독은 별도 aria-live 영역.
   */
  import { m } from '../lib/paraglide/messages.js';
  import { activeLocale } from '../lib/i18n/locale.svelte.js';
  import { resolveLocalized } from '../lib/content/localized.js';
  import { cellAriaLabel } from '../lib/engine/aria.js';
  import type { CellState, ColId, Grid, Op, RowId } from '../lib/engine/types.js';

  export interface CellRender {
    value?: string;
    state?: CellState;
    /** 받아내림 취소선(rtl 뺄셈). */
    struck?: boolean;
  }

  interface Props {
    grid: Grid;
    /** 셀별 동적 표현(값·상태·취소선). 키 = `"row.col"`. 없으면 정적 그리드 값/상태 사용. */
    cells?: Map<string, CellRender>;
    /** 현재 입력/포커스 셀(직접 입력 모드). 없으면 undefined. */
    activeCell?: string | undefined;
  }
  const { grid, cells, activeCell }: Props = $props();

  const op = $derived.by<Op>(() => {
    const sign = grid.rows.find((row) => row.id === 'op2')?.cells['c1'];
    if (sign === '−') return 'sub';
    if (sign === '×') return 'mul';
    if (sign === '÷') return 'div';
    if (sign === '≈') return 'est';
    if (sign === '√') return 'sqrt';
    return 'add';
  });

  function rowStaticCells(rowId: RowId): Partial<Record<ColId, string>> {
    return grid.rows.find((r) => r.id === rowId)?.cells ?? {};
  }

  function renderOf(rowId: RowId, col: ColId): CellRender {
    const dyn = cells?.get(`${rowId}.${col}`);
    if (dyn) return dyn;
    const staticVal = rowStaticCells(rowId)[col];
    return staticVal !== undefined ? { value: staticVal, state: 'filled' } : {};
  }

  function displayValue(rowId: RowId, col: ColId): string {
    return renderOf(rowId, col).value ?? rowStaticCells(rowId)[col] ?? '';
  }

  function cellClass(rowId: RowId, col: ColId): string {
    const r = renderOf(rowId, col);
    const isActive = activeCell === `${rowId}.${col}`;
    const parts = ['cell', `cell--${rowId}`];
    parts.push(`cell--${r.state ?? (displayValue(rowId, col) ? 'filled' : 'idle')}`);
    if (r.struck) parts.push('cell--struck');
    if (isActive) parts.push('cell--active');
    return parts.join(' ');
  }

  function label(rowId: RowId, col: ColId): string {
    const place = grid.placeValueOf[col] ?? -1;
    return cellAriaLabel(rowId, place, displayValue(rowId, col), op);
  }
</script>

<div
  class="colgrid"
  role="grid"
  aria-label={m.playground_problem()}
  style={`grid-template-columns: minmax(var(--cell-size), max-content) repeat(${Math.max(0, grid.cols.length - 1)}, var(--cell-size));`}
>
  {#each grid.rows as row (row.id)}
    <!-- role="row" + display:contents — ARIA grid 구조(grid>row>gridcell)를 갖추되
         레이아웃은 기존과 동일하게 셀이 .colgrid 의 CSS grid 에 직접 참여한다.
         없으면 gridcell 이 row 부모를 가져 aria-required-parent/children 위반(M7 검증 실측). -->
    <div
      class="gridrow"
      role="row"
      aria-label={row.label ? resolveLocalized(row.label, activeLocale()) : undefined}
    >
      {#each grid.cols as col (col)}
        {@const place = grid.placeValueOf[col] ?? -1}
        <div
          class="{cellClass(row.id, col)} {row.underline ? 'cell--underlined' : ''}"
          role="gridcell"
          data-row={row.id}
          data-col={col}
          data-place={place}
          aria-label={label(row.id, col)}
        >
          {#if col === grid.cols[0] && row.label}
            <span class="row-label">{resolveLocalized(row.label, activeLocale())}</span>
          {:else}
            <span class="cell-value">{displayValue(row.id, col)}</span>
          {/if}
        </div>
      {/each}
    </div>
  {/each}
</div>

<style>
  .colgrid {
    display: grid;
    gap: 0;
    --cell-size: clamp(2rem, 11vw, 2.75rem);
    font-family: var(--font-numeric);
    font-variant-numeric: tabular-nums;
    font-feature-settings: 'tnum' 1;
    justify-content: start;
    max-width: 100%;
    overflow-x: auto;
  }

  /* ARIA row 래퍼 — 박스는 만들지 않고 자식(셀)이 부모 grid 에 직접 참여(display:contents). */
  .gridrow {
    display: contents;
  }

  /* Hallmark · P4 H4 E4 S4 R4 V4 — "무대 위 카드" 숫자판.
   * 셀 = 조명을 받은 카드 한 장: 양각(inset highlight) + 미세 그림자로 깊이. */
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
    transition:
      background-color var(--motion-base) ease,
      color var(--motion-base) ease,
      box-shadow var(--motion-base) ease,
      transform var(--motion-base) ease;
  }

  /* carry 행: 위첨자 크기로 받아올림 숫자 표시 */
  .cell--carry {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--spotlight);
    height: calc(var(--cell-size) * 0.7);
    box-shadow: none;
  }

  .cell--answer {
    color: var(--spotlight);
  }

  .cell--quotient,
  .cell--remainder {
    color: var(--spotlight);
  }

  .row-label {
    font-family: var(--font-sans);
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--house-muted);
    white-space: nowrap;
  }

  /* op2 행 아래 밑줄 */
  .cell--underlined {
    border-bottom: 3px solid var(--house-bright);
  }

  .cell--idle {
    color: transparent;
  }

  .cell--filled {
    color: var(--house-bright);
  }

  .cell--highlight {
    background: var(--spotlight-wash-strong);
    color: var(--house-bright);
    box-shadow: inset 0 0 0 2px var(--spotlight), var(--shadow-cell), 0 0 12px var(--spotlight-glow);
  }

  .cell--correct {
    background: var(--applause-wash);
    color: var(--applause);
    box-shadow: inset 0 0 0 2px var(--applause), var(--shadow-cell), 0 0 16px var(--applause-wash);
    /* 마이크로인터랙션 card-settle — 정답 카드가 무대에 내려앉는 미세 바운스 */
    animation: card-settle var(--motion-base) var(--ease-stage);
  }

  .cell--wrong {
    background: var(--miss-wash);
    color: var(--miss);
    box-shadow: inset 0 0 0 2px var(--miss), var(--shadow-cell);
    animation: shake 0.32s ease;
  }

  .cell--active {
    box-shadow: inset 0 0 0 3px var(--spotlight), var(--shadow-cell), 0 0 16px var(--spotlight-glow);
    background: var(--spotlight-wash);
  }

  /* 받아내림 취소선: 손으로 긋는 사선 느낌(리서치 §1.3) */
  .cell--struck .cell-value {
    position: relative;
  }
  .cell--struck .cell-value::after {
    content: '';
    position: absolute;
    left: -10%;
    top: 50%;
    width: 120%;
    height: 2px;
    background: var(--miss);
    transform: rotate(-32deg);
  }

  @keyframes shake {
    0%,
    100% {
      transform: translateX(0);
    }
    25% {
      transform: translateX(-4px);
    }
    75% {
      transform: translateX(4px);
    }
  }

  /* card-settle / spotlight-sweep 키프레임은 전역(app.css)에 정의. */

  @media (prefers-reduced-motion: reduce) {
    .cell {
      transition-duration: 0.01ms;
    }
    .cell--wrong,
    .cell--correct,
    .cell--highlight,
    .cell--active {
      animation: none;
    }
  }
</style>
