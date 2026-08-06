<!--
  canvas-ui Ripple — Svelte wrapper.
  Wraps live HTML content with a WebGL ripple/water-wave effect.
  Falls back to plain HTML when html-in-canvas API or WebGL2 is unavailable.

  Source: https://github.com/DavidHDev/canvas-ui (MIT + Commons Clause)
  Adapted for Svelte 5 runes.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { createRipple, type RippleInstance, type RippleOptions } from './RippleVanilla.js';

  interface Props {
    options?: RippleOptions;
    /** CSS class for the inner content wrapper. */
    class?: string;
    children: import('svelte').Snippet;
  }

  const { options = {}, class: className = '', children }: Props = $props();

  let container: HTMLDivElement;
  let contentEl: HTMLDivElement;
  let sourceCanvas: HTMLCanvasElement;
  let outputCanvas: HTMLCanvasElement;
  let instance: RippleInstance | null = null;

  onMount(() => {
    instance = createRipple(
      { source: sourceCanvas, content: contentEl, output: outputCanvas },
      options
    );
    // container is the wrapper element (used by bind:this in template)
    container.dataset.cuReady = 'true';
    return () => {
      instance?.destroy();
      instance = null;
    };
  });

  // Live option updates.
  $effect(() => {
    instance?.setOptions(options);
  });
</script>

<div class="cu-ripple {className}" bind:this={container}>
  <div class="cu-content" bind:this={contentEl}>
    {@render children()}
  </div>
  <!-- Hidden source canvas for html-in-canvas capture -->
  <canvas class="cu-source" bind:this={sourceCanvas} aria-hidden="true"></canvas>
  <!-- Visible output canvas overlay -->
  <canvas class="cu-output" bind:this={outputCanvas} aria-hidden="true"></canvas>
</div>

<style>
  .cu-ripple {
    position: relative;
    display: block;
  }
  .cu-content {
    /* Content stays interactive; canvas overlays on top */
    position: relative;
    z-index: 0;
  }
  .cu-source {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    pointer-events: none;
    z-index: 1;
  }
  .cu-output {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 2;
  }
</style>
