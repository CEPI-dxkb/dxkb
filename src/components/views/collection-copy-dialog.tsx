"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type CopyColumnMode = "all" | "visible";

interface CollectionCopyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Plural collection label, e.g. "Strains" or "Genomes". */
  label: string;
  selectedCount: number;
  onCopy: (
    columnMode: CopyColumnMode,
    includeHeaders: boolean,
  ) => Promise<void>;
}

const copyChoices = [
  {
    label: "All Columns (with headers)",
    columnMode: "all",
    includeHeaders: true,
  },
  {
    label: "All Columns (without headers)",
    columnMode: "all",
    includeHeaders: false,
  },
  {
    label: "Selected Columns (with headers)",
    columnMode: "visible",
    includeHeaders: true,
  },
  {
    label: "Selected Columns (without headers)",
    columnMode: "visible",
    includeHeaders: false,
  },
] as const;

export function CollectionCopyDialog({
  open,
  onOpenChange,
  label,
  selectedCount,
  onCopy,
}: CollectionCopyDialogProps) {
  const [copyingChoice, setCopyingChoice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCopy = async (choice: (typeof copyChoices)[number]) => {
    setCopyingChoice(choice.label);
    setError(null);
    try {
      await onCopy(choice.columnMode, choice.includeHeaders);
      onOpenChange(false);
    } catch (copyError) {
      setError(
        copyError instanceof Error
          ? copyError.message
          : `Unable to copy selected ${label.toLowerCase()}`,
      );
    } finally {
      setCopyingChoice(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Copy selected {label} ({selectedCount.toLocaleString()})
          </DialogTitle>
          <DialogDescription>
            Copy the selected rows as tab-separated values. Selected Columns
            means columns currently visible in the table.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {copyChoices.map((choice) => (
            <Button
              key={choice.label}
              variant="outline"
              disabled={copyingChoice !== null}
              onClick={() => void handleCopy(choice)}
            >
              {copyingChoice === choice.label ? "Copying..." : choice.label}
            </Button>
          ))}
        </div>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
