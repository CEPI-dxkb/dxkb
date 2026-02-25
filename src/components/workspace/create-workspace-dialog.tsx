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
import { toast } from "sonner";

export interface CreateWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateWorkspace: (workspaceName: string) => Promise<void>;
  isCreating: boolean;
}

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
  onCreateWorkspace,
  isCreating,
}: CreateWorkspaceDialogProps) {
  const [workspaceName, setWorkspaceName] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setWorkspaceName("");
    }
  }, [open]);

  const handleCreate = React.useCallback(async () => {
    const name = workspaceName.trim();
    if (!name || isCreating) return;
    try {
      await onCreateWorkspace(name);
      onOpenChange(false);
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.error("Create workspace failed:", err);
      }
      const message =
        err instanceof Error ? err.message : "Failed to create workspace.";
      toast.error(message);
    }
  }, [workspaceName, isCreating, onCreateWorkspace, onOpenChange]);

  const canCreate = workspaceName.trim().length > 0 && !isCreating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle className="text-start">Create Workspace</DialogTitle>
        <div className="flex flex-col gap-2 py-2">
          <label
            className="text-muted-foreground text-xs font-medium"
            htmlFor="create-workspace-input"
          >
            Workspace name
          </label>
          <Input
            id="create-workspace-input"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            placeholder="My Workspace"
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
              "Create Workspace"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
