"use client";

import { useCallback } from "react";
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/services/workspace/helpers";
import type { WorkspaceBrowserItem } from "@/types/workspace-browser";
import { WorkspaceItemHeader } from "@/components/workspace/workspace-item-header";
import { WorkspaceItemDetails } from "@/components/workspace/workspace-item-details";
import { Separator } from "@/components/ui/separator";

import { FileViewerContent } from "./file-viewer-content";
import { getProxyUrl } from "./file-viewer-registry";

interface FileViewerPanelProps {
  item: WorkspaceBrowserItem;
  onClose: () => void;
}

export function FileViewerPanel({ item, onClose }: FileViewerPanelProps) {
  const handleOpenInNewTab = useCallback(() => {
    window.open(getProxyUrl(item.path), "_blank");
  }, [item.path]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <WorkspaceItemHeader item={item} onClose={onClose}>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleOpenInNewTab}
          title="Open in new tab"
        >
          <ExternalLink />
        </Button>
      </WorkspaceItemHeader>

      <WorkspaceItemDetails item={item} defaultExpanded={false}>
        <div>
          <dt className="text-muted-foreground">Size</dt>
          <dd>{formatFileSize(item.size) || "\u2014"}</dd>
        </div>
      </WorkspaceItemDetails>

      <Separator />

      <div className="min-h-0 flex-1 overflow-hidden">
        <FileViewerContent key={item.path} item={item} />
      </div>
    </div>
  );
}
