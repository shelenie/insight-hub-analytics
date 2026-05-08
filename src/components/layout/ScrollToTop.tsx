import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Resets scroll to top on every route change (pathname/search/hash).
 * Targets the window plus any inner scrollable containers
 * (`main`, `[data-scroll-root]`, the sidebar's content viewport).
 *
 * Uses useLayoutEffect so the reset happens before paint — avoids the brief
 * flash of the previous page's scroll position when switching sidebar pages.
 */
export function ScrollToTop() {
  const { pathname, search, hash } = useLocation();

  useLayoutEffect(() => {
    // Disable browser's native scroll restoration so it can't override us.
    if ("scrollRestoration" in window.history) {
      try {
        window.history.scrollRestoration = "manual";
      } catch {
        /* ignore */
      }
    }

    // Window scroll
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } catch {
      window.scrollTo(0, 0);
    }
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    // Any scrollable inner regions
    document
      .querySelectorAll<HTMLElement>(
        "main, [data-scroll-root], [data-radix-scroll-area-viewport]",
      )
      .forEach((el) => {
        el.scrollTop = 0;
        el.scrollLeft = 0;
      });
  }, [pathname, search, hash]);

  return null;
}
