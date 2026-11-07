import {
  emptyListingMessage,
  type PickerLocation,
} from "@/lib/services/workspace/picker-views";

interface FolderPickerColumnEmptyProps {
  location: PickerLocation;
  /** Files the column hides, offered through "Show N files". */
  hiddenFileCount: number;
  isPickingFiles: boolean;
  onShowFiles: () => void;
}

/** A column with nothing to list, or only hidden files. */
export function FolderPickerColumnEmpty({
  location,
  hiddenFileCount,
  isPickingFiles,
  onShowFiles,
}: FolderPickerColumnEmptyProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 px-4 text-center text-xs text-muted-foreground">
      {hiddenFileCount > 0 ? (
        <>
          <p>
            {isPickingFiles ? "No matching files here." : "No folders here."}
          </p>
          <button
            type="button"
            onClick={onShowFiles}
            className="text-2xs text-link underline-offset-4 hover:underline"
          >
            Show {hiddenFileCount}
            {isPickingFiles ? " other " : " "}
            {hiddenFileCount === 1 ? "file" : "files"}
          </button>
        </>
      ) : (
        <p>{emptyListingMessage(location)}</p>
      )}
    </div>
  );
}
