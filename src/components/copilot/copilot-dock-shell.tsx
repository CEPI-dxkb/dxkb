"use client";

import { useEffect, useRef, type PropsWithChildren } from "react";
import { useUiPreference } from "@/lib/ui-preferences/provider";
import { useCopilot } from "./copilot-provider";

/** Keeps `--dock-top` on `shell` at the navbar's visible bottom; returns the cleanup. */
function followNavbar(shell: HTMLElement, navbar: HTMLElement): () => void {
  const measure = () => {
    const bottom = Math.max(0, Math.round(navbar.getBoundingClientRect().bottom));
    shell.style.setProperty("--dock-top", `${String(bottom)}px`);
  };
  // At most one measurement per frame while scrolling, and no React render.
  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      measure();
    });
  };
  const observer = new ResizeObserver(measure);
  observer.observe(navbar);
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

  useEffect(() => {
    const shell = shellRef.current;
    const navbar = document.getElementById("navbar-container");
    if (!enabled || !shell || !navbar) return;
    return followNavbar(shell, navbar);
  }, [enabled]);

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
