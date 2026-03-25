"use client";

import { useCallback } from "react";
import { ClipboardCopy, Download, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailPanel } from "@/components/detail-panel";
import { WorkspaceItemIcon } from "@/components/workspace/workspace-item-icon";
import { formatFileSize } from "@/lib/services/workspace/helpers";
import type { WorkspaceBrowserItem } from "@/types/workspace-browser";

import { FileViewerContent } from "./file-viewer-content";
import { getProxyUrl } from "./file-viewer-registry";

interface FileViewerPanelProps {
  item: WorkspaceBrowserItem;
  onClose: () => void;
}

function formatOwner(ownerId: string): string {
  if (!ownerId) return "\u2014";
  return ownerId.replace(/@bvbrc$/, "");
}

function formatDate(value: string): string {
  if (!value) return "\u2014";
  const date = new Date(value);
  return date.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function FileViewerPanel({ item, onClose }: FileViewerPanelProps) {
  const proxyUrl = getProxyUrl(item.path);
  const formattedSize = formatFileSize(item.size);

  const handleDownload = useCallback(() => {
    const anchor = document.createElement("a");
    anchor.href = proxyUrl;
    anchor.download = item.name;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }, [proxyUrl, item.name]);

  const handleCopyPath = useCallback(() => {
    navigator.clipboard.writeText(item.path);
    toast.success("Path copied to clipboard");
  }, [item.path]);

  const handleOpenInNewTab = useCallback(() => {
    window.open(proxyUrl, "_blank");
  }, [proxyUrl]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="min-w-0 truncate text-sm font-medium">
          {item.name}
        </span>

        {item.type && <Badge variant="outline">{item.type}</Badge>}

        {formattedSize && (
          <span className="shrink-0 text-xs text-muted-foreground">
            {formattedSize}
          </span>
        )}

        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleDownload}
            title="Download file"
          >
            <Download />
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleCopyPath}
            title="Copy path"
          >
            <ClipboardCopy />
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleOpenInNewTab}
            title="Open in new tab"
          >
            <ExternalLink />
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            title="Close"
          >
            <X />
          </Button>
        </div>
      </div>

      {/* File content preview */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <FileViewerContent key={item.path} item={item} />
      </div>

      {/* Collapsible metadata section */}
      <DetailPanel.CollapsibleSection label="Details" defaultExpanded={false}>
        <div className="space-y-3 px-3 py-3 text-xs">
          <div className="flex items-center gap-2">
            <WorkspaceItemIcon type={item.type} className="h-5 w-5" />
            <span className="font-medium capitalize text-muted-foreground">
              {item.type || "\u2014"}
            </span>
          </div>

          <dl className="grid gap-1.5">
            <div>
              <dt className="text-muted-foreground">Owner</dt>
              <dd className="break-all">{formatOwner(item.owner_id)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd>{formatDate(item.creation_time)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Size</dt>
              <dd>{formattedSize || "\u2014"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Path</dt>
              <dd className="break-all font-mono text-[11px]">{item.path}</dd>
            </div>
          </dl>
        </div>
      </DetailPanel.CollapsibleSection>
    </div>
  );
}
