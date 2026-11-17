import type { ReactNode } from "react";
import { FolderPlus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FolderPickerToolbarProps {
  /** A file picker can't create folders, so it shows Upload alone. */
  showNewFolder: boolean;
  isUploadOpen: boolean;
  /** From `toolbarUnavailableReason`: null when both actions can be used. */
  unavailableReason: string | null;
  onNewFolder: () => void;
  onUpload: () => void;
}

/**
 * One row under the dialog header, above the places and the columns. It sits outside
 * the strip's wrapper so the strip's motion overlay and measurements never see it.
 * `-mb-4` cancels the dialog's `gap-4` so the body's own top border meets the row.
 */
export function FolderPickerToolbar({
  showNewFolder,
  isUploadOpen,
  unavailableReason,
  onNewFolder,
  onUpload,
}: FolderPickerToolbarProps) {
  return (
    <div
      role="group"
      aria-label="Folder actions"
      className="-mx-4 -mb-4 flex shrink-0 items-center gap-2 border-t px-4 py-2"
    >
      {showNewFolder ? (
        <ToolbarAction
          icon={<FolderPlus data-icon="inline-start" />}
          label="New folder here"
          unavailableReason={unavailableReason}
          onClick={onNewFolder}
        />
      ) : null}
      <ToolbarAction
        icon={<Upload data-icon="inline-start" />}
        label="Upload here"
        pressed={isUploadOpen}
        unavailableReason={unavailableReason}
        onClick={onUpload}
      />
    </div>
  );
}

/**
 * The tooltip is always mounted and only switched off, so a button never remounts (and
 * never loses focus) when its reason appears or clears.
 */
function ToolbarAction({
  icon,
  label,
  pressed,
  unavailableReason,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  pressed?: boolean;
  unavailableReason: string | null;
  onClick: () => void;
}) {
  return (
    <TooltipProvider>
      <Tooltip disabled={unavailableReason === null}>
        <TooltipTrigger
          render={<span className="inline-flex cursor-not-allowed" />}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={unavailableReason !== null}
            aria-pressed={pressed}
            onClick={onClick}
          >
            {icon}
            {label}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{`${label}: ${unavailableReason ?? ""}`}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
