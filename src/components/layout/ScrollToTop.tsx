import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Resets scroll to top whenever the pathname changes.
 * Scrolls both the window and the main content area (if present).
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Window scroll
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } catch {
      window.scrollTo(0, 0);
    }
    // Any scrollable main regions
    document.querySelectorAll<HTMLElement>("main, [data-scroll-root]").forEach((el) => {
      el.scrollTop = 0;
    });
  }, [pathname]);

  return null;
}
