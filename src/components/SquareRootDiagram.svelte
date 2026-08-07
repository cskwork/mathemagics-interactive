<!--
  Hallmark · P4 H4 E4 S4 R4 V4 — 지필 제곱근 다이어그램 (M5 산출물 2).
  근호 아래 수를 두 자리씩 그룹핑하고 자리별 추정을 표시(book-content-map §6-4 / §4-3).
-->
<script lang="ts">
  import { m } from '../lib/paraglide/messages.js';
  import type { SquareRootLayout } from '../lib/engine/types.js';

  interface Props {
    layout: SquareRootLayout;
    activeStep?: number | undefined;
  }
  const { layout, activeStep }: Props = $props();

  // 그룹 문자열(첫 그룹은 그대로, 나머지는 두 자리 패딩).
  const groupStrs = $derived(
    layout.groups.map((g, i) => (i === 0 ? String(g) : String(g).padStart(2, '0')))
  );
</script>

<div class="sqrt" role="img" aria-label={m.sqrt_label({ n: layout.radicand })}>
  <div class="sqrt-frame">
    <span class="sqrt-root" aria-hidden="true">{layout.root}</span>
    <span class="sqrt-radical" aria-hidden="true">√</span>
    <span class="sqrt-groups">
      {#each groupStrs as gs (gs)}
        <span class="sqrt-group" class:group--active={activeStep !== undefined}>{gs}</span>
      {/each}
    </span>
  </div>
  <ol class="sqrt-steps">
    {#each layout.steps as st, i (i)}
      <li class="sqrt-step" class:step--active={activeStep === i}>
        {#if i === 0}
          <span class="step-note">√{st.broughtDown} → {st.digit}²={st.product}, {m.math_remainder()} {st.remainder}</span>
        {:else}
          <span class="step-note"
            >{st.trialBase}_×_ {m.math_match()} → {st.digit} ({st.trialBase}{st.digit}×{st.digit}={st.product}), {m.math_remainder()}
            {st.remainder}</span
          >
        {/if}
      </li>
    {/each}
  </ol>
</div>

<style>
  .sqrt {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    font-family: var(--font-numeric);
    font-variant-numeric: tabular-nums;
  }
  .sqrt-frame {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-size: 2rem;
    font-weight: 800;
  }
  .sqrt-root {
    color: var(--spotlight);
    margin-right: var(--space-1);
    text-shadow: 0 0 8px var(--spotlight-glow);
  }
  .sqrt-radical {
    color: var(--house-bright);
    font-size: 2.4rem;
    line-height: 1;
  }
  .sqrt-groups {
    display: inline-flex;
    border-top: 3px solid var(--house-bright);
    padding-top: 2px;
  }
  .sqrt-group {
    color: var(--house-bright);
    padding: 0 2px;
  }
  .sqrt-group + .sqrt-group {
    border-left: 1px dotted var(--stage-line);
  }
  .group--active {
    color: var(--spotlight);
  }
  .sqrt-steps {
    margin: 0;
    padding-left: 1.2rem;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .sqrt-step {
    font-size: var(--text-body);
    color: var(--house-light);
  }
  .step--active {
    color: var(--spotlight);
    font-weight: 700;
    text-shadow: 0 0 6px var(--spotlight-glow);
  }
  .step-note {
    font-variant-numeric: tabular-nums;
  }
</style>
