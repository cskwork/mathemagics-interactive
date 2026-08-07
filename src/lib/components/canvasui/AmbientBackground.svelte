<!--
  AmbientBackground — subtle floating particle background for the main stage.
  Creates a magical atmosphere with slow-moving glowing dots.
  Zero dependencies — pure Canvas2D. Respects prefers-reduced-motion.
-->
<script lang="ts">
  import { onMount } from 'svelte';

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let rafId: number | undefined;
  let particles: { x: number; y: number; vx: number; vy: number; size: number; alpha: number; phase: number }[] = [];
  let reduceMotion = false;
  let mounted = false;

  onMount(() => {
    ctx = canvas.getContext('2d');
    reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduceMotion) return;

    mounted = true;
    resize();
    initParticles();
    window.addEventListener('resize', resize);

    if (rafId === undefined) animate();

    return () => {
      mounted = false;
      window.removeEventListener('resize', resize);
      if (rafId !== undefined) cancelAnimationFrame(rafId);
    };
  });

  function resize(): void {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function initParticles(): void {
    particles = [];
    const count = Math.min(30, Math.floor((window.innerWidth * window.innerHeight) / 25000));
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        size: 1 + Math.random() * 2.5,
        alpha: 0.1 + Math.random() * 0.25,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  function animate(): void {
    if (!ctx || !mounted) { rafId = undefined; return; }
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.phase += 0.01;

      // Wrap around screen edges
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10;
      if (p.y > h + 10) p.y = -10;

      // Pulsing opacity
      const pulseAlpha = p.alpha * (0.5 + 0.5 * Math.sin(p.phase));
      const glowSize = p.size * (1 + 0.3 * Math.sin(p.phase));

      // Draw glowing dot
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowSize * 4);
      grad.addColorStop(0, `rgba(255, 184, 56, ${pulseAlpha})`);
      grad.addColorStop(0.5, `rgba(255, 184, 56, ${pulseAlpha * 0.3})`);
      grad.addColorStop(1, 'rgba(255, 184, 56, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, glowSize * 4, 0, Math.PI * 2);
      ctx.fill();

      // Bright core
      ctx.fillStyle = `rgba(255, 220, 130, ${pulseAlpha * 0.8})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, glowSize, 0, Math.PI * 2);
      ctx.fill();
    }

    rafId = requestAnimationFrame(animate);
  }
</script>

<canvas class="ambient-bg" bind:this={canvas} aria-hidden="true"></canvas>

<style>
  .ambient-bg {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 0;
    opacity: 0.6;
  }
</style>