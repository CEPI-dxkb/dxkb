"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, type PropsWithChildren } from "react";
import { useUiPreference } from "@/lib/ui-preferences/provider";
import { useCopilot } from "./copilot-provider";

/**
 * Keeps `--dock-top` on `shell` at the navbar's visible bottom; returns the cleanup. Each route
 * group's layout renders its own navbar, so navigating can replace it: the element is looked up on
 * every measurement and the size observer follows it, instead of holding on to a detached one.
 */
function followNavbar(shell: HTMLElement): () => void {
  let navbar: HTMLElement | null = null;
  const observer = new ResizeObserver(measure);

  function measure() {
    const current = document.getElementById("navbar-container");
    if (current !== navbar) {
      const previous = navbar;
      navbar = current;
      if (previous) observer.unobserve(previous);
      if (current) observer.observe(current);
    }
    const bottom = navbar
      ? Math.max(0, Math.round(navbar.getBoundingClientRect().bottom))
      : 0;
    shell.style.setProperty("--dock-top", `${String(bottom)}px`);
  }

  // At most one measurement per frame while scrolling, and no React render.
  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      measure();
    });
  };
  measure();
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  return () => {
    observer.disconnect();
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
    cancelAnimationFrame(frame);
  };
}

/**
 * Wraps the app so the side panel never covers the page from `lg` up: while it is open, the page's
 * `main` gets a margin as wide as the panel on the panel's side (`copilot-dock-shell` in
 * `globals.css`). The docks start under the navbar, so the navbar keeps its full width and its
 * AskClark button; the navbar is not sticky, so the docks' top follows it while the window scrolls.
 * Keep this element free of transforms: the docks inside it are `position: fixed`.
 */
export function CopilotDockShell({ children }: PropsWithChildren) {
  const copilot = useCopilot();
  const [tab] = useUiPreference("copilotTab");
  const enabled = copilot.available && !copilot.onCopilotPage;
  const shellRef = useRef<HTMLDivElement>(null);

  // A new page can bring a new navbar (a different layout), so follow it again after navigating.
  const pathname = usePathname();
  useEffect(() => {
    const shell = shellRef.current;
    if (!enabled || !shell) return;
    return followNavbar(shell);
  }, [enabled, pathname]);

  const docked = copilot.openSurface === "sheet" && !copilot.minimized;
  return (
    <div
      ref={shellRef}
      className="copilot-dock-shell"
      data-dock={docked ? tab.side : undefined}
    >
      {children}
    </div>
  );
}
