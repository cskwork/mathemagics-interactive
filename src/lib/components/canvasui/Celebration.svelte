
<!--
  Celebration — lightweight canvas confetti/particle burst system.
  Fires when `fire()` is called. Respects prefers-reduced-motion (no animation).
  Zero dependencies — pure Canvas2D with requestAnimationFrame.
-->
<script lang="ts">
  import { onMount } from 'svelte';

  type Particle = {
    x: number; y: number; vx: number; vy: number;
    rotation: number; rotationSpeed: number;
    color: string; size: number; shape: 'rect' | 'circle' | 'star';
    life: number; maxLife: number;
  };

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let particles: Particle[] = [];
  let rafId: number | undefined;
  let reduceMotion = false;

  const COLORS = [
    '#e89400', '#ffaa1c', '#2a9b4a', '#5fdb89',
    '#d63838', '#ff6b6b', '#9b59b6', '#3498db',
    '#f1c40f', '#e74c3c'
  ];

  onMount(() => {
    ctx = canvas.getContext('2d');
    reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (rafId !== undefined) cancelAnimationFrame(rafId);
    };
  });

  function resize(): void {
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx?.scale(window.devicePixelRatio, window.devicePixelRatio);
  }

  function spawnBurst(x: number, y: number, count: number, spread: number): void {
    if (reduceMotion) return;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 3 + Math.random() * spread;
      const shape: Particle['shape'] = Math.random() > 0.6 ? 'star' : Math.random() > 0.5 ? 'circle' : 'rect';
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.3,
        color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
        size: 4 + Math.random() * 6,
        shape,
        life: 0,
        maxLife: 60 + Math.random() * 40,
      });
    }
    if (rafId === undefined) animate();
  }

  function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      const px = x + Math.cos(angle) * size;
      const py = y + Math.sin(angle) * size;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      const innerAngle = angle + Math.PI / 5;
      ctx.lineTo(x + Math.cos(innerAngle) * size * 0.4, y + Math.sin(innerAngle) * size * 0.4);
    }
    ctx.closePath();
    ctx.fill();
  }

  function animate(): void {
    if (!ctx || !canvas) { rafId = undefined; return; }
    const w = canvas.width / window.devicePixelRatio;
    const h = canvas.height / window.devicePixelRatio;
    ctx.clearRect(0, 0, w, h);

    particles = particles.filter((p) => {
      p.life++;
      if (p.life >= p.maxLife) return false;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15; // gravity
      p.vx *= 0.99;
      p.rotation += p.rotationSpeed;

      const alpha = 1 - p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;

      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      } else if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        drawStar(ctx, 0, 0, p.size / 2);
      }
      ctx.restore();
      return true;
    });

    if (particles.length > 0) {
      rafId = requestAnimationFrame(animate);
    } else {
      ctx.clearRect(0, 0, w, h);
      rafId = undefined;
    }
  }

  /** Fire a burst of confetti from a point (relative to parent). */
  export function fire(x?: number, y?: number, count = 24): void {
    const parent = canvas?.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const fx = x ?? rect.width / 2;
    const fy = y ?? rect.height / 2;
    spawnBurst(fx, fy, count, 6);
  }

  /** Fire from the top of the parent — like a celebration cannon. */
  export function rain(count = 40): void {
    if (reduceMotion || !canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    for (let i = 0; i < count; i++) {
      const x = Math.random() * rect.width;
      const angle = Math.PI / 2 + (Math.random() - 0.5) * 0.6;
      const speed = 1 + Math.random() * 3;
      const shape: Particle['shape'] = Math.random() > 0.6 ? 'star' : Math.random() > 0.5 ? 'circle' : 'rect';
      particles.push({
        x, y: -10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.3,
        color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
        size: 4 + Math.random() * 6,
        shape,
        life: 0,
        maxLife: 80 + Math.random() * 60,
      });
    }
    if (rafId === undefined) animate();
  }
</script>

<canvas class="celebration-canvas" bind:this={canvas} aria-hidden="true"></canvas>

<style>
  .celebration-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 100;
  }
</style>
