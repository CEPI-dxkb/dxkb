"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

export interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDeleting: boolean;
  pendingDeleteSelection: { name?: string }[];
  nonEmptyFolderPathsInDelete: string[];
  onConfirmDelete: () => void;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  isDeleting,
  pendingDeleteSelection,
  nonEmptyFolderPathsInDelete,
  onConfirmDelete,
}: DeleteConfirmDialogProps) {
  const [acknowledgeChecked, setAcknowledgeChecked] = useState(false);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setAcknowledgeChecked(false);
    onOpenChange(nextOpen);
  }

  const deleteTargetLabel =
    pendingDeleteSelection.length === 0
      ? "item"
      : pendingDeleteSelection.length === 1
        ? pendingDeleteSelection[0]?.name ?? "item"
        : `${pendingDeleteSelection.length} items`;

  const requiresAcknowledgment = nonEmptyFolderPathsInDelete.length > 0;
  const canDelete =
    !requiresAcknowledgment || (requiresAcknowledgment && acknowledgeChecked);

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogTitle>Delete from workspace</AlertDialogTitle>
        <AlertDialogDescription>
          Are you sure you want to delete
          <span className="font-semibold italic"> {deleteTargetLabel}</span>?
          {requiresAcknowledgment && (
            <span className="block font-bold text-destructive">
              {"\n"}This folder is NOT empty.
            </span>
          )}
          This action cannot be undone.
        </AlertDialogDescription>
        {requiresAcknowledgment && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="delete-acknowledge"
              checked={acknowledgeChecked}
              onCheckedChange={(checked) =>
                setAcknowledgeChecked(checked === true)
              }
              disabled={isDeleting}
            />
            <Label
              htmlFor="delete-acknowledge"
              className="cursor-pointer text-sm font-normal"
            >
              I acknowledge this action not reversible
            </Label>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => void onConfirmDelete()}
            disabled={isDeleting || !canDelete}
          >
            {isDeleting ? (
              <>
                <Spinner className="mr-2 h-3.5 w-3.5 shrink-0" />
                Deleting…
              </>
            ) : (
              "Delete"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
