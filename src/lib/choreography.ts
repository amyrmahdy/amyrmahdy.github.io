/**
 * The podium, as pure maths. ZERO imports on purpose.
 *
 * The browsers available in this environment run pages backgrounded, where
 * requestAnimationFrame is suspended and the scene never advances a frame, so
 * everything about motion is verified here under `node --test` rather than by
 * eye. Every other scene file codes against these exports and nothing else.
 *
 *   I   DOWNBEAT      tuning → the baton drops → phase-lock leaves the podium
 *   II  THREE ENTRIES the cue walks the semicircle; each third enters in turn
 *   III CUT-OFF       the beam is withdrawn; the release wave; stillness
 */

// ── helpers ─────────────────────────────────────────────────────────────────

export const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** t is already 0–1. */
export const smoothstep = (t: number) => t * t * (3 - 2 * t);
/** Critically damped follow — frame-rate independent, never overshoots. */
export const damp = (cur: number, to: number, lambda: number, dt: number) =>
  to + (cur - to) * Math.exp(-lambda * dt);

const fract = (n: number) => n - Math.floor(n);
const norm3 = (v: number[]): number[] => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const lerp3 = (a: number[], b: number[], t: number): number[] => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

// ── movements ───────────────────────────────────────────────────────────────

export interface Movements {
  downbeat: number;
  entries: number;
  cutoff: number;
}

export function movements(p: number): Movements {
  return {
    downbeat: clamp01(p / 0.35),
    entries: clamp01((p - 0.35) / 0.35),
    cutoff: clamp01((p - 0.7) / 0.3),
  };
}

// ── seating ─────────────────────────────────────────────────────────────────

export const ARC_RADII = [3.0, 4.2, 5.4, 6.6, 7.8] as const;
export const ARC_SEATS = [16, 20, 26, 30, 34] as const; // 126
export const ARC_SEATS_LOW = [10, 14, 18, 20, 22] as const; // 84
/** Half-span, radians: −72° … +72°. */
export const ARC_SPAN = 1.256637;
export const SEAT_Y = 0.9;
export const SECTIONS = 12;

export const hash = (n: number) => fract(Math.sin(n * 12.9898 + 78.233) * 43758.5453);

export interface Seat {
  i: number;
  arc: number;
  angle: number;
  x: number;
  z: number;
  radius: number;
  section: number;
  third: number;
  seed: number;
  tuneHz: number;
  tunePhase: number;
}

export function seats(low = false): Seat[] {
  const counts = low ? ARC_SEATS_LOW : ARC_SEATS;
  const out: Seat[] = [];
  let i = 0;
  for (let arc = 0; arc < ARC_RADII.length; arc++) {
    const r = ARC_RADII[arc];
    const n = counts[arc];
    for (let k = 0; k < n; k++) {
      const angle = -ARC_SPAN + (2 * ARC_SPAN * k) / (n - 1);
      const section = Math.min(
        SECTIONS - 1,
        Math.floor(((angle + ARC_SPAN) / (2 * ARC_SPAN)) * SECTIONS)
      );
      const seed = hash(i + 1);
      const centre = 0.9 + (0.5 * ((section * 7) % 12)) / 11;
      out.push({
        i,
        arc,
        angle,
        x: r * Math.sin(angle),
        z: -r * Math.cos(angle),
        radius: r,
        section,
        third: Math.floor(section / 4),
        seed,
        tuneHz: centre + (seed - 0.5) * 0.16,
        tunePhase: seed * Math.PI * 2,
      });
      i++;
    }
  }
  return out;
}

// ── camera ──────────────────────────────────────────────────────────────────

export interface Rig {
  y: number;
  z: number;
  pitch: number;
  yaw: number;
  fov: number;
}

export const YAW_FOR_THIRD = [-0.31, 0, 0.31] as const;

/** Continuous 0 → 3: how many thirds have entered. */
export function cue(p: number): number {
  let s = 0;
  for (let k = 0; k < 3; k++) {
    s += smoothstep(clamp01((p - (0.42 + 0.1 * k) + 0.03) / 0.06));
  }
  return s;
}

export const thirdLit = (p: number, k: number) => clamp01(cue(p) - k);

export const thirdEmber = (p: number, k: number) =>
  thirdLit(p, k) * (1 - clamp01(cue(p) - k - 1)) * (1 - release(p));

export function cueYaw(p: number): number {
  const c = cue(p);
  let yaw: number;
  if (c <= 1) yaw = lerp(0, YAW_FOR_THIRD[0], c);
  else if (c <= 2) yaw = lerp(YAW_FOR_THIRD[0], YAW_FOR_THIRD[1], c - 1);
  else yaw = lerp(YAW_FOR_THIRD[1], YAW_FOR_THIRD[2], c - 2);
  return yaw * (1 - smoothstep(movements(p).cutoff));
}

export function cameraRig(p: number, portrait = false): Rig {
  const lift = smoothstep(movements(p).downbeat);
  return {
    y: lerp(1.55, 5.4, lift),
    z: lerp(0.6, 2.6, lift) + (portrait ? 2.0 : 0),
    pitch: lerp(-0.08, -0.49, lift) - (portrait ? 0.1 * lift : 0),
    yaw: cueYaw(p),
    fov: portrait ? 58 : 42,
  };
}

