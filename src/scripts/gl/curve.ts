/**
 * Monotone cubic interpolation (Fritsch–Carlson).
 *
 * Catmull-Rom is the obvious choice here and it is wrong: it overshoots between
 * keyframes, which on a depth curve means the camera briefly rises above ground
 * mid-descent and dips below the deepest point. That is a visible bug. A
 * monotone spline is guaranteed never to exceed its control values.
 */

export interface Keyframe {
  p: number;
  v: number;
}

export class MonotoneCurve {
  private xs: number[];
  private ys: number[];
  private ms: number[];

  constructor(keys: Keyframe[]) {
    const sorted = [...keys].sort((a, b) => a.p - b.p);
    this.xs = sorted.map((k) => k.p);
    this.ys = sorted.map((k) => k.v);

    const n = this.xs.length;
    const dxs: number[] = [];
    const dys: number[] = [];
    const slopes: number[] = [];

    for (let i = 0; i < n - 1; i++) {
      const dx = this.xs[i + 1] - this.xs[i];
      const dy = this.ys[i + 1] - this.ys[i];
      dxs.push(dx);
      dys.push(dy);
      slopes.push(dx === 0 ? 0 : dy / dx);
    }

    // Tangents: average of neighbouring slopes, then clamped for monotonicity.
    const ms: number[] = [slopes[0] ?? 0];
    for (let i = 0; i < slopes.length - 1; i++) {
      const a = slopes[i];
      const b = slopes[i + 1];
      if (a * b <= 0) {
        ms.push(0); // local extremum — flatten so we cannot overshoot
      } else {
        const dxa = dxs[i];
        const dxb = dxs[i + 1];
        const common = dxa + dxb;
        ms.push((3 * common) / ((common + dxb) / a + (common + dxa) / b));
      }
    }
    ms.push(slopes[slopes.length - 1] ?? 0);
    this.ms = ms;
  }

  at(p: number): number {
    const { xs, ys, ms } = this;
    const n = xs.length;
    if (p <= xs[0]) return ys[0];
    if (p >= xs[n - 1]) return ys[n - 1];

    let i = 0;
    while (i < n - 2 && p > xs[i + 1]) i++;

    const h = xs[i + 1] - xs[i];
    const t = (p - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;

    // Hermite basis
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * h * ms[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] +
      (t3 - t2) * h * ms[i + 1]
    );
  }
}

/**
 * Depth in km against scroll progress, from the real geology.
 *
 * Descending 190 km costs 0.62 of the scroll; ascending it costs 0.18. The
 * violence of the eruption is free — same distance, roughly 3.5x the world
 * velocity — which is exactly the argument chapter 6 is making.
 */
export const DEPTH_CURVE = new MonotoneCurve([
  { p: 0.0, v: 0 },
  { p: 0.06, v: 3 },
  { p: 0.3, v: 35 },
  { p: 0.5, v: 140 },
  { p: 0.62, v: 190 }, // diamond stability field
  { p: 0.72, v: 190 }, // held — crystallization
  { p: 0.9, v: 0 }, // kimberlite eruption
  { p: 1.0, v: 0 },
]);

/** 1150 °C at the stability field, 20 °C at either surface. */
export const TEMP_CURVE = new MonotoneCurve([
  { p: 0.0, v: 20 },
  { p: 0.3, v: 600 },
  { p: 0.5, v: 1000 },
  { p: 0.62, v: 1150 },
  { p: 0.72, v: 1150 },
  { p: 0.9, v: 200 },
  { p: 1.0, v: 20 },
]);

export const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number) =>
  a === b ? 0 : (v - a) / (b - a);
export const smoothstep = (t: number) => t * t * (3 - 2 * t);
