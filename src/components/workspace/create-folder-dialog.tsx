"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { workspaceErrorMessage } from "@/lib/services/workspace/workspace-errors";

export interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Resolves once the folder exists; a rejection keeps the dialog open with the reason. */
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
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [prevOpen, setPrevOpen] = React.useState(open);

  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setFolderName("");
      setCreateError(null);
    }
  }

  const handleCreate = () => {
    const name = folderName.trim();
    if (!name || isCreating) return;
    setCreateError(null);
    onCreateFolder(name).then(
      () => {
        onOpenChange(false);
      },
      (error: unknown) => {
        // Stay open with the typed name, so the user can retry as is.
        setCreateError(
          `Couldn't create folder "${name}": ${workspaceErrorMessage(error, "the workspace service returned an error.")}`,
        );
      },
    );
  };

  const canCreate = folderName.trim().length > 0 && !isCreating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle className="text-start">Create Folder</DialogTitle>
        <div className="flex flex-col gap-2 py-2">
          <label
            className="text-xs font-medium text-muted-foreground"
            htmlFor="create-folder-input"
          >
            Folder name
          </label>
          <Input
            id="create-folder-input"
            value={folderName}
            onChange={(e) => {
              setFolderName(e.target.value);
              setCreateError(null);
            }}
            placeholder="My Folder"
            disabled={isCreating}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (canCreate) handleCreate();
              }
            }}
          />
          {createError && (
            <Alert variant="destructive" size="sm">
              <AlertDescription>{createError}</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter showCloseButton={false}>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!canCreate}>
            {isCreating ? (
              <>
                <Spinner className="mr-2 size-3.5 shrink-0" />
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
