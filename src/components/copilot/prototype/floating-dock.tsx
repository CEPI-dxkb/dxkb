"use client";

import dynamic from "next/dynamic";
import type { CopilotFloatingEdge } from "../copilot-floating-window";
import type { CopilotPanelVariant } from "../copilot-panel-header";
import type { DockApi } from "./dock-state";

// The real floating window (drag, resize, saved position), loaded on first open like the real one.
const CopilotFloatingWindow = dynamic(
  () =>
    import("../copilot-floating-window").then(
      (module) => module.CopilotFloatingWindow,
    ),
  { ssr: false },
);

/**
 * Stays mounted while minimized (hidden and inert), so the chat, scroll and position survive. With an
 * `edge`, the window hangs off that side and folds into the edge tab.
 */
export function FloatingDock({
  api,
  panelVariant = "dock",
  edge,
}: {
  api: DockApi;
  panelVariant?: CopilotPanelVariant;
  edge?: CopilotFloatingEdge;
}) {
  return (
    <CopilotFloatingWindow
      panelVariant={panelVariant}
      edge={edge}
      minimized={api.state === "minimized"}
      onMinimize={api.minimize}
      onClose={api.close}
    />
  );
}
