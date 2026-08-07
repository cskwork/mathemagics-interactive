<script lang="ts">
  import { m } from '../lib/paraglide/messages.js';
  import type { PartialProduct } from '../lib/engine/types.js';

  interface Props {
    parts: readonly PartialProduct[];
    step?: number;
  }
  const { parts, step = 99 }: Props = $props();

  const shown = $derived(Math.min(step, parts.length));
  const finalTotal = $derived(parts.length > 0 ? parts[parts.length - 1]!.runningTotal : 0);
</script>

<div class="roller" role="img" aria-label={m.roller_label()}>
  {#each parts.slice(0, shown) as p, i (i)}
    <div class="pp-row bounce-in" style="animation-delay: {i * 0.05}s">
      <span class="pp-expr">{p.factor} × {p.unit}</span>
      <span class="pp-sign pp-sign--{p.sign}">{p.sign}</span>
      <span class="pp-product">= {p.product}</span>
    </div>
    <div class="total-row" aria-live="polite">
      <span class="total-label">{m.roller_total()}</span>
      {#key p.runningTotal}
        <span class="total-val roll">{p.runningTotal}</span>
      {/key}
    </div>
  {/each}
  {#if shown >= parts.length && parts.length > 0}
    <div class="final bounce-in">
      <span class="final-eq">=</span>
      <span class="final-val">{finalTotal}</span>
    </div>
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
    padding: 0.15rem 0;
  }
  .pp-expr {
    text-align: right;
  }
  .pp-sign {
    font-weight: 800;
    font-size: 1.1em;
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
    padding: 0.25rem 0.6rem;
    background: var(--spotlight-wash);
    border-radius: var(--radius);
    border: 1px solid color-mix(in srgb, var(--spotlight) 38%, var(--stage-line));
    box-shadow: var(--shadow-cell);
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
    text-shadow: 0 0 6px var(--spotlight-glow);
  }
  .roll {
    animation: num-roll var(--motion-base) var(--ease-stage);
  }
  .final {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    margin: var(--space-3) 0 0;
    padding: var(--space-2) var(--space-4);
    background: var(--applause-wash);
    border-radius: var(--radius);
    border: 1px solid color-mix(in srgb, var(--applause) 30%, var(--stage-line));
  }
  .final-eq {
    font-size: 1.2rem;
    color: var(--house-light);
  }
  .final-val {
    font-weight: 800;
    color: var(--applause);
    font-size: 1.5rem;
    text-shadow: 0 0 8px var(--applause-wash);
  }
  @keyframes num-roll {
    from {
      opacity: 0;
      transform: translateY(-0.4em) scale(0.9);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .roll, .bounce-in { animation: none; }
  }
</style>