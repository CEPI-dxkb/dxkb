"use client";

import { useCallback } from "react";
import { ClipboardCopy, Download, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { triggerDownload } from "@/lib/utils";
import { formatFileSize } from "@/lib/services/workspace/helpers";
import { getProxyUrl } from "@/components/workspace/file-viewer/file-viewer-registry";
import type { WorkspaceBrowserItem } from "@/types/workspace-browser";

interface WorkspaceItemHeaderProps {
  item: WorkspaceBrowserItem;
  onClose?: () => void;
  children?: React.ReactNode;
}

export function WorkspaceItemHeader({
  item,
  onClose,
  children,
}: WorkspaceItemHeaderProps) {
  const proxyUrl = getProxyUrl(item.path);
  const formattedSize = formatFileSize(item.size);

  const handleDownload = useCallback(() => {
    triggerDownload(proxyUrl, item.name);
  }, [proxyUrl, item.name]);

  const handleCopyPath = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(item.path);
      toast.success("Path copied to clipboard");
    } catch {
      toast.error("Failed to copy path to clipboard");
    }
  }, [item.path]);

  return (
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
        <Button variant="ghost" size="icon-sm" onClick={handleDownload} title="Download file">
          <Download />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={handleCopyPath} title="Copy path">
          <ClipboardCopy />
        </Button>
        {children}
        {onClose && (
          <Button variant="ghost" size="icon-sm" onClick={onClose} title="Close">
            <X />
          </Button>
        )}
      </div>
    </div>
  );
}
