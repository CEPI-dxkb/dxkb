import type { ReactNode } from "react";
import { Eye, EyeOff, FolderPlus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface FolderPickerActionsProps {
  /** A file picker can't create folders, so it shows Upload alone. */
  showNewFolder: boolean;
  /** From `actionsUnavailableReason`: null when New folder and Upload can be used. */
  unavailableReason: string | null;
  onNewFolder: () => void;
  onUpload: () => void;
  showFiles: boolean;
  onShowFilesChange: (showFiles: boolean) => void;
  /** Files are what the picker chooses, so the toggle names the others. */
  isPickingFiles: boolean;
}

/**
 * The Info pane's actions, the last thing in its scrolling body (`mt-auto` keeps them on
 * the bottom edge when the content above is short). From `md` up they stack full width:
 * New folder, Upload, then the Show files toggle. On a phone New folder and Upload share
 * a row and the toggle spans both columns (Upload alone spans the row when picking
 * files, which has no New folder). New folder and Upload are `soft` so they stand out
 * from the pane. The toggle stays `outline`: it is a view switch that only filters the
 * columns, so the reason that turns the other two off never applies to it.
 */
export function FolderPickerActions({
  showNewFolder,
  unavailableReason,
  onNewFolder,
  onUpload,
  showFiles,
  onShowFilesChange,
  isPickingFiles,
}: FolderPickerActionsProps) {
  return (
    <div
      role="group"
      aria-label="Folder actions"
      className="mt-auto grid w-full shrink-0 grid-cols-2 gap-2 md:grid-cols-1"
    >
      {showNewFolder ? (
        <FolderAction
          icon={<FolderPlus data-icon="inline-start" />}
          label="New folder here"
          unavailableReason={unavailableReason}
          onClick={onNewFolder}
        />
      ) : null}
      <FolderAction
        icon={<Upload data-icon="inline-start" />}
        label="Upload here"
        unavailableReason={unavailableReason}
        onClick={onUpload}
        isAlone={!showNewFolder}
      />
      <Button
        type="button"
        variant="soft"
        className="col-span-full w-full"
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
    </div>
  );
}

/**
 * The tooltip is always mounted and only switched off, so a button never remounts when
 * its reason appears or clears.
 */
function FolderAction({
  icon,
  label,
  unavailableReason,
  onClick,
  isAlone = false,
}: {
  icon: ReactNode;
  label: string;
  unavailableReason: string | null;
  onClick: () => void;
  /** The only action in the group, so it spans the phone's two columns. */
  isAlone?: boolean;
}) {
  return (
    <TooltipProvider>
      <Tooltip disabled={unavailableReason === null}>
        {/* A disabled button takes no focus, so while a reason shows the wrapper is
           the tab stop that opens it from the keyboard. */}
        <TooltipTrigger
          render={
            <span
              className={cn("flex w-full", isAlone && "col-span-full")}
              tabIndex={unavailableReason === null ? undefined : 0}
            />
          }
        >
          <Button
            type="button"
            variant="soft"
            className="w-full"
            disabled={unavailableReason !== null}
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
