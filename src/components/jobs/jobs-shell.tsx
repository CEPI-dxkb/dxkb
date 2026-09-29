"use client";

import { useRef, useState, type ReactNode } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { jobsPanelIds } from "@/constants/jobs-panels";
import { useUiPreference } from "@/lib/ui-preferences/provider";

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
  const [savedLayout, setSavedLayout] = useUiPreference("jobsPanelLayout");
  // Read once: the group only honours defaultLayout on mount.
  const [initialLayout] = useState(savedLayout);

  const handleResize = (size: { asPercentage: number }) => {
    const collapsed = size.asPercentage === 0;
    if (collapsed && panelExpanded) setPanelExpanded(false);
    else if (!collapsed && !panelExpanded) setPanelExpanded(true);
  };

  const actionStrip = (
    <div className="flex h-full w-20 shrink-0 flex-col rounded-l-lg border-r border-border/50 bg-muted/50 py-2">
      <div className="relative mx-0.5 mb-1 h-8 shrink-0">
        <Button
          variant="ghost"
          size="panel-toggle"
          className={`absolute inset-0 size-full justify-start ${
            panelExpanded ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
          onClick={() => {
            const panel = detailsPanelRef.current;
            // resize, not expand(): expand() returns to the size before an *imperative*
            // collapse, and falls back to minSize after the user drags the panel shut.
            if (panel?.isCollapsed()) {
              panel.resize(`${String(savedLayout[jobsPanelIds.details])}%`);
            }
          }}
          title="Show details panel"
        >
          <PanelRightOpen className="size-4 shrink-0" />
          Show
        </Button>
        <Button
          variant="ghost"
          size="panel-toggle"
          className={`absolute inset-0 size-full justify-start ${
            panelExpanded ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={() => detailsPanelRef.current?.collapse()}
          title="Hide panel"
        >
          <PanelRightClose className="size-4 shrink-0" />
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
      className="size-full min-h-0"
      defaultLayout={initialLayout}
      onLayoutChanged={(layout, meta) => {
        if (!meta.isUserInteraction) return;
        const details = layout[jobsPanelIds.details] ?? 0;
        if (details > 0) {
          setSavedLayout({
            [jobsPanelIds.main]: layout[jobsPanelIds.main] ?? 0,
            [jobsPanelIds.details]: details,
          });
        }
      }}
    >
      <ResizablePanel
        id={jobsPanelIds.main}
        defaultSize={`${String(initialLayout[jobsPanelIds.main])}%`}
        minSize="50%"
        className="flex h-full min-h-0 flex-row overflow-hidden"
      >
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
        <aside className="flex min-h-full shrink-0 rounded-l-lg border-l bg-muted/30">
          {actionStrip}
        </aside>
      </ResizablePanel>
      <ResizableHandle
        withHandle={panelExpanded}
        className={`shrink-0 ${panelExpanded ? "" : "w-0 opacity-0"}`}
      />
      <ResizablePanel
        panelRef={detailsPanelRef}
        id={jobsPanelIds.details}
        defaultSize={`${String(initialLayout[jobsPanelIds.details])}%`}
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
