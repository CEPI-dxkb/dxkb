"use client";

import dynamic from "next/dynamic";
import { useUiPreference } from "@/lib/ui-preferences/provider";
import { CopilotEdgeTab } from "./copilot-edge-tab";
import { useCopilot } from "./copilot-provider";
import { CopilotSideDock } from "./copilot-side-dock";

// The window (and the chat in it) loads on first open, keeping it out of every route's bundle.
const CopilotFloatingWindow = dynamic(
  () =>
    import("./copilot-floating-window").then(
      (module) => module.CopilotFloatingWindow,
    ),
  { ssr: false },
);

/** The open chat, as the side panel or the floating window, both on the edge tab's side; minimized, the tab too. */
export function CopilotSurfaces() {
  const { openSurface, minimized, minimize, close } = useCopilot();
  const [tab, setTab] = useUiPreference("copilotTab");
  if (openSurface === null) return null;
  return (
    <>
      {openSurface === "floating" ? (
        <CopilotFloatingWindow
          edge={tab}
          minimized={minimized}
          onMinimize={minimize}
          onClose={close}
        />
      ) : (
        <CopilotSideDock
          side={tab.side}
          minimized={minimized}
          onMinimize={minimize}
          onClose={close}
        />
      )}
      {/* The tab arrives as the window or panel finishes folding away. */}
      {minimized && <CopilotEdgeTab placement={tab} onPlace={setTab} />}
    </>
  );
}