export const release = (p: number) => smoothstep(clamp01((p - 0.72) / 0.13));
export const hallLight = (p: number) => 0.06 * smoothstep(clamp01((p - 0.72) / 0.2));
/** The release wave's radius from the podium — pure in p, so scrolling back reverses it. */
export const releaseRadius = (p: number) => 8.4 * clamp01((p - 0.72) / 0.13);
/** Hysteresis: latches at 0.72, un-latches below 0.68. */
export const cutoffLatch = (prev: boolean, p: number) => (prev ? p > 0.68 : p >= 0.72);

// ── the clock ───────────────────────────────────────────────────────────────

export const BPM = 72;
export const BPS = 1.2;
export const WAVE_SPEED = 6.5;
export const LOCK_WIDTH = 0.6;
export const WAVE_MAX_T = 2.6;
export const PULSE_TAIL = Math.exp(-0.88 * 2.6); // 0.101469…

export const wavefront = (t: number, speed = WAVE_SPEED) => (t < 0 ? -1 : t * speed);

export const lock = (d: number, radius: number, width = LOCK_WIDTH) =>
  radius < 0 ? 0 : smoothstep(clamp01((radius - d) / width));

/** Periodic, continuous, 0.10–1: a fast attack and an exponential tail. */
export function pulse(phase: number): number {
  const f = fract(phase);
  return f < 0.12 ? PULSE_TAIL + (1 - PULSE_TAIL) * (f / 0.12) : Math.exp(-(f - 0.12) * 2.6);
}

export const tune = (t: number, hz: number, phase0: number) =>
  0.5 + 0.5 * Math.sin(Math.PI * 2 * hz * t + phase0);

export const flash = (d: number, radius: number) =>
  radius < 0 ? 0 : Math.exp(-(((d - radius) / 0.35) ** 2));

export interface AmplitudeIn {
  tune: number;
  pulse: number;
  lock: number;
  beam: number;
  energy: number;
  lit: number;
  released: number;
}

/** The reference for the shader's stroke height. */
export const amplitude = (a: AmplitudeIn) =>
  lerp(a.tune, 0.25 + 0.75 * a.pulse, a.lock) *
  (1 + 0.9 * a.beam) *
  (1 + 1.4 * a.energy) *
  (1 + 0.6 * a.lit) *
  (1 - a.released);

// ── per-seat clock ──────────────────────────────────────────────────────────

export interface SeatClock {
  /** 0–1: how locked this seat already was before the current wave. */
  lockPrev: number;
  /** Beats, 0–1: the phase this seat carries from before the current wave. */
  phase0: number;
  /** World units from the current wave origin. */
  dist: number;
}

/** The phase a seat is displaying: the new wave's once it has arrived, its
 *  carried phase until then. */
export function seatPhase(c: SeatClock, clock: number): number {
  const arrived = lock(c.dist, wavefront(clock));
  return arrived >= 0.5
    ? (clock - c.dist / WAVE_SPEED) * BPS
    : c.phase0 + Math.max(0, clock) * BPS;
}

export function seatPulse(c: SeatClock, clock: number): number {
  const carried = pulse(c.phase0 + Math.max(0, clock) * BPS) * c.lockPrev;
  const fresh = pulse((clock - c.dist / WAVE_SPEED) * BPS);
  return lerp(carried, fresh, lock(c.dist, wavefront(clock)));
}

/** Called once per seat on every new downbeat. Keeps the displayed pulse
 *  continuous for seats the previous wave had reached, and never locks a seat
 *  the new wave has not reached. */
export function rebaseSeat(
  seat: { x: number; z: number },
  c: SeatClock,
  clockOld: number,
  origin: number[]
): SeatClock {
  return {
    lockPrev: Math.max(c.lockPrev, lock(c.dist, wavefront(clockOld))),
    phase0: fract(seatPhase(c, clockOld)),
    dist: Math.hypot(seat.x - origin[0], seat.z - origin[2]),
  };
}

// ── arrival & baton ─────────────────────────────────────────────────────────

export const ARRIVAL = {
  enter: 2.4,
  raised: 3.0,
  ictus: 3.4,
  settled: 3.9,
  handoff: 4.6,
  live: 5.6,
} as const;

/** Scrolling during arrival runs the arrival clock at 4× until handoff. */
export const arrivalRate = (progress: number, arrivalT: number) =>
  progress > 0.02 && arrivalT < ARRIVAL.live ? 4 : 1;

// Rig-local. +Y is the shaft.
export const PIVOT = [0.42, -0.38, -1.1] as const;
export const PIVOT_REST = [-0.34, -0.4, -1.0] as const;
export const DIR_DOWN = [0, -1, 0] as const;
export const DIR_RAISED = norm3([0, 0.62, -0.78]);
/** Resting direction after the ictus. Tip up ~17° and slightly left: still
 *  addressing the room, but with visible shaft. Pointing dead ahead was seen
 *  end-on from first person and the baton vanished to a sliver. */
