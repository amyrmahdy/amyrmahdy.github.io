/**
 * The only safe entry point for events.
 *
 * MatomoTracker is PROD-gated, so `_paq` simply does not exist in dev — every
 * call must no-op silently rather than throw on a scroll handler.
 */

declare global {
  interface Window {
    _paq?: unknown[][];
  }
}

export function track(
  category: string,
  action: string,
  name?: string,
  value?: number
) {
  if (typeof window === "undefined" || !window._paq) return;
  window._paq.push(["trackEvent", category, action, name, value]);
}

export function trackGoal(id: number) {
  if (typeof window === "undefined" || !window._paq) return;
  window._paq.push(["trackGoal", id]);
}

/** Chapter funnel. Fires once per chapter per page view — a Set guards against
 *  re-entry when the reader scrolls back up, which would otherwise make the
 *  drop-off curve meaningless. */
export function initChapterFunnel() {
  const seen = new Set<string>();
  const sections = document.querySelectorAll<HTMLElement>("[data-chapter]");
  if (!sections.length) return;

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        const n = el.dataset.chapter!;
        if (seen.has(n)) continue;
        seen.add(n);
        track("Narrative", "ChapterReached", el.id || n, Number(n));
      }
    },
    { threshold: 0.5 }
  );

  sections.forEach((s) => io.observe(s));
}
