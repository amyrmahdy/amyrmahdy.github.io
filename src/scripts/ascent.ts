/**
 * The one interactive claim on the site.
 *
 * A diamond that rises slowly reverts to graphite — the stable form at surface
 * pressure. Only a fast ascent outruns the chemistry. So chapter 6 reads the
 * reader's own scroll velocity: carry the stone up quickly and it surfaces
 * intact; dawdle and it degrades, and the copy changes to say so.
 *
 * This lives in the base tier, not the WebGL layer, because the argument is the
 * copy swap. The canvas only illustrates it.
 */

export type AscentState = "fast" | "slow";

export const ASCENT = {
  /** 1 = intact diamond, 0 = fully reverted to graphite. */
  crystallinity: 1,
  state: "fast" as AscentState,
};

/** Progress-units per second below which the ascent counts as too slow.
 *  Chapter 6 spans 0.18 of the page; a reader moving through it in under about
 *  six seconds clears this comfortably, a reader inching through does not. */
const THRESHOLD = 0.03;

/** Reverting takes noticeably longer than recovering — graphite forms slowly,
 *  and a reader who speeds up should feel they rescued it. */
const DECAY_PER_SEC = 0.55;
const RECOVER_PER_SEC = 1.1;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * @param speed absolute scroll velocity in progress-units/sec
 * @param dt    seconds since last update
 * @param inAscent whether the reader is inside chapter 6
 */
export function updateAscent(speed: number, dt: number, inAscent: boolean) {
  if (!inAscent) {
    // Outside the ascent the stone is simply intact; nothing is being claimed.
    ASCENT.crystallinity = 1;
    ASCENT.state = "fast";
    return ASCENT;
  }

  const d = Math.min(dt, 0.1); // a backgrounded tab must not nuke the state
  if (speed < THRESHOLD) {
    ASCENT.crystallinity = clamp01(ASCENT.crystallinity - DECAY_PER_SEC * d);
  } else {
    ASCENT.crystallinity = clamp01(ASCENT.crystallinity + RECOVER_PER_SEC * d);
  }

  // Hysteresis: without a dead band the label flickers between states on any
  // reader whose speed hovers near the threshold.
  if (ASCENT.state === "fast" && ASCENT.crystallinity < 0.35) {
    ASCENT.state = "slow";
  } else if (ASCENT.state === "slow" && ASCENT.crystallinity > 0.7) {
    ASCENT.state = "fast";
  }

  return ASCENT;
}

export function resetAscent() {
  ASCENT.crystallinity = 1;
  ASCENT.state = "fast";
}
