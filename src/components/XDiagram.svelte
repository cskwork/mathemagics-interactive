<script lang="ts">
  import { m } from '../lib/paraglide/messages.js';
  import { squareDiagram } from '../lib/engine/derive-mul.js';
  import type { SquareDiagram } from '../lib/engine/types.js';

  interface Props {
    base: number;
    step?: number;
  }
  const { base, step = 99 }: Props = $props();

  const diag = $derived(squareDiagram(base));

  interface RenderNode {
    diag: SquareDiagram;
    depth: number;
    showHigh: boolean;
    showLow: boolean;
    showProduct: boolean;
    showDSquared: boolean;
    showAnswer: boolean;
  }

  function flatten(root: SquareDiagram, st: number, depth: number): RenderNode[] {
    const out: RenderNode[] = [
      {
        diag: root,
        depth,
        showHigh: st >= 1,
        showLow: st >= 2,
        showProduct: st >= 3,
        showDSquared: st >= 4,
        showAnswer: st >= 5
      }
    ];
    if (root.nested && st >= 4) {
      out.push(...flatten(root.nested, st >= 6 ? 99 : st - 4, depth + 1));
    }
    return out;
  }

  const nodes = $derived(flatten(diag, step, 0));
</script>

<div class="xdiag" role="img" aria-label={m.xdiagram_label({ base })}>
  {#each nodes as node (node.depth)}
    <div class="xdiag-node" style="--depth: {node.depth}">
      {#if node.depth > 0}
        <span class="nest-bracket">{m.xdiagram_nested()}</span>
      {/if}
      <svg class="x-svg" viewBox="0 0 320 170" aria-hidden="true">
        <!-- Glow filter -->
        <defs>
          <filter id="xglow-{node.depth}" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <!-- Base value badge -->
        <rect x="125" y="6" width="70" height="28" rx="8" class="base-badge" filter="url(#xglow-{node.depth})"/>
        <text x="160" y="25" class="x-base">{node.diag.base}²</text>

        {#if node.showHigh}
          <path d="M 160 38 Q 110 55 70 75" class="branch-line branch-line-anim" style="animation-delay: 0.1s"/>
          <rect x="25" y="60" width="56" height="28" rx="8" class="branch-badge-high" filter="url(#xglow-{node.depth})"/>
          <text x="53" y="79" class="branch-val">{node.diag.high}</text>
          <text x="100" y="58" class="branch-label">+{node.diag.d}</text>
        {/if}
        {#if node.showLow}
          <path d="M 160 38 Q 210 55 250 75" class="branch-line branch-line-anim" style="animation-delay: 0.2s"/>
          <rect x="239" y="60" width="56" height="28" rx="8" class="branch-badge-low" filter="url(#xglow-{node.depth})"/>
          <text x="267" y="79" class="branch-val">{node.diag.low}</text>
          <text x="220" y="58" class="branch-label">−{node.diag.d}</text>
        {/if}
        {#if node.showProduct}
          <path d="M 70 92 Q 115 110 150 122" class="merge-line merge-line-anim" style="animation-delay: 0.1s"/>
          <path d="M 267 92 Q 210 110 170 122" class="merge-line merge-line-anim" style="animation-delay: 0.2s"/>
          <rect x="100" y="105" width="120" height="28" rx="8" class="product-badge" filter="url(#xglow-{node.depth})"/>
          <text x="160" y="124" class="product-val">{node.diag.high}×{node.diag.low} = {node.diag.product}</text>
        {/if}
        {#if node.showDSquared}
          <text x="160" y="155" class="dsq-val">+ {node.diag.d}² = {node.diag.dSquared}</text>
        {/if}
      </svg>
      {#if node.showAnswer}
        <p class="x-answer bounce-in">
          {node.diag.product} + {node.diag.dSquared} = <strong>{node.diag.answer}</strong>
        </p>
      {/if}
    </div>
  {/each}
</div>

<style>
  .xdiag {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    align-items: center;
    font-family: var(--font-numeric);
    font-variant-numeric: tabular-nums;
  }
  .xdiag-node {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    transform: scale(calc(1 - var(--depth) * 0.12));
    transform-origin: top center;
    transition: transform var(--motion-base) ease;
  }
  .nest-bracket {
    font-size: var(--text-small);
    color: var(--spotlight);
    font-weight: 700;
  }
  .x-svg {
    width: 100%;
    max-width: 20rem;
    height: auto;
  }
  .x-svg text {
    fill: var(--house-bright);
    font-family: var(--font-numeric);
    font-variant-numeric: tabular-nums;
  }
  .base-badge {
    fill: var(--spotlight-wash-strong);
    stroke: var(--spotlight);
    stroke-width: 1.5;
  }
  .x-base {
    font-size: 16px;
    font-weight: 800;
    fill: var(--spotlight);
    text-anchor: middle;
  }
  .branch-badge-high {
    fill: var(--applause-wash);
    stroke: var(--applause);
    stroke-width: 1.5;
  }
  .branch-badge-low {
    fill: var(--spotlight-wash);
    stroke: var(--spotlight);
    stroke-width: 1.5;
  }
  .branch-val {
    font-size: 14px;
    font-weight: 700;
    fill: var(--house-bright);
    text-anchor: middle;
  }
  .branch-label {
    font-size: 11px;
    fill: var(--spotlight);
    text-anchor: middle;
    font-weight: 700;
  }
  .branch-line, .merge-line {
    stroke: var(--stage-edge);
    stroke-width: 2;
    fill: none;
    stroke-linecap: round;
  }
  .branch-line-anim, .merge-line-anim {
    stroke-dasharray: 200;
    stroke-dashoffset: 200;
    animation: draw-line 0.6s var(--ease-stage) forwards;
  }
  @keyframes draw-line {
    to { stroke-dashoffset: 0; }
  }
  .product-badge {
    fill: color-mix(in srgb, var(--applause) 12%, var(--stage-mid));
    stroke: var(--applause);
    stroke-width: 1.5;
  }
  .product-val {
    font-size: 12px;
    font-weight: 700;
    fill: var(--applause);
    text-anchor: middle;
  }
  .dsq-val {
    font-size: 13px;
    fill: var(--house-bright);
    text-anchor: middle;
    font-weight: 600;
  }
  .x-answer {
    font-size: 1.05rem;
    color: var(--house-bright);
    margin: 0;
  }
  .x-answer strong {
    color: var(--spotlight);
    font-size: 1.25rem;
    text-shadow: 0 0 8px var(--spotlight-glow);
  }
  @media (prefers-reduced-motion: reduce) {
    .xdiag-node { transition: none; }
    .branch-line-anim, .merge-line-anim { animation: none; stroke-dashoffset: 0; }
  }
</style>