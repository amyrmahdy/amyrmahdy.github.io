/**
 * Capability gate. Decided in ~1ms at boot, before three.js is imported at all.
 *
 * The SVG/CSS layer is not a fallback — it is the base layer served to 100% of
 * visitors. This only decides whether a canvas is drawn on top of it.
 */

export type Tier = "NONE" | "LOW" | "MID" | "HIGH";

const MOTION_KEY = "amm:reduce-motion";

export function prefersReducedMotion(): boolean {
  if (localStorage.getItem(MOTION_KEY) === "1") return true;
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function setReduceMotion(on: boolean) {
  if (on) localStorage.setItem(MOTION_KEY, "1");
  else localStorage.removeItem(MOTION_KEY);
}

/**
 * `failIfMajorPerformanceCaveat` is the highest-value line here: it pushes
 * software-rasterised WebGL — VMs, locked-down corporate laptops, i.e. a real
 * part of this audience — into the CSS tier rather than letting it run at 4fps.
 */
function hasWebGL2(): boolean {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2", {
      failIfMajorPerformanceCaveat: true,
      powerPreference: "high-performance",
    });
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function detectTier(): Tier {
  if (typeof window === "undefined") return "NONE";
  if (prefersReducedMotion()) return "NONE";

  const conn = (navigator as any).connection;
  if (conn?.saveData) return "NONE";
  if ((navigator as any).deviceMemory && (navigator as any).deviceMemory <= 2) {
    return "NONE";
  }
  if (!hasWebGL2()) return "NONE";

  const coarse = matchMedia("(pointer: coarse)").matches;
  const cores = navigator.hardwareConcurrency ?? 4;
  if (coarse || cores <= 4) return "LOW";

  // HIGH is earned by sustained frame time, not claimed at boot. Stage promotes.
  return "MID";
}

export interface QualitySettings {
  dpr: number;
  renderScale: number;
  fpsCap: number;
  msaa: number;
  bloom: boolean;
  atoms: number;
  bounces: number;
}

export const QUALITY: Record<Exclude<Tier, "NONE">, QualitySettings> = {
  // DPR 1.0 on mobile is deliberate: with grain and bloom nobody perceives the
  // difference, and DPR 3 is nine times the fragment work.
  LOW: { dpr: 1, renderScale: 0.85, fpsCap: 30, msaa: 0, bloom: false, atoms: 216, bounces: 1 },
  MID: { dpr: 1.5, renderScale: 1, fpsCap: 60, msaa: 2, bloom: true, atoms: 512, bounces: 2 },
  HIGH: { dpr: 2, renderScale: 1, fpsCap: 60, msaa: 4, bloom: true, atoms: 512, bounces: 4 },
};

/**
 * Rolling median frame time with a one-way latch. Median rather than mean so a
 * single GC spike cannot demote; latched so quality never oscillates, because
 * pumping reads as broken rather than adaptive.
 */
export class AdaptiveQuality {
  private samples: number[] = [];
  private overBudget = 0;
  private underBudget = 0;
  private hasDropped = false;

  constructor(
    public tier: Exclude<Tier, "NONE">,
    private onChange: (t: Exclude<Tier, "NONE">) => void
  ) {}

  sample(frameMs: number) {
    const s = this.samples;
    s.push(frameMs);
    if (s.length > 60) s.shift();
    if (s.length < 60) return;

    const median = [...s].sort((a, b) => a - b)[30];

    if (median > 20) {
      this.overBudget++;
      this.underBudget = 0;
      if (this.overBudget >= 90) this.step(-1);
    } else if (median < 12) {
      this.underBudget++;
      this.overBudget = 0;
      if (this.underBudget >= 240 && !this.hasDropped) this.step(1);
    } else {
      this.overBudget = this.underBudget = 0;
    }
  }

  private step(dir: 1 | -1) {
    const order: Exclude<Tier, "NONE">[] = ["LOW", "MID", "HIGH"];
    const i = order.indexOf(this.tier);
    const next = order[i + dir];
    if (!next) return;
    if (dir === -1) this.hasDropped = true;
    this.tier = next;
    this.overBudget = this.underBudget = 0;
    this.samples.length = 0;
    this.onChange(next);
  }
}
