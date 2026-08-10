<!--
  RuleCard — displays the technique rule with elegant visual treatment.
  Shows as a highlighted teaching card with an icon, the rule text, and
  a subtle animated spotlight background.
-->
<script lang="ts">
  import Icon from './Icon.svelte';

  interface Props {
    rule: string;
    title?: string;
  }
  let { rule, title }: Props = $props();
</script>

<div class="rule-card" role="note">
  <div class="rule-glow" aria-hidden="true"></div>
  <div class="rule-body">
    <span class="rule-icon" aria-hidden="true"><Icon name="sparkle" /></span>
    {#if title}
      <span class="rule-title">{title}</span>
    {/if}
    <p class="rule-text">{rule}</p>
  </div>
</div>

<style>
  .rule-card {
    position: relative;
    overflow: hidden;
    border-radius: var(--radius-lg);
    background: linear-gradient(135deg,
      color-mix(in srgb, var(--spotlight) 10%, var(--stage-mid)) 0%,
      var(--stage-mid) 100%);
    border: 1px solid color-mix(in srgb, var(--spotlight) 25%, var(--stage-line));
    box-shadow: var(--shadow-card), 0 0 24px var(--spotlight-wash);
  }
  .rule-glow {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 15% 50%, var(--spotlight-wash-strong) 0%, transparent 50%);
    pointer-events: none;
    opacity: 0.6;
  }
  .rule-body {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-4) var(--space-5);
  }
  .rule-icon {
    font-size: 1.5rem;
    color: var(--spotlight);
  }
  .rule-title {
    font-size: var(--text-caption);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
    color: var(--spotlight);
  }
  .rule-text {
    font-size: var(--text-lead);
    font-weight: 600;
    color: var(--house-bright);
    line-height: 1.4;
  }
</style>
