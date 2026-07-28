<!--
  Hallmark · P3 H4 E4 S3 R4 V3 — 나눗셈 브래킷 (docs/briefs/M4.md 산출물 5).
  SVG 왼쪽 괄호형 레이아웃: 제수 ) 피제수. 몫이 왼쪽부터 한 자리씩 확정(digit-reveal).
  deriveDivisionLayout(순수 함수) 결과를 소비. 색/폰트 전부 M7 토큰.
-->
<script lang="ts">
  import { m } from '../lib/paraglide/messages.js';
  import { deriveDivisionLayout } from '../lib/engine/derive-div.js';
  import type { Problem } from '../lib/engine/types.js';

  interface Props {
    problem: Problem;
    /** 진행 단계(0..digits.length). 미지정 시 전체. */
    step?: number;
  }
  const { problem, step = 99 }: Props = $props();

  const layout = $derived(deriveDivisionLayout(problem));
  const shownDigits = $derived(Math.min(step, layout.digits.length));
  const quotientStr = $derived(
    layout.digits
      .slice(0, shownDigits)
      .map((d) => String(d.digit))
      .join('')
  );
</script>

<div class="bracket" role="img" aria-label={m.division_label()}>
  <svg class="br-svg" viewBox="0 0 360 150" aria-hidden="true">
    <!-- 제수 + 왼쪽 괄호 -->
    <text x="10" y="80" class="br-divisor">{layout.divisor}</text>
    <path d="M 40 30 Q 30 30 30 45 L 30 130 Q 30 145 40 145" class="br-bracket-path" />
    <!-- 피제수 -->
    <text x="55" y="80" class="br-dividend">{layout.dividend}</text>
    <!-- 몫(위, 좌→우 digit-reveal) -->
    <text x="55" y="22" class="br-quotient">{quotientStr}</text>
    <!-- 각 자리의 곱·나머지 -->
    {#each layout.digits.slice(0, shownDigits) as dg, i (i)}
      <text x="{55 + i * 16}" y="100" class="br-sub">{dg.product}</text>
    {/each}
  </svg>
  {#if shownDigits >= layout.digits.length}
    <p class="br-answer" aria-live="polite">
      {m.division_answer({
        quotient: layout.quotient,
        remainder: layout.remainder,
        divisor: layout.divisor
      })}
    </p>
  {/if}
</div>

<style>
  .bracket {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }
  .br-svg {
    width: 100%;
    max-width: 22rem;
    height: auto;
  }
  .br-svg text {
    fill: var(--house-bright);
    font-family: var(--font-numeric);
    font-variant-numeric: tabular-nums;
  }
  .br-divisor {
    font-size: 16px;
    font-weight: 800;
    fill: var(--spotlight);
  }
  .br-dividend {
    font-size: 16px;
    font-weight: 700;
  }
  .br-quotient {
    font-size: 17px;
    font-weight: 800;
    fill: var(--applause);
    animation: digit-in var(--motion-base) var(--ease-stage);
  }
  .br-bracket-path {
    stroke: var(--house-bright);
    stroke-width: 2;
    fill: none;
  }
  .br-sub {
    font-size: 11px;
    fill: var(--house-light);
  }
  .br-answer {
    font-size: 1.1rem;
    font-family: var(--font-numeric);
    font-variant-numeric: tabular-nums;
    color: var(--house-bright);
    margin: 0;
  }
  @keyframes digit-in {
    from {
      opacity: 0.3;
    }
    to {
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .br-quotient {
      animation: none;
    }
  }
</style>
