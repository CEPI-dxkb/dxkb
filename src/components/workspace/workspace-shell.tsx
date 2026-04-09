"use client";

import type { ReactNode } from "react";
import {
  useWorkspacePanel,
  workspacePanelIds,
} from "@/contexts/workspace-panel-context";
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
import type { WorkspaceBrowserItem } from "@/types/workspace-browser";

interface WorkspaceShellProps {
  children: ReactNode;
  actionBar: ReactNode;
  selectedItems: WorkspaceBrowserItem[];
}

export function WorkspaceShell({
  children,
  actionBar,
  selectedItems,
}: WorkspaceShellProps) {
  const {
    panelManuallyHidden: _panelManuallyHidden,
    setPanelManuallyHidden,
    panelExpanded,
    setPanelExpanded,
    panelInitialLayout,
    setPanelLayout,
  } = useWorkspacePanel();

  const actionStrip = (
    <div className="border-border/50 bg-muted/50 flex h-full w-[80px] shrink-0 flex-col rounded-l-lg border-r py-2">
      <div className="relative mx-0.5 mb-1 h-8 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className={`absolute inset-0 h-full w-full justify-start gap-1 font-normal ${
            panelExpanded ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
          onClick={() => {
            setPanelManuallyHidden(false);
            setPanelExpanded(true);
          }}
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
          onClick={() => {
            setPanelManuallyHidden(true);
            setPanelExpanded(false);
          }}
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
    <div className="flex h-full w-full flex-col overflow-hidden px-4 py-2">
      <DetailPanel.Header title="Nothing selected" />
      <DetailPanel.EmptyState message="Select an item to view details" />
    </div>
  );

  if (!panelExpanded) {
    return (
      <div className="flex h-full min-h-0 w-full flex-row gap-0">
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
        <aside className="bg-muted/30 flex min-h-full shrink-0 rounded-tl-lg rounded-bl-lg border-l">
          {actionStrip}
        </aside>
      </div>
    );
  }

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="h-full min-h-0 w-full"
      defaultLayout={panelInitialLayout}
      onLayoutChanged={setPanelLayout}
    >
      <ResizablePanel
        id={workspacePanelIds.main}
        defaultSize={panelInitialLayout[workspacePanelIds.main] ?? 60}
        minSize="30%"
        maxSize="100%"
        className="flex h-full min-h-0 flex-row overflow-hidden"
      >
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
        <aside className="bg-muted/30 flex min-h-full shrink-0 rounded-tl-lg rounded-bl-lg border-l">
          {actionStrip}
        </aside>
      </ResizablePanel>
      <ResizableHandle withHandle className="shrink-0" />
      <ResizablePanel
        id={workspacePanelIds.details}
        defaultSize={panelInitialLayout[workspacePanelIds.details] ?? 40}
        minSize="10%"
        maxSize="70%"
        className="flex min-h-0 flex-col overflow-hidden"
      >
        {detailsPanelContent}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
