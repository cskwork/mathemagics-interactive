<!--
  Hallmark · P3 H4 E4 S3 R4 V3 — 치환 체인 (docs/briefs/M4.md 산출물 3).
  `759+496 → +500 → 1259 → −4 → 1255` 화살표 애니메이션. 곱셈 반올림 보정에도 재사용.
  branch 스텝 시퀀스를 받아 화살표로 이어 그린다. 색/폰트 전부 M7 토큰.
-->
<script lang="ts">
  import { activeLocale } from '../lib/i18n/locale.svelte.js';
  import { resolveLocalized } from '../lib/content/localized.js';
  import { m } from '../lib/paraglide/messages.js';

  /** 치환 한 단계: from → to (label 부착). */
  export interface ChainSegment {
    from: number | string;
    to: number | string;
    label?: string;
    narration?: { ko: string; en?: string };
  }

  interface Props {
    segments: readonly ChainSegment[];
    /** 진행 단계(0..segments). 미지정 시 전체. */
    step?: number;
  }
  const { segments, step = 99 }: Props = $props();

  const shown = $derived(Math.min(step, segments.length));
</script>

<div class="chain" role="img" aria-label={m.chain_label()}>
  {#each segments.slice(0, shown) as seg, i (i)}
    {#if i > 0}<span class="arrow" aria-hidden="true">→</span>{/if}
    <span class="seg">
      <span class="seg-val">{seg.from}</span>
      {#if seg.label}<span class="seg-label">{seg.label}</span>{/if}
      <span class="arrow" aria-hidden="true">→</span>
      <span class="seg-val to">{seg.to}</span>
    </span>
  {/each}
</div>
{#if shown > 0 && segments[shown - 1]?.narration}
  <p class="chain-narr" aria-live="polite">
    {resolveLocalized(segments[shown - 1]!.narration!, activeLocale())}
  </p>
{/if}

<style>
  .chain {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    font-family: var(--font-numeric);
    font-variant-numeric: tabular-nums;
    font-size: 1.15rem;
  }
  .arrow {
    color: var(--spotlight);
    font-weight: 800;
  }
  .seg {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.25rem 0.6rem;
    background: var(--stage-floor);
    border: 1px solid var(--stage-line);
    border-radius: var(--radius);
    animation: chain-in var(--motion-base) var(--ease-stage);
  }
  .seg-val {
    color: var(--house-bright);
    font-weight: 700;
  }
  .seg-val.to {
    color: var(--applause);
  }
  .seg-label {
    font-size: var(--text-small);
    color: var(--spotlight);
    font-weight: 800;
  }
  .chain-narr {
    font-size: var(--text-lead);
    color: var(--house-bright);
    border-left: 3px solid var(--spotlight);
    padding: 0.5rem 0.75rem;
    margin: var(--space-2) 0 0;
    background: var(--stage-floor);
    border-radius: var(--radius);
  }
  @keyframes chain-in {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .seg {
      animation: none;
    }
  }
</style>
