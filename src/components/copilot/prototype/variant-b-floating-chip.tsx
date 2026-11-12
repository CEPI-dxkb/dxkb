"use client";

// Variant B — "Floating · navbar chip". Today's floating window (drag it, resize it) plus a
// Minimize button. Minimized, the window disappears entirely and the navbar button becomes the
// chip (pulse while writing, "answer ready" when done), so a minimized AskClark takes no page
// space and cannot cover anything. The window comes back where it was left.

import { FloatingDock } from "./floating-dock";
import type { DockProps, DockState } from "./dock-state";

export function VariantBDock({ api }: DockProps) {
  return <FloatingDock api={api} />;
}

export function variantBInset(_state: DockState) {
  return { right: 0, bottom: 0 };
}
