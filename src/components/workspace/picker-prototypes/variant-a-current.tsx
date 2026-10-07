"use client";

/** PROTOTYPE — variant A: the current picker dialog, unchanged. */

import { useState } from "react";
import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkspacePickerDialog } from "@/components/workspace/workspace-picker-dialog";
import type { FolderPickerVariantProps } from "./types";

export function VariantA({
  value,
  onChange,
  disabled,
  isSelectable,
  title,
}: FolderPickerVariantProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Browse workspace folders"
        title="Browse workspace folders"
        disabled={disabled}
        onClick={() => {
          setOpen(true);
        }}
      >
        <FolderOpen />
      </Button>
      <WorkspacePickerDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        initialPath={value}
        isSelectable={isSelectable}
        onSelect={onChange}
      />
    </>
  );
}
