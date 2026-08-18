/**
 * Shared input state: where the pointer is, whether it is dragging, and how
 * fast it is moving.
 *
 * Module-level rather than React state — this updates on every pointer event
 * and re-rendering the tree for it would be absurd. The scene reads it inside
 * useFrame; React never sees it change.
 *
 * Nothing here calls preventDefault on wheel or touchmove: the page must stay
 * scrollable with a real scrollbar, on a phone as much as a desktop.
 */

export interface PointerState {
  /** Normalised −1…1, origin at viewport centre. */
  nx: number;
  ny: number;
  /** True once the pointer has actually moved — before that, no force field. */
  active: boolean;
  down: boolean;
  /** Accumulated drag, in radians of world rotation. */
  orbitX: number;
  orbitY: number;
  /** Drag velocity, for inertia after release. */
  spinX: number;
  spinY: number;
  /** 0–1, how hard the pointer is currently moving. Drives the disturbance. */
  energy: number;
}

export const POINTER: PointerState = {
  nx: 0,
  ny: 0,
  active: false,
  down: false,
  orbitX: 0,
  orbitY: 0,
  spinX: 0,
  spinY: 0,
  energy: 0,
};

const MAX_TILT = 0.42; // radians — enough to feel like control, not enough to lose the frame

export function initPointer(): () => void {
  let lastX = 0;
  let lastY = 0;
  let seeded = false;

  const move = (e: PointerEvent) => {
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = (e.clientY / window.innerHeight) * 2 - 1;

    if (!seeded) {
      lastX = nx;
      lastY = ny;
      seeded = true;
    }

    const dx = nx - lastX;
    const dy = ny - lastY;
    lastX = nx;
    lastY = ny;

    POINTER.nx = nx;
    POINTER.ny = ny;
    POINTER.active = true;
    // Energy decays in the frame loop; this only ever adds to it.
    POINTER.energy = Math.min(1, POINTER.energy + Math.hypot(dx, dy) * 6);

    if (POINTER.down) {
      POINTER.spinX = dy * 2.2;
      POINTER.spinY = dx * 2.6;
      POINTER.orbitY += POINTER.spinY;
      POINTER.orbitX += POINTER.spinX;
      POINTER.orbitX = Math.max(-MAX_TILT, Math.min(MAX_TILT, POINTER.orbitX));
    }
  };

  const down = (e: PointerEvent) => {
    // Let links, buttons and inputs keep their normal behaviour.
    // instanceof rather than an optional call: a pointerdown whose target is
    // window or document has no .closest, and `?.` does not guard a missing
    // method — it would throw here and take the whole drag path down with it.
    const el = e.target instanceof Element ? e.target : null;
    if (el?.closest("a, button, input, label")) return;
    POINTER.down = true;
    document.documentElement.classList.add("is-dragging");
  };

  const up = () => {
    POINTER.down = false;
    document.documentElement.classList.remove("is-dragging");
  };

  const leave = () => {
    POINTER.active = false;
    up();
  };

  window.addEventListener("pointermove", move, { passive: true });
  window.addEventListener("pointerdown", down, { passive: true });
  window.addEventListener("pointerup", up, { passive: true });
  window.addEventListener("pointercancel", up, { passive: true });
  document.addEventListener("pointerleave", leave);

  return () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerdown", down);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    document.removeEventListener("pointerleave", leave);
  };
}

/** Called once per frame: bleed off energy, coast the orbit, ease it home. */
export function decayPointer(dt: number) {
  POINTER.energy *= Math.exp(-3.2 * dt);

  if (!POINTER.down) {
    // Coast, then drift home so the composition always recovers — copy on the
    // left, stone on the right. Gains are deliberately modest: at 8x, a flick
    // added ~1.3rad and spun the world about 76 degrees, which felt like
    // losing control rather than having it.
    POINTER.orbitY += POINTER.spinY * dt * 3.5;
    POINTER.orbitX += POINTER.spinX * dt * 3.5;
    POINTER.spinX *= Math.exp(-2.8 * dt);
    POINTER.spinY *= Math.exp(-2.8 * dt);
    POINTER.orbitX *= Math.exp(-0.7 * dt);
    POINTER.orbitY *= Math.exp(-0.5 * dt);
    POINTER.orbitX = Math.max(-MAX_TILT, Math.min(MAX_TILT, POINTER.orbitX));
  }
}
