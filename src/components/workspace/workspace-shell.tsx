"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { workspacePanelIds } from "@/constants/workspace-panels";
import { useWorkspacePanel } from "@/contexts/workspace-panel-context";
import { useUiPreference } from "@/lib/ui-preferences/provider";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InfoPanel } from "@/components/detail-panel/info-panel";
import { DetailPanel } from "@/components/detail-panel";
import { isViewableType } from "@/components/workspace/file-viewer/file-viewer-registry";
import { isFolderType } from "@/lib/services/workspace/utils";
import { FileViewerPanel } from "@/components/workspace/file-viewer/file-viewer-panel";
import type { WorkspaceItem } from "@/lib/services/workspace/domain";

const closedLayout = {
  [workspacePanelIds.main]: 100,
  [workspacePanelIds.details]: 0,
};

interface WorkspaceShellProps {
  children: ReactNode;
  actionBar: ReactNode;
  selectedItems: WorkspaceItem[];
}

export function WorkspaceShell({
  children,
  actionBar,
  selectedItems,
}: WorkspaceShellProps) {
  const {
    setPanelManuallyHidden,
    panelExpanded,
    setPanelExpanded,
  } = useWorkspacePanel();
  const [savedLayout, setSavedLayout] = useUiPreference("workspacePanelLayout");
  // The group reads defaultLayout only when it mounts. Snapshotting keeps saved drags
  // from feeding back into a mounted group, while each remount (folder navigation)
  // starts from the latest saved split rather than the one from page load. A closed
  // panel mounts closed, so the server HTML never paints it open at the saved width;
  // opening goes through resize() below.
  const [initialLayout] = useState(panelExpanded ? savedLayout : closedLayout);
  const detailsPanelRef = useRef<PanelImperativeHandle>(null);

  useLayoutEffect(() => {
    const panel = detailsPanelRef.current;
    if (!panel) return;
    if (!panelExpanded) {
      panel.collapse();
    } else if (panel.isCollapsed()) {
      // resize, not expand(): expand() returns to the size before an *imperative*
      // collapse, and falls back to minSize after the user drags the panel shut.
      panel.resize(`${String(savedLayout[workspacePanelIds.details])}%`);
    }
  }, [panelExpanded, savedLayout]);

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
            setPanelManuallyHidden(false);
            setPanelExpanded(true);
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
          onClick={() => {
            setPanelManuallyHidden(true);
            setPanelExpanded(false);
          }}
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

  const singleItem = selectedItems.length === 1 ? selectedItems[0] : null;
  const showFilePreview =
    singleItem !== null &&
    !isFolderType(singleItem.type) &&
    isViewableType(singleItem.type, singleItem.name);

  const detailsPanelContent = showFilePreview ? (
    <FileViewerPanel
      item={singleItem}
      onClose={() => {
        setPanelManuallyHidden(true);
        setPanelExpanded(false);
      }}
    />
  ) : selectedItems.length > 0 ? (
    <InfoPanel
      variant="workspace"
      selection={selectedItems}
      onClose={() => {
        setPanelManuallyHidden(true);
        setPanelExpanded(false);
      }}
    />
  ) : (
    <div className="flex size-full flex-col overflow-hidden px-4 py-2">
      <DetailPanel.Header title="Nothing selected" />
      <DetailPanel.EmptyState message="Select an item to view details" />
    </div>
  );

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="size-full min-h-0"
      defaultLayout={initialLayout}
      onLayoutChanged={(layout, meta) => {
        // Mount, window resizes and imperative open/close are not the user's choice
        // of width. Only a drag or keyboard resize is saved.
        if (!meta.isUserInteraction) return;
        const main = layout[workspacePanelIds.main] ?? 0;
        const details = layout[workspacePanelIds.details] ?? 0;
        setPanelExpanded(details > 0);
        if (details > 0) {
          setSavedLayout({
            [workspacePanelIds.main]: main,
            [workspacePanelIds.details]: details,
          });
        }
      }}
    >
      <ResizablePanel
        id={workspacePanelIds.main}
        defaultSize={`${String(initialLayout[workspacePanelIds.main])}%`}
        minSize="30%"
        maxSize="100%"
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
        id={workspacePanelIds.details}
        defaultSize={`${String(initialLayout[workspacePanelIds.details])}%`}
        minSize="10%"
        maxSize="70%"
        collapsible
        collapsedSize={0}
        className="flex min-h-0 flex-col overflow-hidden"
      >
        <div
          className="flex min-h-0 flex-1 flex-col"
          tabIndex={0}
          aria-label="Workspace details"
        >
          {detailsPanelContent}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
