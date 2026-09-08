/**
 * The magic act, as pure maths. Zero imports on purpose: the browsers available
 * in this environment run pages backgrounded, where requestAnimationFrame is
 * suspended and the scene never advances a frame, so the choreography is
 * verified by running this module directly under node instead.
 *
 *   I   THE REVEAL  the wand rises across frame, dust gathers, a stone appears
 *   II  THE DIVIDE  the wand dips into a tap; one stone becomes three
 *   III THE VANISH  the wand sweeps out; everything returns to dust
 */

export const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (t: number) => t * t * (3 - 2 * t);
/** Critically damped follow — frame-rate independent, never overshoots. */
export const damp = (cur: number, to: number, lambda: number, dt: number) =>
  to + (cur - to) * Math.exp(-lambda * dt);

export interface Acts {
  reveal: number;
  split: number;
  vanish: number;
}

export function acts(p: number): Acts {
  return {
    reveal: clamp01(p / 0.35),
    split: clamp01((p - 0.35) / 0.35),
    vanish: clamp01((p - 0.7) / 0.3),
  };
}

export interface WandPose {
  x: number;
  y: number;
  z: number;
  /** Roll — the wand's angle in frame. */
  rz: number;
}

export function wandPose(p: number, bob = 0): WandPose {
  const a = acts(p);
  const arc = smoothstep(a.reveal);
  const tap = Math.sin(smoothstep(a.split) * Math.PI); // 0 → 1 → 0
  const away = smoothstep(a.vanish);

  return {
    x: lerp(-2.9, -1.15, arc) + tap * 0.5 + away * 5.2,
    y: lerp(-1.5, 0.72, arc) - tap * 0.55 + bob,
    z: lerp(0.4, 0.9, arc),
    rz: lerp(0.95, -0.42, arc) + tap * 0.3 + away * 0.8,
  };
}

/** How present the hero stone is, 0–1. It never fully vanishes: something has
 *  to remain in the reader's hand at the end of the trick. */
export function stonePresence(p: number): number {
  const a = acts(p);
  const born = smoothstep(clamp01((a.reveal - 0.45) / 0.55));
  return born * (1 - smoothstep(a.vanish) * 0.72);
}

/** How far the two satellites have spread, in world units. */
export function satelliteSpread(p: number): number {
  return 1.85 * smoothstep(acts(p).split);
}
