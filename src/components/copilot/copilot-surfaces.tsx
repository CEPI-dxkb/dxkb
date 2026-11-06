"use client";

import dynamic from "next/dynamic";
import { useId } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { useCopilot } from "./copilot-provider";

function PanelLoading() {
  return (
    <div className="flex size-full items-center justify-center">
      <Spinner />
    </div>
  );
}

// The chat (markdown, scroller) loads on first open, so it is not in the
// bundle of every route that shows the navbar button.
const CopilotPanel = dynamic(
  () => import("./copilot-panel").then((module) => module.CopilotPanel),
  { ssr: false, loading: PanelLoading },
);
const CopilotFloatingWindow = dynamic(
  () =>
    import("./copilot-floating-window").then(
      (module) => module.CopilotFloatingWindow,
    ),
  { ssr: false },
);

function CopilotSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const titleId = useId();
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent
        side="right"
        size="wide"
        showCloseButton={false}
        aria-labelledby={titleId}
      >
        {open && <CopilotPanel variant="sheet" titleId={titleId} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

/**
 * The side panel or the floating window, whichever is open. Mounted once in
 * the root layout; the full page renders its own panel.
 */
export function CopilotSurfaces() {
  const { available, openSurface, close } = useCopilot();
  if (!available) return null;
  return (
    <>
      <CopilotSheet open={openSurface === "sheet"} onClose={close} />
      {openSurface === "floating" && <CopilotFloatingWindow onClose={close} />}
    </>
  );
}
