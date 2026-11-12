"use client";

import dynamic from "next/dynamic";
import { useId } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { useCopilot } from "./copilot-provider";
import { useAskClarkVariant } from "./prototype/dock-state"; // PROTOTYPE (DXKBCORE-342)

function PanelLoading() {
  return (
    <div className="flex size-full items-center justify-center">
      <Spinner />
    </div>
  );
}

// The chat (markdown, scroller) loads on first open, keeping it out of every route's bundle.
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

export function CopilotSurfaces() {
  const { available, openSurface, close } = useCopilot();
  // PROTOTYPE (DXKBCORE-342): a variant draws its own dock.
  const prototypeVariant = useAskClarkVariant();
  if (!available || prototypeVariant) return null;
  return (
    <>
      <CopilotSheet open={openSurface === "sheet"} onClose={close} />
      {openSurface === "floating" && <CopilotFloatingWindow onClose={close} />}
    </>
  );
}
