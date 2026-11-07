"use client";

/**
 * One column of the folder picker: its own listing, vertical scroll and
 * roving-focus rows, plus the inline new-folder row it can host.
 */

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FolderPlus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import type { FolderIconVariant } from "@/components/workspace/workspace-item-icon";
import { useRetryKeepingError } from "@/components/views/use-retry-keeping-error";
import { useWorkspacePickerListing } from "@/hooks/services/workspace/use-workspace-picker-listing";
import type { WorkspaceItem } from "@/lib/services/workspace/domain";
import {
  folderNameError,
  isPickerItemInteractive,
  isPickerItemNavigable,
  pickerRowKey,
  visiblePickerRows,
  type PickerLocation,
  type PickerTarget,
} from "@/lib/services/workspace/picker-views";
import { workspaceQueryKeys } from "@/lib/services/workspace/workspace-query-keys";
import { cn } from "@/lib/utils";
import { FolderPickerColumnEmpty } from "./folder-picker-column-empty";
import { FolderPickerColumnError } from "./folder-picker-column-error";
import { FolderPickerRow } from "./folder-picker-row";
import { PaneResizeHandle } from "./folder-picker-resize-handle";
import { columnWidthLimitsFor } from "./folder-picker-utils";

export interface NewFolderRowHandlers {
  /** Rejects with the backend's error, which the row shows as-is. */
  onCreate: (name: string) => Promise<void>;
  onCancel: () => void;
}

interface FolderPickerColumnProps {
  /** Identifies the column across renders for the open/close motion. */
  transitionKey: string;
  index: number;
  location: PickerLocation;
  label: string;
  username: string;
  /** What the picker chooses; picking files, files are rows too. */
  target: PickerTarget;
  showFiles: boolean;
  onShowFiles: () => void;
  width: number;
  onResize: (width: number) => void;
  /** The row selected in this column (an ancestor of, or, the selection). */
  selectedPath: string | null;
  /** This column's selected row is the picker's selection (active styling). */
  isCurrent: boolean;
  /** This column holds the strip's single Tab stop. */
  hasTabStop: boolean;
  folderVariant: FolderIconVariant;
  showOwner: boolean;
  inert: boolean;
  /** Shows the inline new-folder row at the top of the column. */
  newFolder: NewFolderRowHandlers | null;
  isRowWritable: (item: WorkspaceItem, siblings: WorkspaceItem[]) => boolean;
  isRowUsable: (item: WorkspaceItem) => boolean;
  onSelect: (index: number, item: WorkspaceItem) => void;
  onEnterChild: (index: number, item: WorkspaceItem) => void;
  onExitToParent: (index: number) => void;
  onCommit: (item: WorkspaceItem, siblings: WorkspaceItem[]) => void;
  focusRow: (index: number, path: string) => void;
  /**
   * Called once this column has loaded without its selected row: the folder
   * is gone (a stale value, or deleted elsewhere).
   */
  onSelectionMissing: (index: number) => void;
}

