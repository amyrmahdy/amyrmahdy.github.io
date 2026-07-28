import { useEffect, useRef } from "react";

/**
 * Page scroll as a 0–1 ref.
 *
 * A ref rather than state: this updates on every scroll event, and re-rendering
 * the React tree to move a mesh would be absurd. Nothing here calls
 * preventDefault — the scrollbar stays real and the keyboard keeps working.
 */
export function useScrollProgress() {
  const raw = useRef(0);

  useEffect(() => {
    const read = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      raw.current = max > 0 ? Math.min(1, Math.max(0, doc.scrollTop / max)) : 0;
    };
    read();
    addEventListener("scroll", read, { passive: true });
    addEventListener("resize", read, { passive: true });
    return () => {
      removeEventListener("scroll", read);
      removeEventListener("resize", read);
    };
  }, []);

  return raw;
}
