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

export interface CreateWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateWorkspace: (workspaceName: string) => Promise<void>;
  isCreating: boolean;
}

// State lives inside the form, not the dialog wrapper, so closing the dialog
// unmounts this subtree (base-ui Dialog uses keepMounted={false} by default)
// and state is destroyed. Reopening remounts with fresh state — no explicit
// prop→state sync needed.
function CreateWorkspaceForm({
  onOpenChange,
  onCreateWorkspace,
  isCreating,
}: {
  onOpenChange: (open: boolean) => void;
  onCreateWorkspace: (workspaceName: string) => Promise<void>;
  isCreating: boolean;
}) {
  const [workspaceName, setWorkspaceName] = React.useState("");
  const [createError, setCreateError] = React.useState<string | null>(null);

  const handleCreate = async () => {
    const name = workspaceName.trim();
    if (!name || isCreating) return;
    setCreateError(null);
    try {
      await onCreateWorkspace(name);
      onOpenChange(false);
    } catch (err) {
      // Stay open with the typed name; the handler's toast covers a dialog
      // closed while pending, so this one only shows the reason inline.
      setCreateError(
        `Couldn't create workspace "${name}": ${workspaceErrorMessage(err, "the workspace service returned an error.")}`,
      );
    }
  };

  const canCreate = workspaceName.trim().length > 0 && !isCreating;

  return (
    <>
      <DialogTitle className="text-start">Create Workspace</DialogTitle>
      <div className="flex flex-col gap-2 py-2">
        <label
          className="text-xs font-medium text-muted-foreground"
          htmlFor="create-workspace-input"
        >
          Workspace name
        </label>
        <Input
          id="create-workspace-input"
          value={workspaceName}
          onChange={(e) => {
            setWorkspaceName(e.target.value);
            setCreateError(null);
          }}
          placeholder="My Workspace"
          disabled={isCreating}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (canCreate) void handleCreate();
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
        <Button
          onClick={() => {
            void handleCreate();
          }}
          disabled={!canCreate}
        >
          {isCreating ? (
            <>
              <Spinner className="mr-2 size-3.5 shrink-0" />
              Creating…
            </>
          ) : (
            "Create Workspace"
          )}
        </Button>
      </DialogFooter>
    </>
  );
}

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
  onCreateWorkspace,
  isCreating,
}: CreateWorkspaceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <CreateWorkspaceForm
          onOpenChange={onOpenChange}
          onCreateWorkspace={onCreateWorkspace}
          isCreating={isCreating}
        />
      </DialogContent>
    </Dialog>
  );
}