export function FolderPickerColumn({
  transitionKey,
  index,
  location,
  label,
  username,
  target,
  showFiles,
  onShowFiles,
  width,
  onResize,
  selectedPath,
  isCurrent,
  hasTabStop,
  folderVariant,
  showOwner,
  inert,
  newFolder,
  isRowWritable,
  isRowUsable,
  onSelect,
  onEnterChild,
  onExitToParent,
  onCommit,
  focusRow,
  onSelectionMissing,
}: FolderPickerColumnProps) {
  const listing = useWorkspacePickerListing({ location, username });
  const queryClient = useQueryClient();
  // Retry reloads every workspace read on screen that failed, not just this
  // column's: an outage fails the columns and the info pane together, and
  // they share these reads. The error stays up, "Retrying…", until it answers.
  const retry = useRetryKeepingError(
    {
      error: listing.error,
      isFetching: listing.isLoading,
      refetch: () =>
        queryClient.refetchQueries({
          queryKey: workspaceQueryKeys.all,
          type: "active",
          predicate: (query) => query.state.status === "error",
        }),
    },
    transitionKey,
  );
  const selectionMissing =
    !listing.isLoading &&
    !listing.error &&
    selectedPath !== null &&
    !listing.items.some((item) => pickerRowKey(item, target) === selectedPath);
  useEffect(() => {
    if (selectionMissing) onSelectionMissing(index);
  }, [selectionMissing, index, onSelectionMissing]);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const rows = visiblePickerRows({
    location,
    items: listing.items,
    target,
    showAll: showFiles,
  });
  /** Rows the keyboard moves over: folders, and files the picker can choose. */
  const interactiveRows = rows.filter((item) =>
    isPickerItemInteractive(item, target),
  );
  const interactivePaths = interactiveRows.map((row) =>
    pickerRowKey(row, target),
  );
  const tabStopPath = hasTabStop
    ? selectedPath && interactivePaths.includes(selectedPath)
      ? selectedPath
      : (interactivePaths.at(0) ?? null)
    : null;
  // Files this directory holds but the column hides. (List views also drop
  // rows on purpose, e.g. read-only shares; those don't count.)
  const hiddenFileCount =
    location.kind === "path" && !showFiles
      ? listing.items.filter(
          (item) =>
            !isPickerItemInteractive(item, target) &&
            !item.name.startsWith("."),
        ).length
      : 0;
  const isPickingFiles = target.kind === "object";

  // Keep the selected row in view when the column (re)loads or the selection
  // moves. Only this column scrolls: `scrollIntoView` would also scroll the
  // strip sideways and fight the strip's own auto-scroll.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !selectedPath || listing.isLoading) return;
    const row = scroller.querySelector<HTMLElement>(
      `[data-picker-path="${CSS.escape(selectedPath)}"]`,
    );
    if (!row) return;
    // Scroll just enough to show it, the way arrowing through a list does.
    const top = row.offsetTop - 4;
    const bottom = row.offsetTop + row.offsetHeight + 4;
    if (top < scroller.scrollTop) scroller.scrollTop = top;
    else if (bottom > scroller.scrollTop + scroller.clientHeight)
      scroller.scrollTop = bottom - scroller.clientHeight;
  }, [selectedPath, listing.isLoading]);

  const handleKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    item: WorkspaceItem,
  ) => {
    const path = pickerRowKey(item, target);
    const position = interactivePaths.indexOf(path);
    // A focused row that is not selected yet (nothing picked in this column)
    // gets selected by the first arrow press instead of being skipped.
    const step = path === selectedPath ? 1 : 0;
    const moveTo = (nextIndex: number) => {
      const next = interactiveRows.at(nextIndex);
      if (!next) return;
      focusRow(index, pickerRowKey(next, target));
      onSelect(index, next);
    };
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveTo(Math.min(position + step, interactiveRows.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        moveTo(Math.max(position - step, 0));
        break;
      case "Home":
        event.preventDefault();
        moveTo(0);
        break;
      case "End":
        event.preventDefault();
        moveTo(interactiveRows.length - 1);
        break;
      case "ArrowRight":
        event.preventDefault();
        onEnterChild(index, item);
        break;
      case "ArrowLeft":
        event.preventDefault();
        onExitToParent(index);
        break;
      case "Enter":
        event.preventDefault();
        // Picking files, Enter opens a folder (choosing it is not an option)
        // and chooses a file.
        if (isPickingFiles && isPickerItemNavigable(item, target)) {
          onEnterChild(index, item);
        } else {
          onCommit(item, listing.items);
        }
        break;
      case " ":
        event.preventDefault();
        onSelect(index, item);
        break;
    }
  };

  return (
    <div
      data-picker-column={index}
      data-picker-key={transitionKey}
      inert={inert}
      style={{ "--picker-column-width": `${String(width)}px` } as CSSProperties}
      className="relative flex h-full w-(--picker-column-width) shrink-0 flex-col border-r"
    >
      <PaneResizeHandle
        edge="end"
        label={`Resize ${label} column`}
        width={width}
        limits={columnWidthLimitsFor(index)}
        onResize={onResize}
      />
      <div className="flex h-8 shrink-0 items-center gap-2 border-b px-3 text-xs font-medium text-muted-foreground">
        <span className="min-w-0 flex-1 truncate" title={label}>
          {label}
        </span>
        {!listing.isLoading && !listing.error ? (
          <span className="tabular-nums">{interactiveRows.length}</span>
        ) : null}
      </div>
      <div
        ref={scrollerRef}
        className="scrollbar-themed relative min-h-0 flex-1 overflow-y-auto p-1"
      >
        {newFolder ? <NewFolderRow {...newFolder} /> : null}
        {retry.error ? (
          <FolderPickerColumnError
            error={retry.error}
            retrying={retry.retrying}
            onRetry={retry.retry}
          />
        ) : listing.isLoading ? (
          <ColumnSkeleton />
        ) : rows.length === 0 ? (
          newFolder ? null : (
            <FolderPickerColumnEmpty
              location={location}
              hiddenFileCount={hiddenFileCount}
              isPickingFiles={isPickingFiles}
              onShowFiles={onShowFiles}
            />
          )
        ) : (
          <div
            role="listbox"
            aria-label={label}
            className="flex flex-col gap-px"
          >
            {rows.map((item) => {
              const key = pickerRowKey(item, target);
              const isSelected =
                isPickerItemInteractive(item, target) && key === selectedPath;
              return (
                <FolderPickerRow
                  key={item.id}
                  item={item}
                  target={target}
                  index={index}
                  folderVariant={folderVariant}
                  showOwner={showOwner}
                  isSelected={isSelected}
                  isActive={isSelected && isCurrent}
                  isTabStop={key === tabStopPath}
                  isWritable={isRowWritable(item, listing.items)}
                  isUsable={isRowUsable(item)}
                  onSelect={() => {
                    onSelect(index, item);
                  }}
                  onCommit={() => {
                    onCommit(item, listing.items);
                  }}
                  onKeyDown={(event) => {
                    handleKeyDown(event, item);
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ColumnSkeleton() {
  return (
    <div className="flex flex-col gap-px">
      <span role="status" className="sr-only">
        Loading
      </span>
      {[0, 1, 2, 3, 4, 5].map((n) => (
        <div key={n} aria-hidden className="flex h-7 items-center gap-2 px-2">
          <Skeleton className="size-4 rounded-sm" />
          <Skeleton className={n % 2 === 0 ? "h-3 w-28" : "h-3 w-20"} />
        </div>
      ))}
    </div>
  );
}

/**
 * Editable row at the top of a column: Enter creates, Esc cancels. The name
 * rule shows inline; a backend error shows with its original message.
 */
function NewFolderRow({ onCreate, onCancel }: NewFolderRowHandlers) {
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const nameError = folderNameError(name);
  const shownError =
    backendError ??
    ((submitted || name.length > 0) && nameError ? nameError : null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async () => {
    setSubmitted(true);
    if (nameError || isCreating) return;
    setIsCreating(true);
    setBackendError(null);
    try {
      // On success the column unmounts this row.
      await onCreate(name);
    } catch (error) {
      setBackendError(
        error instanceof Error ? error.message : "Failed to create folder.",
      );
      setIsCreating(false);
    }
  };

  return (
    <div className="mb-1 flex flex-col gap-1 rounded-md bg-primary/5 p-1 ring-1 ring-primary/40">
      <div className="flex h-7 items-center gap-2 pl-1">
        <FolderPlus aria-hidden className="size-4 shrink-0 text-highlight" />
        <input
          ref={inputRef}
          data-picker-inline-edit=""
          aria-label="New folder name"
          aria-invalid={shownError ? true : undefined}
          aria-describedby={errorId}
          placeholder="Folder name"
          value={name}
          disabled={isCreating}
          onChange={(event) => {
            setName(event.target.value);
            setBackendError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void submit();
            } else if (event.key === "Escape") {
              event.preventDefault();
              onCancel();
            }
          }}
          className="h-6 min-w-0 flex-1 rounded-sm border border-input bg-background px-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60 aria-invalid:border-destructive"
        />
        {isCreating ? <Spinner className="size-3.5 shrink-0" /> : null}
      </div>
      <p
        id={errorId}
        className={cn(
          "px-1 text-2xs wrap-break-word",
          shownError ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {shownError ??
          (isCreating ? "Creating…" : "Enter to create · Esc to cancel")}
      </p>
    </div>
  );
}
