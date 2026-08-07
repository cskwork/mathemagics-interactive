<!--
  PlaceValueStrip — visual decomposition of a number by place value.
  Shows each digit with its place value label and color coding.
  Teaching aid for understanding how mental math works.
-->
<script lang="ts">
  interface Props {
    /** The number to decompose */
    value: number;
    /** Highlight a specific place (0=ones, 1=tens, 2=hundreds, ...) */
    highlight?: number;
    /** Show multiplication form (e.g., 300 + 40 + 5) */
    showExpansion?: boolean;
  }
  let { value, highlight = -1, showExpansion = false }: Props = $props();

  const places = $derived.by(() => {
    const digits = String(Math.abs(value)).split('');
    const result: { digit: string; place: number; label: string; value: number }[] = [];
    const labels = ['Ones', 'Tens', 'Hundreds', 'Thousands', 'Ten-thousands'];
    digits.forEach((d, i) => {
      const place = digits.length - 1 - i;
      result.push({
        digit: d,
        place,
        label: labels[place] ?? `10^${place}`,
        value: Number(d) * Math.pow(10, place),
      });
    });
    return result;
  });

  const expansionText = $derived(
    places.map((p) => p.value).filter((v) => v > 0).join(' + ')
  );
</script>

<div class="pv-strip" role="img" aria-label="Place value decomposition of {value}">
  <div class="pv-digits">
    {#each places as p (p.place)}
      <div class="pv-cell" class:highlighted={p.place === highlight}>
        <span class="pv-digit">{p.digit}</span>
        <span class="pv-label">{p.label}</span>
      </div>
    {/each}
  </div>
  {#if showExpansion}
    <div class="pv-expansion">
      {value} = {expansionText}
    </div>
  {/if}
</div>

<style>
  .pv-strip {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    font-family: var(--font-numeric);
    font-variant-numeric: tabular-nums;
  }
  .pv-digits {
    display: flex;
    gap: var(--space-1);
    flex-wrap: wrap;
    justify-content: center;
  }
  .pv-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: var(--space-2) var(--space-3);
    background: var(--stage-mid);
    border: 1px solid var(--stage-line);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-cell);
    min-width: 2.5rem;
    transition: border-color var(--motion-base) ease, box-shadow var(--motion-base) ease;
  }
  .pv-cell.highlighted {
    border-color: var(--spotlight);
    box-shadow: var(--shadow-cell), 0 0 12px var(--spotlight-glow);
    background: var(--spotlight-wash);
  }
  .pv-digit {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--house-bright);
    line-height: 1;
  }
  .pv-cell.highlighted .pv-digit {
    color: var(--spotlight);
  }
  .pv-label {
    font-size: 0.65rem;
    color: var(--house-light);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    font-weight: 600;
  }
  .pv-expansion {
    font-size: var(--text-small);
    color: var(--house-light);
    padding: var(--space-1) var(--space-3);
    background: var(--stage-floor);
    border-radius: var(--radius-sm);
  }
  @media (prefers-reduced-motion: reduce) {
    .pv-cell { transition: none; }
  }
</style>