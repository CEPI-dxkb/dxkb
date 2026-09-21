"use client";

import { useEffect, useRef, useState } from "react";
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
  const [lastOpen, setLastOpen] = useState(open);
  /**
   * Identifies the current dialog session so a copy that resolves after the dialog
   * was closed cannot close, error, or unblock a later session.
   */
  const sessionRef = useRef(0);
  useEffect(() => {
    // Every open/close transition — including one driven by the parent — ends the
    // previous session, so any copy still in flight is no longer current.
    sessionRef.current += 1;
  }, [open]);

  // Each opening starts with clean local state rather than the last session's error.
  if (lastOpen !== open) {
    setLastOpen(open);
    setCopyingChoice(null);
    setError(null);
  }

  const handleCopy = async (choice: (typeof copyChoices)[number]) => {
    const session = sessionRef.current;
    setCopyingChoice(choice.label);
    setError(null);
    try {
      await onCopy(choice.columnMode, choice.includeHeaders);
      if (session === sessionRef.current) onOpenChange(false);
    } catch (copyError) {
      if (session === sessionRef.current) {
        setError(
          copyError instanceof Error
            ? copyError.message
            : `Unable to copy selected ${label.toLowerCase()}`,
        );
      }
    }
    if (session === sessionRef.current) setCopyingChoice(null);
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
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
