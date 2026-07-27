/**
 * Sets `html[data-ch]` as chapters enter the viewport, which is what drives the
 * palette transition, and updates the depth rail's live telemetry.
 *
 * Deliberately tiny and dependency-free: this ships to 100% of visitors and is
 * the entire motion system when WebGL is absent or reduced-motion is set. The
 * GSAP/three.js layer loads later and on top, never instead.
 */

interface Telemetry {
  km: [number, number];
  celsius: [number, number];
  pressure: string;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

export function initDepth() {
  const sections = Array.from(
    document.querySelectorAll<HTMLElement>("[data-chapter]")
  );
  if (!sections.length) return;

  const root = document.documentElement;
  const rail = document.querySelector<HTMLElement>("[data-rail]");
  const announcer = document.querySelector<HTMLElement>("[data-rail-announce]");

  const readTelemetry = (el: HTMLElement): Telemetry => ({
    km: JSON.parse(el.dataset.km || "[0,0]"),
    celsius: JSON.parse(el.dataset.celsius || "[20,20]"),
    pressure: el.dataset.pressure || "1 atm",
  });

  let current = 0;

  const setChapter = (el: HTMLElement) => {
    const n = Number(el.dataset.chapter);
    if (n === current) return;
    current = n;

    root.dataset.ch = String(n);
    rail?.querySelectorAll<HTMLElement>("[data-rail-item]").forEach((item) => {
      item.dataset.active = String(Number(item.dataset.railItem) === n);
    });

    // Announce the chapter, not the numbers — a live region reading a depth
    // counter on every frame would be unusable.
    if (announcer) announcer.textContent = el.dataset.title || "";
  };

  // The active chapter is whichever section contains the viewport's reading
  // line (45% down). Computed directly rather than with IntersectionObserver:
  // an IO band thin enough to guarantee a single active chapter has ~zero area
  // and never fires, and a band wide enough to fire lets two chapters overlap
  // and flicker at the boundary. A containment test has neither failure mode
  // and is exact under fast scrolling and scroll restoration.
  const READING_LINE = 0.45;

  const activeIndex = () => {
    const line = window.innerHeight * READING_LINE;
    for (let i = sections.length - 1; i >= 0; i--) {
      if (sections[i].getBoundingClientRect().top <= line) return i;
    }
    return 0;
  };

  // Live telemetry, interpolated across the active chapter's own scroll span.
  const kmEl = rail?.querySelector<HTMLElement>("[data-readout='km']");
  const tempEl = rail?.querySelector<HTMLElement>("[data-readout='temp']");
  const pressEl = rail?.querySelector<HTMLElement>("[data-readout='press']");
  // Document-scoped: the mobile progress line is a sibling of the rail, not a
  // child of it, so it survives the rail being display:none under 1200px.
  const fillEl = document.querySelector<HTMLElement>("[data-rail-fill]");
  if (!kmEl && !fillEl) return;

  let ticking = false;

  const update = () => {
    ticking = false;
    const active = sections[activeIndex()];
    if (!active) return;
    setChapter(active);

    const r = active.getBoundingClientRect();
    const vh = window.innerHeight;
    // 0 as the section's top crosses the reading line, 1 as its bottom does.
    const t = clamp01((vh * READING_LINE - r.top) / Math.max(r.height, 1));

    const tel = readTelemetry(active);
    const km = lerp(tel.km[0], tel.km[1], t);
    const c = lerp(tel.celsius[0], tel.celsius[1], t);

    if (kmEl) kmEl.textContent = km.toFixed(0).padStart(3, " ");
    if (tempEl) tempEl.textContent = Math.round(c).toLocaleString("en-GB");
    if (pressEl) pressEl.textContent = tel.pressure;

    // Whole-page progress, for the rail's fill and the mobile progress line.
    const doc = document.documentElement;
    const p = clamp01(doc.scrollTop / Math.max(doc.scrollHeight - vh, 1));
    if (fillEl) fillEl.style.setProperty("--fill", String(p));
    root.style.setProperty("--depth", String(p));
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll, { passive: true });
  update();
}