export const DIR_DEFAULT = norm3([-0.18, 0.28, -0.94]);
export const DIR_REST = norm3([0.7071, 0.7071, 0]);

/** 14° tip-down over 120 ms, rebound by 320 ms. */
export const dipCurve = (beatT: number) =>
  beatT < 0 ? 0 : beatT < 0.12 ? beatT / 0.12 : Math.max(0, 1 - (beatT - 0.12) / 0.2);

export interface BatonPose {
  /** 0–1, drives scale. */
  present: number;
  x: number;
  y: number;
  z: number;
  /** Unit, rig-local. */
  dir: number[];
  dip: number;
  /** Weight of the pointer aim. */
  aim: number;
  rest: number;
}

export function batonPose(arrivalT: number, beatT: number, p: number): BatonPose {
  const enter = smoothstep(clamp01((arrivalT - ARRIVAL.enter) / 0.6));
  const settle = smoothstep(clamp01((arrivalT - ARRIVAL.ictus) / 0.5));
  const aim0 = smoothstep(clamp01((arrivalT - ARRIVAL.handoff) / 1.0));

  let dir = norm3(lerp3(DIR_DOWN as unknown as number[], DIR_RAISED, enter));
  dir = norm3(lerp3(dir, DIR_DEFAULT, settle));

  const rest = smoothstep(clamp01((p - 0.72) / 0.12));
  const up = smoothstep(clamp01(rest / 0.5));
  const down = smoothstep(clamp01((rest - 0.5) / 0.5));
  dir = norm3(lerp3(dir, DIR_RAISED, up));
  dir = norm3(lerp3(dir, DIR_REST, down));

  return {
    present: enter,
    x: lerp(PIVOT[0], PIVOT_REST[0], down),
    y: lerp(PIVOT[1], PIVOT_REST[1], down) - (1 - enter) * 0.5,
    z: lerp(PIVOT[2], PIVOT_REST[2], down),
    dir,
    dip: dipCurve(beatT) * (1 - rest),
    aim: aim0 * (1 - rest),
    rest,
  };
}

// ── pointer → stage ─────────────────────────────────────────────────────────

/** Where a ray from the eye meets the stage plane, clamped to a sane range. */
export function stageHit(eye: number[], dir: number[], planeY = SEAT_Y, far = 12): number[] {
  let t = dir[1] < -1e-4 ? (planeY - eye[1]) / dir[1] : far;
  t = Math.max(0.5, Math.min(far, t));
  return [eye[0] + dir[0] * t, eye[1] + dir[1] * t, eye[2] + dir[2] * t];
}

export const BEAM_COS_OUTER = 0.987688; // cos 9°
export const BEAM_COS_INNER = 0.997564; // cos 4°

export const beamWeight = (cosAngle: number, strength: number) =>
  smoothstep(clamp01((cosAngle - BEAM_COS_OUTER) / (BEAM_COS_INNER - BEAM_COS_OUTER))) * strength;

/** Scene brightness under the copy column: 0.35 inside, 1 outside, feathered.
 *  m = [x0, y0, x1, y1] in NDC; [−2,−2,−2,−2] means no mask. */
export function copyMask(nx: number, ny: number, m: number[], feather = 0.08): number {
  const f = (v: number, lo: number, hi: number) =>
    smoothstep(clamp01((v - lo + feather) / feather)) *
    smoothstep(clamp01((hi - v + feather) / feather));
  const inside = f(nx, m[0], m[2]) * f(ny, m[1], m[3]);
  return 1 - 0.65 * inside;
}

// ── shared frame state ──────────────────────────────────────────────────────

/** Numbers only, no THREE. Scene writes every field each frame except
 *  lockByArc and pulseByArc, which Orchestra writes (its only writes). */
export interface Conductor {
  p: number;
  time: number;
  arrivalT: number;
  /** Seconds since the last ictus, −1 before the first. */
  clock: number;
  beatT: number;
  downbeatId: number;
  waveOrigin: number[];
  releaseR: number;
  cutoff: boolean;
  eye: number[];
  beamDir: number[];
  beamStrength: number;
  stage: number[];
  energy: number;
  ember: number[];
  lit: number[];
  hover: number[];
  copyMask: number[];
  hall: number;
  lockByArc: number[];
  pulseByArc: number[];
  handoff: number;
  portrait: boolean;
  lowPower: boolean;
}

export function newConductor(): Conductor {
  return {
    p: 0,
    time: 0,
    arrivalT: 0,
    clock: -1,
    beatT: -1,
    downbeatId: 0,
    waveOrigin: [0, SEAT_Y, 0],
    releaseR: 0,
    cutoff: false,
    eye: [0, 0, 0],
    beamDir: [0, 0, -1],
    beamStrength: 0,
    stage: [0, SEAT_Y, -3],
    energy: 0,
    ember: [0, 0, 0],
    lit: [0, 0, 0],
    hover: [0, 0, 0],
    copyMask: [-2, -2, -2, -2],
    hall: 0,
    lockByArc: [0, 0, 0, 0, 0],
    pulseByArc: [0, 0, 0, 0, 0],
    handoff: 0,
    portrait: false,
    lowPower: false,
  };
}
