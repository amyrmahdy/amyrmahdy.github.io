/**
 * Entry point for the canvas layer.
 *
 * three.js is behind a dynamic import that is never even requested on the NONE
 * tier, and is scheduled at idle so it cannot contend with the LCP text paint.
 * Deliberately not modulepreloaded — this should land *after* first paint.
 */
import { detectTier } from "./tier";

export async function bootStage() {
  const canvas = document.querySelector<HTMLCanvasElement>("#stage");
  if (!canvas) return;

  const tier = detectTier();
  if (tier === "NONE") return; // no canvas is ever created; SVG tier stands alone

  const start = async () => {
    try {
      const [{ Stage }, { initScroll, P }] = await Promise.all([
        import("./gl/Stage"),
        import("./scroll"),
      ]);
      initScroll();
      const stage = new Stage(canvas, tier);

      // Fade in only once there is something to show.
      requestAnimationFrame(() => {
        document.documentElement.classList.add("gl-active");
      });

      if (import.meta.env.DEV) {
        // Test seam. Automated browsers run this page in a backgrounded tab,
        // where rAF is suspended entirely, so the scene can never be observed
        // through the normal scroll path. This lets a frame be driven directly.
        (window as any).__gl = {
          stage,
          P,
          seek(p: number) {
            P.raw = P.smooth = p;
            P.velocity = 0;
            stage.renderOnce();
            return stage.debug;
          },
        };
      }
    } catch (err) {
      // Any failure here is survivable: the SVG tier is already on screen.
      document.documentElement.classList.remove("gl-active");
      if (import.meta.env.DEV) console.error("[stage] boot failed", err);
    }
  };

  if ("requestIdleCallback" in window) {
    (window as any).requestIdleCallback(start, { timeout: 2500 });
  } else {
    addEventListener("load", () => setTimeout(start, 300), { once: true });
  }
}
