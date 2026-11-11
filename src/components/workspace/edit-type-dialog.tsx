"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { editTypeOptions } from "@/lib/services/workspace/types";
import type { WorkspaceItem } from "@/lib/services/workspace/domain";

export interface EditTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: WorkspaceItem | null;
  onConfirm: (newType: string) => Promise<void>;
  isUpdating: boolean;
}

// State lives inside the form so closing the dialog unmounts it and a reopen starts fresh.
function EditTypeForm({
  item,
  onOpenChange,
  onConfirm,
  isUpdating,
}: {
  item: WorkspaceItem;
  onOpenChange: (open: boolean) => void;
  onConfirm: (newType: string) => Promise<void>;
  isUpdating: boolean;
}) {
  const currentType = item.type;
  const [selectedType, setSelectedType] = React.useState(currentType);

  const handleSave = async () => {
    if (!selectedType.trim()) return;
    try {
      await onConfirm(selectedType.trim());
      onOpenChange(false);
    } catch (err) {
      console.error("[EditTypeDialog] onConfirm failed:", err);
    }
  };

  const canSave = selectedType.trim().length > 0 && !isUpdating;

  const options = (() => {
    const set = new Set(editTypeOptions);
    if (currentType && !set.has(currentType)) {
      return [currentType, ...editTypeOptions].sort((a, b) =>
        a.localeCompare(b),
      );
    }
    return editTypeOptions;
  })();

  return (
    <>
      <DialogTitle>Change Object Type</DialogTitle>
      <div className="flex flex-col gap-2 py-2">
        <label
          className="text-xs font-medium text-muted-foreground"
          htmlFor="edit-type-select"
        >
          Select a new type…
        </label>
        <Select
          value={selectedType}
          onValueChange={(value) => {
            setSelectedType(value ?? "");
          }}
          disabled={isUpdating}
        >
          <SelectTrigger id="edit-type-select" className="w-full">
            <SelectValue placeholder="Select a new type…" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {options.map((typeId) => (
                <SelectItem key={typeId} value={typeId}>
                  {typeId}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Changing type for: {item.name}
        </p>
      </div>
      <DialogFooter showCloseButton={false}>
        <Button
          variant="outline"
          onClick={() => {
            onOpenChange(false);
          }}
          disabled={isUpdating}
        >
          Cancel
        </Button>
        <Button
          onClick={() => {
            void handleSave();
          }}
          disabled={!canSave}
        >
          {isUpdating ? (
            <>
              <Spinner className="mr-2 size-3.5 shrink-0" />
              Saving…
            </>
          ) : (
            "Save"
          )}
        </Button>
      </DialogFooter>
    </>
  );
}

export function EditTypeDialog({
  open,
  onOpenChange,
  item,
  onConfirm,
  isUpdating,
}: EditTypeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {item && (
          <EditTypeForm
            item={item}
            onOpenChange={onOpenChange}
            onConfirm={onConfirm}
            isUpdating={isUpdating}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
