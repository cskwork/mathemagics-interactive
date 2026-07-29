<!--
  Hallmark · P3 H4 E4 S3 R4 V3 — 누계 롤링 카운터 (docs/briefs/M4.md 산출물 4).
  부분곱 + running total 을 세로 나열. 누계 숫자가 number-roll 전환으로 갱신.
  partialProducts(순수 함수) 결과를 소비. 색/폰트 전부 M7 토큰.
-->
<script lang="ts">
  import { m } from '../lib/paraglide/messages.js';
  import type { PartialProduct } from '../lib/engine/types.js';

  interface Props {
    parts: readonly PartialProduct[];
    /** 진행 단계(0..parts.length). 미지정 시 전체. */
    step?: number;
  }
  const { parts, step = 99 }: Props = $props();

  const shown = $derived(Math.min(step, parts.length));
  const finalTotal = $derived(parts.length > 0 ? parts[parts.length - 1]!.runningTotal : 0);
</script>

<div class="roller" role="img" aria-label={m.roller_label()}>
  {#each parts.slice(0, shown) as p, i (i)}
    <div class="pp-row">
      <span class="pp-expr">{p.factor} × {p.unit}</span>
      <span class="pp-sign pp-sign--{p.sign}">{p.sign}</span>
      <span class="pp-product">{p.product}</span>
    </div>
    <div class="total-row" aria-live="polite">
      <span class="total-label">{m.roller_total()}</span>
      {#key p.runningTotal}
        <span class="total-val roll">{p.runningTotal}</span>
      {/key}
    </div>
  {/each}
  {#if shown >= parts.length && parts.length > 0}
    <p class="final">{m.roller_final({ n: finalTotal })}</p>
  {/if}
</div>

<style>
  .roller {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-family: var(--font-numeric);
    font-variant-numeric: tabular-nums;
    min-width: 11rem;
  }
  .pp-row {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: var(--space-2);
    align-items: baseline;
    color: var(--house-light);
    font-size: var(--text-body);
  }
  .pp-expr {
    text-align: right;
  }
  .pp-sign {
    font-weight: 800;
  }
  .pp-sign--plus {
    color: var(--applause);
  }
  .pp-sign--minus {
    color: var(--miss);
  }
  .pp-product {
    text-align: left;
    color: var(--house-bright);
    font-weight: 600;
  }
  .total-row {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    align-items: baseline;
    padding: 0.2rem 0.5rem;
    background: var(--spotlight-wash);
    border-radius: var(--radius);
    border: 1px solid color-mix(in srgb, var(--spotlight) 38%, var(--stage-line));
  }
  .total-label {
    font-size: var(--text-small);
    color: var(--house-light);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .total-val {
    font-size: 1.3rem;
    font-weight: 800;
    color: var(--spotlight);
  }
  .roll {
    animation: num-roll var(--motion-base) var(--ease-stage);
  }
  .final {
    margin: var(--space-2) 0 0;
    text-align: center;
    font-weight: 800;
    color: var(--applause);
    font-size: 1.2rem;
  }
  @keyframes num-roll {
    from {
      opacity: 0;
      transform: translateY(-0.4em);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .roll {
      animation: none;
    }
  }
</style>
