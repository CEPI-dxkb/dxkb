import { Eye, EyeOff, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DialogClose,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PickerTarget } from "@/lib/services/workspace/picker-views";
import { FolderPickerAcceptedTypes } from "./folder-picker-accepted-types";

interface FolderPickerHeaderProps {
  title: string;
  target: PickerTarget;
  showFiles: boolean;
  onShowFilesChange: (showFiles: boolean) => void;
  isUploading: boolean;
}

export function FolderPickerHeader({
  title,
  target,
  showFiles,
  onShowFilesChange,
  isUploading,
}: FolderPickerHeaderProps) {
  const isPickingFiles = target.kind === "object";
  return (
    <DialogHeader>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {target.kind === "object" ? (
              <>
                Click a folder to open it. Double-click a file, or press Enter,
                to choose it. <FolderPickerAcceptedTypes types={target.types} />
              </>
            ) : (
              "Click a folder to open it. Double-click it, or press Enter, to choose it."
            )}
          </DialogDescription>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <KeyboardHints />
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={showFiles}
            onClick={() => {
              onShowFilesChange(!showFiles);
            }}
          >
            {showFiles ? (
              <EyeOff data-icon="inline-start" />
            ) : (
              <Eye data-icon="inline-start" />
            )}
            {isPickingFiles
              ? showFiles
                ? "Hide other files"
                : "Show other files"
              : showFiles
                ? "Hide files"
                : "Show files"}
          </Button>
          {/* Disabled, not hidden, mid-upload so the row doesn't shift; the
             dialog's own corner button sits 8px higher than the rest of the row. */}
          <DialogClose
            disabled={isUploading}
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Close"
                title="Close"
              >
                <XIcon />
              </Button>
            }
          />
        </div>
      </div>
    </DialogHeader>
  );
}

function KeyboardHints() {
  return (
    <div
      aria-hidden
      className="hidden shrink-0 items-center gap-1.5 pt-0.5 text-2xs text-muted-foreground md:flex"
    >
      <Kbd>↑</Kbd>
      <Kbd>↓</Kbd>
      <span className="mr-1.5">move</span>
      <Kbd>←</Kbd>
      <Kbd>→</Kbd>
      <span className="mr-1.5">close / open</span>
      <Kbd>↵</Kbd>
      <span>choose</span>
    </div>
  );
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="flex h-5 min-w-5 items-center justify-center rounded border bg-muted px-1 font-mono text-2xs text-foreground/80">
      {children}
    </kbd>
  );
}
