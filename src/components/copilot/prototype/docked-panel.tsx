"use client";

import dynamic from "next/dynamic";
import { useId } from "react";
import { Spinner } from "@/components/ui/spinner";
import type { CopilotPanelVariant } from "../copilot-panel-header";
import type { DockApi } from "./dock-state";

const CopilotPanel = dynamic(
  () => import("../copilot-panel").then((module) => module.CopilotPanel),
  {
    ssr: false,
    loading: () => (
      <div className="flex size-full items-center justify-center">
        <Spinner />
      </div>
    ),
  },
);

/** The real chat panel, with the Minimize button wired. Stays mounted while minimized. */
export function DockedPanel({
  api,
  variant = "dock",
}: {
  api: DockApi;
  variant?: CopilotPanelVariant;
}) {
  const titleId = useId();
  return (
    <CopilotPanel
      variant={variant}
      titleId={titleId}
      onMinimize={api.minimize}
      onClose={api.close}
    />
  );
}
