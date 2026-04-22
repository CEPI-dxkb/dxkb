"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogHeader,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { WorkspaceMiniBrowser } from "./workspace-mini-browser";
import { WorkspaceBrowserItem } from "@/types/workspace-browser";
import { isFolder } from "@/lib/services/workspace/utils";

export interface CopyToDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceItems: WorkspaceBrowserItem[];
  currentUserWorkspaceRoot: string;
  onConfirm: (destinationPath: string, filenameOverride?: string) => Promise<void>;
  isCopying: boolean;
  /** When "move", dialog shows Move wording and the parent calls API with move: true. */
  mode?: "copy" | "move";
}

export function CopyToDialog({
  open,
  onOpenChange,
  sourceItems,
  currentUserWorkspaceRoot,
  onConfirm,
  isCopying,
  mode = "copy",
}: CopyToDialogProps) {
  const [destinationPath, setDestinationPath] = React.useState<string | null>(
    null,
  );
  const [customFilename, setCustomFilename] = React.useState("");
  const [showAllFiles, setShowAllFiles] = React.useState(false);

  const workspaceRootPath =
    currentUserWorkspaceRoot.startsWith("/")
      ? currentUserWorkspaceRoot
      : `/${currentUserWorkspaceRoot}`;
  const [prevOpen, setPrevOpen] = React.useState(open);

  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) {
      setDestinationPath(null);
      setCustomFilename("");
    } else {
      // Initialize only on false → true transitions so parent re-renders
      // passing a new sourceItems reference don't reset customFilename.
      setDestinationPath(workspaceRootPath);
      setCustomFilename(sourceItems[0]?.name ?? "");
      setShowAllFiles(false);
    }
  }

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

  const destinationIsRoot =
    destinationPath != null && destinationPath === workspaceRootPath;
  const hasNonFolderSource = sourceItems.some(
    (item) => !isFolder(item.type),
  );
  const rootWithIncompatibleTypes = destinationIsRoot && hasNonFolderSource;

  const canConfirm =
    destinationPath != null && !isCopying && !rootWithIncompatibleTypes;
  const n = sourceItems.length;
  const title =
    mode === "move"
      ? `Move contents of ${n} ${n === 1 ? "item" : "items"} to…`
      : `Copy contents of ${n} ${n === 1 ? "item" : "items"} to…`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="scrollbar-themed flex max-h-[90vh] md:max-h-[70vh] h-full max-w-lg flex-col overflow-hidden sm:max-w-xl md:max-w-2xl lg:max-w-4xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="pr-8">{title}</DialogTitle>
        </DialogHeader>
        <div className="-mx-4 flex min-h-0 flex-1 flex-col gap-4 px-4 pt-1">
          <div className="flex shrink-0 flex-col gap-2">
            <Label className="text-muted-foreground text-xs font-medium">
              Destination
            </Label>
            <Input
              title={destinationPath ?? undefined}
              disabled
              value={destinationPath ?? "Select a folder below"}
            />
          </div>

          <div className="flex shrink-0 flex-col gap-2">
            <Label
              className="text-muted-foreground text-xs font-medium"
              htmlFor="copy-dialog-filename"
            >
              Filename
            </Label>
            <Input
              id="copy-dialog-filename"
              value={customFilename}
              onChange={(e) => setCustomFilename(e.target.value)}
              placeholder={
                mode === "move"
                  ? "Name for the moved file"
                  : "Name for the copied file"
              }
              className="font-mono text-sm"
            />
          </div>

            <WorkspaceMiniBrowser
              className="min-h-0 flex-1"
              initialPath={workspaceRootPath}
              workspaceRoot={workspaceRootPath}
              onSelectPath={setDestinationPath}
              mode={showAllFiles ? "all" : "folders-only"}
              showHidden={showAllFiles}
              selectedPath={destinationPath}
            />

          <div className="flex shrink-0 items-center">
            <Label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={showAllFiles}
                onCheckedChange={(checked) =>
                  setShowAllFiles(checked === true)
                }
              />
              <span>Show all files and folders</span>
            </Label>
          </div>
        </div>

        <DialogFooter className="shrink-0">
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
                {mode === "move" ? "Moving…" : "Copying…"}
              </>
            ) : mode === "move" ? (
              "Move"
            ) : (
              "Copy"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
