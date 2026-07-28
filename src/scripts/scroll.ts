/**
 * Scroll progress, smoothed — without touching scroll.
 *
 * No Lenis. Lenis smooths by preventDefault-ing wheel, which is scroll-jacking:
 * it desyncs from the real scrollbar and its iOS touch handling is worse than
 * native momentum. Instead ScrollTrigger reports raw progress and a critically
 * damped spring smooths the animation's *pursuit* of it. Native scrollbar,
 * native keyboard, zero preventDefault, one less dependency.
 */
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export interface Progress {
  /** Raw 0–1 from ScrollTrigger. */
  raw: number;
  /** Spring-smoothed 0–1. This is what the scene reads. */
  smooth: number;
  /** d(smooth)/dt, in progress-units per second. Drives the ascent. */
  velocity: number;
}

export const P: Progress = { raw: 0, smooth: 0, velocity: 0 };

/** Critically damped follow — no overshoot, frame-rate independent. */
function damp(current: number, target: number, lambda: number, dt: number) {
  return target + (current - target) * Math.exp(-lambda * dt);
}

type Frame = (dt: number) => void;
const frameCallbacks: Frame[] = [];

export function onFrame(fn: Frame) {
  frameCallbacks.push(fn);
  return () => {
    const i = frameCallbacks.indexOf(fn);
    if (i >= 0) frameCallbacks.splice(i, 1);
  };
}

let started = false;

export function initScroll() {
  if (started) return;
  started = true;

  ScrollTrigger.config({ ignoreMobileResize: true });

  ScrollTrigger.create({
    trigger: "#main",
    start: "top top",
    end: "bottom bottom",
    // Assigns one number. Never reads the DOM, never touches three.
    onUpdate: (self) => {
      P.raw = self.progress;
    },
  });

  // Exactly one rAF in the whole application. Rendering happens only here —
  // never inside a scroll event, and never via renderer.setAnimationLoop, which
  // would create a second loop racing this one.
  gsap.ticker.add((_time, deltaMs) => {
    const dt = Math.min(deltaMs / 1000, 1 / 30);
    const prev = P.smooth;
    P.smooth = damp(P.smooth, P.raw, 9, dt);
    P.velocity = dt > 0 ? (P.smooth - prev) / dt : 0;
    for (const fn of frameCallbacks) fn(dt);
  });

  gsap.ticker.lagSmoothing(500, 33);
}

export function refreshScroll() {
  ScrollTrigger.refresh();
}

export function killScroll() {
  ScrollTrigger.getAll().forEach((t) => t.kill());
  frameCallbacks.length = 0;
  started = false;
}
