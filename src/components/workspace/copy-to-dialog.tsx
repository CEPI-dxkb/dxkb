"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { WorkspaceMiniBrowser } from "./workspace-mini-browser";
import { WorkspaceBrowserItem } from "@/types/workspace-browser";

export interface CopyToDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceItems: WorkspaceBrowserItem[];
  currentUserWorkspaceRoot: string;
  onConfirm: (destinationPath: string, filenameOverride?: string) => Promise<void>;
  isCopying: boolean;
}

export function CopyToDialog({
  open,
  onOpenChange,
  sourceItems,
  currentUserWorkspaceRoot,
  onConfirm,
  isCopying,
}: CopyToDialogProps) {
  const [destinationPath, setDestinationPath] = React.useState<string | null>(
    null,
  );
  const [customFilename, setCustomFilename] = React.useState("");
  const [showAllFiles, setShowAllFiles] = React.useState(false);

  const homePath = `${currentUserWorkspaceRoot}/home`;

  React.useEffect(() => {
    if (!open) {
      setDestinationPath(null);
      setCustomFilename("");
    } else {
      setCustomFilename(sourceItems[0]?.name ?? "");
    }
  }, [open, sourceItems]);

  const handleConfirm = React.useCallback(() => {
    if (destinationPath == null) return;
    const filenameOverride =
      customFilename.trim() && customFilename !== sourceItems[0]?.name
        ? customFilename.trim()
        : undefined;
    onConfirm(destinationPath, filenameOverride).catch(() => {
      // Error shown by parent (e.g. toast)
    });
  }, [destinationPath, customFilename, sourceItems, onConfirm]);

  const canConfirm = destinationPath != null && !isCopying;
  const n = sourceItems.length;
  const title = `Copy contents of ${n} ${n === 1 ? "item" : "items"} to…`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-full max-w-2xl overflow-hidden sm:max-w-2xl">
        <div className="flex min-h-0 flex-col gap-4">
          <DialogTitle className="pr-8">{title}</DialogTitle>

          <div className="flex flex-col gap-2">
            <label className="text-muted-foreground text-xs font-medium">
              Destination
            </label>
            <div
              className="bg-muted/50 rounded-md border px-3 py-2 font-mono text-sm"
              title={destinationPath ?? undefined}
            >
              {destinationPath ?? "Select a folder below"}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label
              className="text-muted-foreground text-xs font-medium"
              htmlFor="copy-dialog-filename"
            >
              Filename
            </label>
            <Input
              id="copy-dialog-filename"
              value={customFilename}
              onChange={(e) => setCustomFilename(e.target.value)}
              placeholder="Name for the copied file"
              className="font-mono text-sm"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <WorkspaceMiniBrowser
              initialPath={homePath}
              onSelectPath={setDestinationPath}
              mode={showAllFiles ? "all" : "folders-only"}
              showHidden={showAllFiles}
              selectedPath={destinationPath}
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={showAllFiles}
                onCheckedChange={(checked) =>
                  setShowAllFiles(checked === true)
                }
              />
              <span>Show all files and folders</span>
            </label>
          </div>
        </div>

        <DialogFooter showCloseButton={false} className="mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCopying}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {isCopying ? (
              <>
                <Spinner className="mr-2 h-3.5 w-3.5 shrink-0" />
                Copying…
              </>
            ) : (
              "OK"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
