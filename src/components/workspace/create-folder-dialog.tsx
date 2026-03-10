"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateFolder: (folderName: string) => Promise<void>;
  isCreating: boolean;
}

export function CreateFolderDialog({
  open,
  onOpenChange,
  onCreateFolder,
  isCreating,
}: CreateFolderDialogProps) {
  const [folderName, setFolderName] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setFolderName("");
    }
  }, [open]);

  const handleCreate = React.useCallback(() => {
    const name = folderName.trim();
    if (!name || isCreating) return;
    onCreateFolder(name).then(
      () => onOpenChange(false),
      () => { /* error handled elsewhere */ },
    );
  }, [folderName, isCreating, onCreateFolder, onOpenChange]);

  const canCreate = folderName.trim().length > 0 && !isCreating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle className="text-start">Create Folder</DialogTitle>
        <div className="flex flex-col gap-2 py-2">
          <label
            className="text-muted-foreground text-xs font-medium"
            htmlFor="create-folder-input"
          >
            Folder name
          </label>
          <Input
            id="create-folder-input"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="My Folder"
            disabled={isCreating}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (canCreate) handleCreate();
              }
            }}
          />
        </div>
        <DialogFooter showCloseButton={false}>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!canCreate}>
            {isCreating ? (
              <>
                <Spinner className="mr-2 h-3.5 w-3.5 shrink-0" />
                Creating…
              </>
            ) : (
              "Create Folder"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
