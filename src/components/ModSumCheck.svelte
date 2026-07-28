<!--
  Hallmark · P4 H4 E4 S4 R4 V4 — 모드섬 검산 다이어그램 (M5 산출물 2).
  각 수의 모드섬을 동그라미로 표시하고 연산 결과 비교(book-content-map §6-2/§6-6 / §4-3).
  9 버리기·11 버리기 두 채널. 통과/불일치를 색 토큰으로(성공=applause, 어김=miss).
-->
<script lang="ts">
  import { m } from '../lib/paraglide/messages.js';
  import type { ModSumResult } from '../lib/engine/types.js';

  interface Props {
    result: ModSumResult;
  }
  const { result }: Props = $props();

  const opSign = $derived(result.op === 'mul' ? '×' : '+');
  const answer = $derived(
    result.op === 'mul'
      ? result.mod9Operands.reduce((p, x, i) => (i === 0 ? x : p * x), 1)
      : result.mod9Operands.reduce((s, x) => s + x, 0)
  );
</script>

<div class="modsum" role="img" aria-label={m.modsum_label()}>
  <p class="ms-line ms--expr">
    {#each result.mod9Operands as mod, i (i)}
      {#if i > 0}<span class="op">{opSign}</span>{/if}
      <span class="circ circ--op">{mod}</span>
    {/each}
    <span class="eq">=</span>
    <span class="circ" class:circ--ok={result.mod9Answer === result.mod9Expected} class:circ--bad={result.mod9Answer !== result.mod9Expected}
      >{result.mod9Answer}</span
    >
    <span class="muted small"> ({m.modsum_answer()}: {answer})</span>
  </p>

  <div class="ms-grid">
    <div class="ms-cell">
      <p class="ms-title">{m.modsum_cast9()}</p>
      <p class="ms-val">
        <span class="circ circ--sm">{result.mod9Expected}</span>
        <span class="muted">vs</span>
        <span class="circ circ--sm">{result.mod9Answer}</span>
      </p>
      <p class="ms-verdict" class:ok={result.mod9Match} class:bad={!result.mod9Match}>
        {result.mod9Match ? '✓ ' + m.modsum_pass() : '✗ ' + m.modsum_fail()}
      </p>
    </div>
    <div class="ms-cell">
      <p class="ms-title">{m.modsum_cast11()}</p>
      <p class="ms-val">
        <span class="circ circ--sm">{result.mod11Expected}</span>
        <span class="muted">vs</span>
        <span class="circ circ--sm">{result.mod11Answer}</span>
      </p>
      <p class="ms-verdict" class:ok={result.mod11Match} class:bad={!result.mod11Match}>
        {result.mod11Match ? '✓' : '✗'}
      </p>
    </div>
  </div>
</div>

<style>
  .modsum {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    font-family: var(--font-numeric);
    font-variant-numeric: tabular-nums;
  }
  .ms--expr {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
    font-size: 1.4rem;
  }
  /* 모드섬 동그라미 표기(§4-3) — 토큰 색으로만. */
  .circ {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 2rem;
    height: 2rem;
    border-radius: var(--radius-pill);
    border: 2px solid var(--spotlight);
    color: var(--spotlight);
    font-weight: 800;
    padding: 0 0.4rem;
  }
  .circ--op {
    background: var(--spotlight-wash);
  }
  .circ--sm {
    min-width: 1.6rem;
    height: 1.6rem;
    font-size: 0.9rem;
    border-width: 1.5px;
  }
  .circ--ok {
    border-color: var(--applause);
    color: var(--applause);
  }
  .circ--bad {
    border-color: var(--miss);
    color: var(--miss);
  }
  .op,
  .eq {
    color: var(--house-light);
    font-weight: 700;
  }
  .ms-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: var(--space-3);
  }
  .ms-cell {
    background: var(--stage-mid);
    border-radius: var(--radius);
    padding: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .ms-title {
    font-size: var(--text-small);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--house-light);
    margin: 0;
    font-weight: 700;
  }
  .ms-val {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
  }
  .ms-verdict {
    margin: 0;
    font-weight: 700;
  }
  .ms-verdict.ok {
    color: var(--applause);
  }
  .ms-verdict.bad {
    color: var(--miss);
  }
  .small {
    font-size: var(--text-small);
  }
</style>
