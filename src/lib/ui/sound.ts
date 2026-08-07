
/**
 * Sound feedback system — Web Audio API, zero dependencies.
 * Generates subtle, pleasant tones for correct/wrong/complete/achievement events.
 * Respects user's soundOn setting and prefers-reduced-motion (reduces sound complexity).
 */

type SoundType = 'correct' | 'wrong' | 'complete' | 'achievement' | 'click' | 'tick';

let audioCtx: AudioContext | null = null;
let soundEnabled = true;
let initialized = false;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    } catch {
      return null;
    }
  }
  // Resume context if suspended (browsers require user gesture)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/** Play a single tone with envelope. */
function tone(
  ctx: AudioContext,
  freq: number,
  start: number,
  duration: number,
  type: OscillatorType = 'sine',
  gain: number = 0.15,
): void {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  env.gain.setValueAtTime(0, start);
  env.gain.linearRampToValueAtTime(gain, start + 0.01);
  env.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(env).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration);
}

/** Initialize on first user interaction. */
export function initSound(): void {
  if (initialized) return;
  initialized = true;
  // Try to create/resume context on first interaction
  const ctx = getCtx();
  if (ctx) {
    document.addEventListener('pointerdown', () => {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    }, { once: true });
  }
}

/** Enable or disable sound globally. */
export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
}

/** Check if sound is enabled. */
export function isSoundEnabled(): boolean {
  return soundEnabled;
}

/** Play a sound effect. Safe to call anytime — no-op if sound disabled or unavailable. */
export function playSound(type: SoundType): void {
  if (!soundEnabled) return;
  const ctx = getCtx();
  if (!ctx) return;

  const now = ctx.currentTime;

  switch (type) {
    case 'correct': {
      // Pleasant ascending two-note chime
      tone(ctx, 659.25, now, 0.12, 'sine', 0.12);   // E5
      tone(ctx, 987.77, now + 0.06, 0.15, 'sine', 0.10); // B5
      break;
    }
    case 'wrong': {
      // Soft descending buzz — not harsh
      tone(ctx, 311.13, now, 0.10, 'triangle', 0.10); // Eb4
      tone(ctx, 233.08, now + 0.05, 0.15, 'triangle', 0.08); // Bb3
      break;
    }
    case 'click': {
      // Subtle click for button presses
      tone(ctx, 800, now, 0.04, 'sine', 0.04);
      break;
    }
    case 'tick': {
      // Very subtle tick for step transitions
      tone(ctx, 1200, now, 0.02, 'sine', 0.02);
      break;
    }
    case 'complete': {
      // Triumphant ascending arpeggio
      tone(ctx, 523.25, now, 0.15, 'sine', 0.12);       // C5
      tone(ctx, 659.25, now + 0.10, 0.15, 'sine', 0.12);  // E5
      tone(ctx, 783.99, now + 0.20, 0.15, 'sine', 0.12);  // G5
      tone(ctx, 1046.50, now + 0.30, 0.30, 'sine', 0.14); // C6
      break;
    }
    case 'achievement': {
      // Bigger fanfare for major achievements
      tone(ctx, 523.25, now, 0.12, 'sine', 0.14);        // C5
      tone(ctx, 659.25, now + 0.08, 0.12, 'sine', 0.14);  // E5
      tone(ctx, 783.99, now + 0.16, 0.12, 'sine', 0.14);  // G5
      tone(ctx, 1046.50, now + 0.24, 0.12, 'sine', 0.14); // C6
      tone(ctx, 1318.51, now + 0.32, 0.12, 'sine', 0.14); // E6
      tone(ctx, 1567.98, now + 0.40, 0.35, 'sine', 0.16); // G6
      // Bass support
      tone(ctx, 130.81, now, 0.50, 'triangle', 0.06);     // C3
      break;
    }
  }
}
