<!--
  Hallmark · P3 H4 E4 S3 R4 V3 — X-다이어그램: 제곱의 ±d 분기 도식 (docs/briefs/M4.md 산출물 2).
  book-content-map §2-3/§3-5/§4-1. A²=(A+d)(A−d)+d² 의 위/아래 분기를 SVG 로 그린다.
  **재귀 중첩**: 3자리 제곱에서 d² 가 다시 2자리 제곱이면 내부에 축소 다이어그램이 들어간다.
  색/폰트는 전부 M7 토큰. reduced-motion 시 전환 즉시.
-->
<script lang="ts">
  import { m } from '../lib/paraglide/messages.js';
  import { squareDiagram } from '../lib/engine/derive-mul.js';
  import type { SquareDiagram } from '../lib/engine/types.js';

  interface Props {
    base: number;
    /** 진행 단계(0..N). 미지정 시 전체 표시. */
    step?: number;
  }
  const { base, step = 99 }: Props = $props();

  const diag = $derived(squareDiagram(base));

  /** 렌더용 평탄 노드 — depth(중첩 깊이) + 단계별 공개 플래그. */
  interface RenderNode {
    diag: SquareDiagram;
    depth: number;
    showHigh: boolean;
    showLow: boolean;
    showProduct: boolean;
    showDSquared: boolean;
    showAnswer: boolean;
  }

  /** 다이어그램(및 재귀 내부)을 렌더용 평탄 노드 목록으로. */
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
      <svg class="x-svg" viewBox="0 0 320 150" aria-hidden="true">
        <text x="160" y="22" class="x-base">{node.diag.base}²</text>
        {#if node.showHigh}
          <line x1="160" y1="30" x2="70" y2="70" class="branch-line" />
          <text x="40" y="78" class="branch-val">{node.diag.high}</text>
          <text x="55" y="52" class="branch-label">+{node.diag.d}</text>
        {/if}
        {#if node.showLow}
          <line x1="160" y1="30" x2="250" y2="70" class="branch-line" />
          <text x="270" y="78" class="branch-val">{node.diag.low}</text>
          <text x="245" y="52" class="branch-label">−{node.diag.d}</text>
        {/if}
        {#if node.showProduct}
          <line x1="70" y1="85" x2="160" y2="120" class="merge-line" />
          <line x1="250" y1="85" x2="160" y2="120" class="merge-line" />
          <text x="120" y="110" class="product-val">{node.diag.high}×{node.diag.low}</text>
          <text x="160" y="140" class="result-val">= {node.diag.product}</text>
        {/if}
      </svg>
      {#if node.showDSquared}
        <p class="dsq">
          + {node.diag.d}² = {node.diag.dSquared}
          {#if node.diag.nested}<span class="muted small"> ({m.xdiagram_reuse()})</span>{/if}
        </p>
      {/if}
      {#if node.showAnswer}
        <p class="x-answer">{node.diag.product} + {node.diag.dSquared} = <strong>{node.diag.answer}</strong></p>
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
    max-width: 18rem;
    height: auto;
  }
  .x-svg text {
    fill: var(--house-bright);
    font-family: var(--font-numeric);
    font-variant-numeric: tabular-nums;
  }
  .x-base {
    font-size: 15px;
    font-weight: 800;
    fill: var(--spotlight);
    text-anchor: middle;
  }
  .branch-val {
    font-size: 13px;
    font-weight: 700;
    text-anchor: middle;
  }
  .branch-label {
    font-size: 10px;
    fill: var(--spotlight);
    text-anchor: middle;
  }
  .branch-line,
  .merge-line {
    stroke: var(--stage-line);
    stroke-width: 1.5;
    fill: none;
  }
  .product-val {
    font-size: 11px;
    fill: var(--house-light);
    text-anchor: middle;
  }
  .result-val {
    font-size: 14px;
    font-weight: 800;
    fill: var(--applause);
    text-anchor: middle;
  }
  .dsq {
    font-size: var(--text-small);
    color: var(--house-bright);
    margin: 0;
  }
  .x-answer {
    font-size: 1.05rem;
    color: var(--house-bright);
    margin: 0;
  }
  .x-answer strong {
    color: var(--spotlight);
  }
  .muted {
    color: var(--house-light);
  }
  .small {
    font-size: var(--text-small);
  }
  @media (prefers-reduced-motion: reduce) {
    .xdiag-node {
      transition: none;
    }
  }
</style>
