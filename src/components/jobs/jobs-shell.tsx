"use client";

import { useRef, useState, useCallback, type ReactNode } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

const JOBS_PANEL_IDS = { main: "jobs-main", details: "jobs-details" } as const;

interface JobsShellProps {
  children: ReactNode;
  actionBar: ReactNode;
  detailsPanel: ReactNode;
}

export function JobsShell({
  children,
  actionBar,
  detailsPanel,
}: JobsShellProps) {
  const detailsPanelRef = useRef<PanelImperativeHandle>(null);
  const [panelExpanded, setPanelExpanded] = useState(true);

  const handleResize = useCallback(
    (size: { asPercentage: number }) => {
      const collapsed = size.asPercentage === 0;
      if (collapsed && panelExpanded) setPanelExpanded(false);
      else if (!collapsed && !panelExpanded) setPanelExpanded(true);
    },
    [panelExpanded],
  );

  const actionStrip = (
    <div className="border-border/50 bg-muted/50 flex h-full w-[80px] shrink-0 flex-col rounded-l-lg border-r py-2">
      <div className="relative mx-0.5 mb-1 h-8 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className={`absolute inset-0 h-full w-full justify-start gap-1 font-normal ${
            panelExpanded ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
          onClick={() => detailsPanelRef.current?.expand()}
          title="Show details panel"
        >
          <PanelRightOpen className="h-4 w-4 shrink-0" />
          Show
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={`absolute inset-0 h-full w-full justify-start gap-1 font-normal ${
            panelExpanded ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={() => detailsPanelRef.current?.collapse()}
          title="Hide panel"
        >
          <PanelRightClose className="h-4 w-4 shrink-0" />
          Hide
        </Button>
      </div>
      <div className="scrollbar-themed min-h-0 flex-1 overflow-y-auto px-1.5">
        {actionBar}
      </div>
    </div>
  );

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="h-full min-h-0 w-full"
    >
      <ResizablePanel
        id={JOBS_PANEL_IDS.main}
        defaultSize="75%"
        minSize="50%"
        className="flex h-full min-h-0 flex-row overflow-hidden"
      >
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
        <aside className="bg-muted/30 flex min-h-full shrink-0 rounded-tl-lg rounded-bl-lg border-l">
          {actionStrip}
        </aside>
      </ResizablePanel>
      <ResizableHandle
        withHandle={panelExpanded}
        className={`shrink-0 ${panelExpanded ? "" : "w-0 opacity-0"}`}
      />
      <ResizablePanel
        panelRef={detailsPanelRef}
        id={JOBS_PANEL_IDS.details}
        defaultSize="20%"
        minSize={110}
        maxSize={600}
        collapsible
        collapsedSize={0}
        onResize={handleResize}
        className="flex min-h-0 flex-col overflow-hidden"
      >
        {detailsPanel}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
