
<!--
  ProgressRing — circular SVG progress indicator.
  Animated stroke-dashoffset for smooth fill.
-->
<script lang="ts">
  interface Props {
    /** Progress 0-1 */
    value: number;
    size?: number;
    strokeWidth?: number;
    label?: string;
    sublabel?: string;
    color?: string;
  }
  let { value, size = 120, strokeWidth = 10, label, sublabel, color }: Props = $props();

  const radius = $derived((size - strokeWidth) / 2);
  const circumference = $derived(2 * Math.PI * radius);
  const clampedValue = $derived(Math.max(0, Math.min(1, value)));
  const offset = $derived(circumference * (1 - clampedValue));
  const displayLabel = $derived(label ?? `${Math.round(clampedValue * 100)}%`);
  const ariaLabel = $derived(sublabel ? `${displayLabel}: ${sublabel}` : displayLabel);
</script>

<div class="ring-wrap" role="img" aria-label={ariaLabel} style="width: {size}px; height: {size}px;">
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 {size} {size}">
    <circle
      cx={size / 2}
      cy={size / 2}
      r={radius}
      fill="none"
      stroke="var(--stage-line)"
      stroke-width={strokeWidth}
      opacity="0.5"
    />
    <circle
      class="ring-progress"
      cx={size / 2}
      cy={size / 2}
      r={radius}
      fill="none"
      stroke={color ?? 'var(--spotlight)'}
      stroke-width={strokeWidth}
      stroke-linecap="round"
      stroke-dasharray={circumference}
      stroke-dashoffset={offset}
      transform="rotate(-90 {size / 2} {size / 2})"
    />
  </svg>
  <div class="ring-label">
    <span class="ring-text">{displayLabel}</span>
    {#if sublabel}<span class="ring-sub">{sublabel}</span>{/if}
  </div>
</div>

<style>
  .ring-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .ring-progress {
    transition: stroke-dashoffset var(--dur-long) var(--ease-out);
  }
  .ring-label {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
  }
  .ring-text {
    font-family: var(--font-numeric);
    font-variant-numeric: tabular-nums;
    font-weight: 800;
    font-size: 1.5rem;
    line-height: 1;
    color: var(--house-bright);
  }
  .ring-sub {
    font-size: 0.7rem;
    color: var(--house-light);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  @media (prefers-reduced-motion: reduce) {
    .ring-progress { transition: none; }
  }
</style>
