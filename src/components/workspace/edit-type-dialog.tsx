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
import type { WorkspaceBrowserItem } from "@/types/workspace-browser";

export interface EditTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Single item whose type is being changed */
  item: WorkspaceBrowserItem | null;
  onConfirm: (newType: string) => Promise<void>;
  isUpdating: boolean;
}

export function EditTypeDialog({
  open,
  onOpenChange,
  item,
  onConfirm,
  isUpdating,
}: EditTypeDialogProps) {
  const currentType = item?.type ?? "";
  const [selectedType, setSelectedType] = React.useState(currentType);

  React.useEffect(() => {
    if (open && item) {
      setSelectedType(item.type ?? "");
    }
  }, [open, item]);

  const handleSave = React.useCallback(async () => {
    if (!selectedType.trim()) return;
    try {
      await onConfirm(selectedType.trim());
      onOpenChange(false);
    } catch (err) {
      // Parent typically handles errors (e.g. toast). Log if rejection is unexpected.
      console.error("[EditTypeDialog] onConfirm failed:", err);
    }
  }, [selectedType, onConfirm, onOpenChange]);

  const canSave = selectedType.trim().length > 0 && !isUpdating;
  const itemLabel = item?.name ?? "item";

  const options = React.useMemo(() => {
    const set = new Set(editTypeOptions);
    if (currentType && !set.has(currentType)) {
      return [currentType, ...editTypeOptions].sort((a, b) =>
        a.localeCompare(b),
      );
    }
    return editTypeOptions;
  }, [currentType]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Change Object Type</DialogTitle>
        <div className="flex flex-col gap-2 py-2">
          <label
            className="text-muted-foreground text-xs font-medium"
            htmlFor="edit-type-select"
          >
            Select a new type…
          </label>
          <Select
            value={selectedType}
            onValueChange={(value) => setSelectedType(value ?? "")}
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
          {item && (
            <p className="text-muted-foreground text-xs">
              Changing type for: {itemLabel}
            </p>
          )}
        </div>
        <DialogFooter showCloseButton={false}>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUpdating}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {isUpdating ? (
              <>
                <Spinner className="mr-2 h-3.5 w-3.5 shrink-0" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
