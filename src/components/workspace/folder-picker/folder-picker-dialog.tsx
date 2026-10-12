"use client";

/**
 * Workspace folder picker: a wide dialog with a places sidebar (Home, My /
 * Shared / Public Workspaces, Favorites, Recently Used), horizontally
 * scrolling, resizable columns (click a folder to select it and open it in
 * the next column), and an info pane pinned on the right with inline New
 * folder and Upload. The footer has a clickable breadcrumb of the selection
 * and Select. Column widths, the info-pane width and "Show files" last
 * between opens; everything else starts fresh. Below `md` the panes stack
 * (places, columns, a compact info pane) so the columns keep the width.
 */

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FolderIconVariant } from "@/components/workspace/workspace-item-icon";
import { useWorkspaceRepository } from "@/contexts/workspace-repository-context";
import { useWorkspacePickerListing } from "@/hooks/services/workspace/use-workspace-picker-listing";
import { useAuth } from "@/lib/auth/provider";
import type { WorkspaceItem } from "@/lib/services/workspace/domain";
import { normalizePath } from "@/lib/services/workspace/mini-browser-items";
import {
  sanitizePathSegment,
  workspaceUsername,
} from "@/lib/services/workspace/path-utils";
import {
  canWriteTo,
  initialPickerSelection,
  isPickerItemInteractive,
  isPickerItemNavigable,
  lastSegment,
  locationForView,
  pickerCommitState,
  pickerHomePath,
  pickerPathLabel,
  pickerRowKey,
  pickerTitleFor,
  pickerTypePhrase,
  viewLabel,
  visiblePickerRows,
  type PickerLocation,
  type PickerSelectablePredicate,
  type PickerTarget,
  type PickerView,
} from "@/lib/services/workspace/picker-views";
import { knownUploadTypes } from "@/lib/services/workspace/types";
import { workspaceQueryKeys } from "@/lib/services/workspace/workspace-query-keys";
import { cn } from "@/lib/utils";
import { FolderPickerBreadcrumb } from "./folder-picker-breadcrumb";
import { FolderPickerColumn } from "./folder-picker-column";
import {
  captureColumns,
  playColumnTransition,
  type ColumnsSnapshot,
} from "./folder-picker-motion";
import {
  FilePickerInfo,
  FolderPickerInfo,
  FolderPickerUpload,
} from "./folder-picker-preview";
import { PaneResizeHandle } from "./folder-picker-resize-handle";
import {
  columnWidthLimitsFor,
  folderTarget,
  isInlineEditTarget,
  placeGroups,
  placeIcons,
  previewWidthLimits,
  rowSelector,
  tabStopSelector,
  uploadPaneMinWidth,
} from "./folder-picker-utils";

function columnFolderVariant(
  index: number,
  place: PickerView,
): FolderIconVariant {
  if (index > 0) return "default";
  if (place === "shared") return "shared";
  if (place === "public") return "public";
  if (place === "favorites") return "favorite";
  return "default";
}

/** A row to focus once it renders; `path: null` means the strip's Tab stop. */
interface PendingFocus {
  column: number;
  path: string | null;
}

/** What the dialog remembers between opens. */
interface PickerLayout {
  showFiles: boolean;
  onShowFilesChange: (showFiles: boolean) => void;
  /** Width per column index; unset columns use the default. */
  columnWidths: Record<number, number>;
  onColumnWidthChange: (index: number, width: number) => void;
  previewWidth: number;
  onPreviewWidthChange: (width: number) => void;
}

interface FolderColumnsBrowserProps {
  layout: PickerLayout;
  /** What the picker chooses: a folder, or a file of some types. */
  target: PickerTarget;
  initialPath: string;
  title: string;
  isSelectable: PickerSelectablePredicate;
  stripRef: RefObject<HTMLDivElement | null>;
  isUploading: boolean;
  onUploadingChange: (uploading: boolean) => void;
  onCommit: (path: string, item: WorkspaceItem | null) => void;
  onCancel: () => void;
}

function FolderColumnsBrowser({
  layout,
  target,
  initialPath,
  title,
  isSelectable,
  stripRef,
  isUploading,
  onUploadingChange,
  onCommit,
  onCancel,
}: FolderColumnsBrowserProps) {
  const { user } = useAuth();
  const username = workspaceUsername(user);
  const repository = useWorkspaceRepository("authenticated");
  const queryClient = useQueryClient();

  const [initial] = useState(() =>
    initialPickerSelection(initialPath, username, target),
  );
  const [place, setPlace] = useState<PickerView>(initial.view);
  /** chain[i] is the folder selected in column i; column i + 1 lists it. */
  const [chain, setChain] = useState<string[]>(initial.chain);
  /**
   * Picking files, the selected file. It sits in the last column (the one
   * listing `chain.at(-1)`), which it never opens.
   */
  const [file, setFile] = useState<string | null>(initial.file);
  const { showFiles, onShowFilesChange } = layout;
  const [isNaming, setIsNaming] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  // Bumped whenever the new-folder field opens or closes, which every
  // navigation does (and opening the upload form), so work that finishes
  // after the user moved on (a folder creation, the refresh after an upload)
  // can tell and leave the picker alone.
  const revisionRef = useRef(0);
  const setNaming = (naming: boolean) => {
    revisionRef.current += 1;
    setIsNaming(naming);
  };
  const pendingFocusRef = useRef<PendingFocus | null>(
    initial.file
      ? { column: initial.chain.length, path: initial.file }
      : initial.chain.length > 0
        ? {
            column: initial.chain.length - 1,
            path: initial.chain.at(-1) ?? null,
          }
        : { column: 0, path: null },
  );

  const homePath = pickerHomePath(username);
  const rootLocation = locationForView(place, username);
  const columnLocation = (index: number): PickerLocation => {
    const parent = index > 0 ? chain.at(index - 1) : undefined;
    return parent ? { kind: "path", path: parent } : rootLocation;
  };
  const lastIndex = chain.length;
  /** Column holding the selected row; -1 when the selection is the root. */
  const currentIndex = file ? lastIndex : chain.length - 1;
  const selectedPath =
    file ??
    chain.at(-1) ??
    (rootLocation.kind === "path" ? rootLocation.path : null);
  const labelFor = (path: string) => pickerPathLabel(path, homePath, target);
  const lastLocation = columnLocation(lastIndex);

  // Cached reads shared with the columns: the selected folder's own column
  // (its row carries the permission), and the column listing its contents.
  const containing = useWorkspacePickerListing({
    location: columnLocation(Math.max(currentIndex, 0)),
    username,
  });
  const contents = useWorkspacePickerListing({
    location: lastLocation,
    username,
  });
  const selectedItem =
    currentIndex >= 0
      ? (containing.items.find(
          (item) => pickerRowKey(item, target) === selectedPath,
        ) ?? null)
      : null;

  const isWritable = (
    path: string,
    item: WorkspaceItem | null,
    siblings: WorkspaceItem[],
  ) => canWriteTo({ path, username, item, siblings });
  const commitStateFor = (
    path: string | null,
    item: WorkspaceItem | null,
    siblings: WorkspaceItem[],
  ) =>
    pickerCommitState({
      target,
      path,
      item,
      isSelectable,
      writable: path !== null && isWritable(path, item, siblings),
    });

  // The rows `canWriteTo` falls back on for the selected folder when its own
  // row has no permission. Its listing is in its own workspace, so it comes
  // first: in Favorites and Recently Used the containing rows are stubs from
  // any workspace, and a stub has none when its workspace is not in `/`.
  const selectedEvidence = contents.items.some((item) => item.permissions)
    ? contents.items
    : containing.items;
  const evidenceFor = (path: string, siblings: WorkspaceItem[]) =>
    path === selectedPath ? selectedEvidence : siblings;

  const commit = commitStateFor(selectedPath, selectedItem, selectedEvidence);
  // Until the column listing the selection has loaded, the folder may still
  // turn out to be gone.
  const canCommitNow = commit.canCommit && !containing.isLoading;
  // The folder the info pane describes and Upload saves into: the selection,
  // or, with a file selected, the folder holding it. Until the file's row has
  // loaded the pane shows that folder, never the file as if it were one.
  const folderPath = file
    ? (chain.at(-1) ??
      (rootLocation.kind === "path" ? rootLocation.path : null))
    : selectedPath;
  const canChange =
    folderPath !== null &&
    isWritable(folderPath, file ? null : selectedItem, selectedEvidence);

  // --- focus -------------------------------------------------------------

  const findRow = (pending: PendingFocus) =>
    stripRef.current?.querySelector<HTMLElement>(
      pending.path === null
        ? tabStopSelector
        : rowSelector(pending.column, pending.path),
    ) ?? null;

  // `preventScroll`: focusing a row would scroll the strip sideways on its own
  // (instantly, and only when moving forward). The effect below owns that.
  /** Focus a row now if it is rendered, otherwise as soon as it is. */
  const focusRow = (column: number, path: string) => {
    const row = findRow({ column, path });
    pendingFocusRef.current = row ? null : { column, path };
    row?.focus({ preventScroll: true });
  };

  useEffect(() => {
    const pending = pendingFocusRef.current;
    if (!pending) return;
    const row = findRow(pending);
    if (!row) return;
    pendingFocusRef.current = null;
    row.focus({ preventScroll: true });
  });

  // --- column motion -----------------------------------------------------

  const contentRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const snapshotRef = useRef<ColumnsSnapshot | null>(null);

  /** Record the strip as it is on screen; every navigation calls this first. */
  const prepareTransition = () => {
    const strip = stripRef.current;
    const overlay = overlayRef.current;
    snapshotRef.current =
      strip && overlay
        ? captureColumns({ strip, overlay, place, depth: chain.length })
        : null;
  };

  // Keep the newest column fully in view, without scrolling the column that
  // holds the selection off the left edge, then animate from the snapshot.
  // A layout effect, so the new layout never paints before its animation.
  const lastPath = chain.at(-1) ?? "";
  useLayoutEffect(() => {
    const strip = stripRef.current;
    const content = contentRef.current;
    const overlay = overlayRef.current;
    const snapshot = snapshotRef.current;
    snapshotRef.current = null;
    if (!strip || !content || !overlay) return;
    const column = (index: number) =>
      strip.querySelector<HTMLElement>(
        `[data-picker-column="${String(index)}"]`,
      );
    const last = column(lastIndex);
    const anchor = column(Math.max(currentIndex, 0));
    if (!last) return;
    const revealLast = last.offsetLeft + last.offsetWidth - strip.clientWidth;
    const left = Math.max(
      0,
      Math.min(revealLast, anchor?.offsetLeft ?? revealLast),
    );
    playColumnTransition({
      strip,
      content,
      overlay,
      snapshot,
      scrollLeft: left,
      place,
      depth: lastIndex,
    });
  }, [stripRef, place, lastPath, lastIndex, currentIndex]);

  // --- navigation --------------------------------------------------------

  const closePanes = () => {
    setNaming(false);
    setIsUploadOpen(false);
  };

  const selectPlace = (view: PickerView) => {
    prepareTransition();
    pendingFocusRef.current = null;
    setPlace(view);
    setChain([]);
    setFile(null);
    closePanes();
  };

  // A folder opens in the next column; a file is selected in its own column
  // and opens nothing.
  const selectAt = (column: number, item: WorkspaceItem) => {
    if (!isPickerItemInteractive(item, target)) return;
    // Keyboard moves focus before selecting, so nothing is left pending here;
    // a stale request must not pull focus back after the user moved on.
    pendingFocusRef.current = null;
    prepareTransition();
    const key = pickerRowKey(item, target);
    if (isPickerItemNavigable(item, target)) {
      setChain([...chain.slice(0, column), key]);
      setFile(null);
    } else {
      setChain(chain.slice(0, column));
      setFile(key);
    }
    closePanes();
  };

  const enterChild = (column: number, item: WorkspaceItem) => {
    if (!isPickerItemNavigable(item, target)) return;
    if (chain.at(column) !== pickerRowKey(item, target)) {
      selectAt(column, item);
      return;
    }
    // The row already selected in the next column: a folder, or the file.
    const deeper =
      chain.at(column + 1) ?? (column + 1 === chain.length ? file : null);
    if (deeper) {
      focusRow(column + 1, deeper);
      return;
    }
    const first = visiblePickerRows({
      location: lastLocation,
      items: contents.items,
      target,
      showAll: showFiles,
    }).find((row) => isPickerItemInteractive(row, target));
    if (!first) return;
    const firstKey = pickerRowKey(first, target);
    if (!isPickerItemNavigable(first, target)) {
      // A file: select it where it is, opening nothing.
      focusRow(column + 1, firstKey);
      setFile(firstKey);
      closePanes();
      return;
    }
    prepareTransition();
    focusRow(column + 1, firstKey);
    setChain([...chain, firstKey]);
    closePanes();
  };

  const exitToParent = (column: number) => {
    const parentPath = column > 0 ? chain.at(column - 1) : undefined;
    if (!parentPath) return;
    prepareTransition();
    focusRow(column - 1, parentPath);
    setChain(chain.slice(0, column));
    setFile(null);
    closePanes();
  };

  const jumpTo = (depth: number) => {
    // Past the last folder is the file's own crumb, already selected.
    if (depth > chain.length) return;
    const folder = depth > 0 ? chain.at(depth - 1) : undefined;
    prepareTransition();
    if (folder) focusRow(depth - 1, folder);
    else pendingFocusRef.current = { column: 0, path: null };
    setChain(chain.slice(0, depth));
    setFile(null);
    closePanes();
  };

  // The selection always exists: a column that loads without its selected
  // row ends the chain at the column's own folder (a file that is gone
  // leaves its folder selected). Focus follows only if it was still on its
  // way to a row that turned out to be gone.
  const handleSelectionMissing = (column: number) => {
    if (file && column === chain.length) {
      setFile(null);
      if (pendingFocusRef.current) {
        const last = chain.at(-1);
        pendingFocusRef.current = last
          ? { column: chain.length - 1, path: last }
          : { column: 0, path: null };
      }
      return;
    }
    if (chain.length <= column) return;
    const kept = chain.slice(0, column);
    setChain(kept);
    setFile(null);
    if (pendingFocusRef.current) {
      const last = kept.at(-1);
      pendingFocusRef.current = last
        ? { column: kept.length - 1, path: last }
        : { column: 0, path: null };
    }
  };

  const commitRow = (item: WorkspaceItem, siblings: WorkspaceItem[]) => {
    const path = pickerRowKey(item, target);
    if (commitStateFor(path, item, evidenceFor(path, siblings)).canCommit)
      onCommit(path, item);
  };

  // --- new folder / upload ------------------------------------------------

  const createFolder = useMutation({
    mutationFn: async ({ parent, name }: { parent: string; name: string }) => {
      const path = `${normalizePath(parent)}/${sanitizePathSegment(name)}`;
      await repository.createFolder(path);
      return path;
    },
    // Awaited, so the new row is in its column before it gets selected.
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.all }),
  });

  const handleCreate = async (name: string) => {
    if (!selectedPath) return;
    const column = lastIndex;
    const revision = revisionRef.current;
    const path = await createFolder.mutateAsync({ parent: selectedPath, name });
    // The user navigated or closed the field meanwhile: the folder is in its
    // listing, but the selection, the field and focus are theirs now.
    if (revisionRef.current !== revision) return;
    // Select it, opening its empty column. Nothing has moved since the field
    // opened, so this render's chain is still current.
    prepareTransition();
    setChain([...chain, path]);
    setNaming(false);
    pendingFocusRef.current = { column, path };
  };

  const isRowWritable = (item: WorkspaceItem, siblings: WorkspaceItem[]) => {
    const path = pickerRowKey(item, target);
    return isWritable(path, item, evidenceFor(path, siblings));
  };
  const isRowUsable = (item: WorkspaceItem) =>
    isSelectable({ name: item.name, path: item.path });

  const selectedName = file
    ? lastSegment(file)
    : selectedPath
      ? labelFor(selectedPath)
      : "";
  const isPickingFiles = target.kind === "object";

  return (
    <>
      <DialogHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {target.kind === "object"
                ? `Click a folder to open it. Double-click a file, or press Enter, to choose it. Accepts ${pickerTypePhrase(target.types)}.`
                : "Click a folder to open it. Double-click it, or press Enter, to choose it."}
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
            {/* In the header row rather than the dialog's own corner button,
                which sits 8px higher than the rest of the row. Disabled, not
                hidden, mid-upload so the row doesn't shift. */}
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

      {/* Below `md` the sidebar and info pane would leave the columns no room,
          so the body stacks: places as a scrolling row on top, the columns,
          then the info pane, compact, underneath. */}
      <div className="-mx-4 -mb-4 flex min-h-0 flex-1 flex-col border-t md:flex-row">
        <nav
          aria-label="Places"
          inert={isUploading}
          className="scrollbar-themed flex shrink-0 gap-1 overflow-auto border-b bg-muted/50 p-2 md:w-48 md:flex-col md:gap-4 md:border-r md:border-b-0"
        >
          {placeGroups.map((group) => (
            <div key={group.label} className="flex shrink-0 gap-0.5 md:flex-col">
              <p className="hidden px-2 py-1 text-2xs font-medium tracking-wide text-muted-foreground uppercase md:block">
                {group.label}
              </p>
              {group.views.map((view) => {
                const Icon = placeIcons[view];
                const isActive = view === place;
                return (
                  <button
                    key={view}
                    type="button"
                    aria-current={isActive ? "true" : undefined}
                    onClick={() => {
                      selectPlace(view);
                    }}
                    className={cn(
                      "flex h-8 shrink-0 items-center gap-2 rounded-md px-2 text-left text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring md:w-full",
                      isActive
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-foreground/80 hover:bg-foreground/5 hover:text-foreground",
                    )}
                  >
                    <Icon
                      aria-hidden
                      className={cn(
                        "size-4 shrink-0",
                        view === "favorites"
                          ? "text-highlight"
                          : isActive
                            ? "text-primary"
                            : "text-muted-foreground",
                      )}
                    />
                    <span className="truncate">{viewLabel(view)}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* On a narrow screen the upload form needs the whole body. */}
        <div
          className={cn(
            "relative flex min-h-0 min-w-0 flex-1",
            isUploadOpen && "max-md:hidden",
          )}
        >
          <div
            ref={stripRef}
            role="group"
            aria-label="Folder columns"
            className="scrollbar-themed flex min-w-0 flex-1 overflow-x-auto overflow-y-hidden"
          >
            <div ref={contentRef} className="flex h-full min-w-full shrink-0">
              {Array.from({ length: lastIndex + 1 }, (_, index) => {
                const parent = index > 0 ? chain.at(index - 1) : undefined;
                const isLast = index === lastIndex;
                return (
                  <FolderPickerColumn
                    key={`${place}:${parent ?? ""}`}
                    transitionKey={`${place}:${parent ?? ""}`}
                    index={index}
                    location={columnLocation(index)}
                    label={parent ? labelFor(parent) : viewLabel(place)}
                    username={username}
                    target={target}
                    showFiles={showFiles}
                    onShowFiles={() => {
                      onShowFilesChange(true);
                    }}
                    width={
                      layout.columnWidths[index] ??
                      columnWidthLimitsFor(index).initial
                    }
                    onResize={(width) => {
                      layout.onColumnWidthChange(index, width);
                    }}
                    selectedPath={
                      index < chain.length ? (chain.at(index) ?? null) : file
                    }
                    isCurrent={index === currentIndex}
                    hasTabStop={index === Math.max(currentIndex, 0)}
                    folderVariant={columnFolderVariant(index, place)}
                    showOwner={
                      index === 0 && (place === "shared" || place === "public")
                    }
                    inert={isUploading}
                    newFolder={
                      isLast && isNaming && target.kind === "folder"
                        ? {
                            onCreate: handleCreate,
                            onCancel: () => {
                              setNaming(false);
                              pendingFocusRef.current = {
                                column: 0,
                                path: null,
                              };
                            },
                          }
                        : null
                    }
                    isRowWritable={isRowWritable}
                    isRowUsable={isRowUsable}
                    onSelect={selectAt}
                    onEnterChild={enterChild}
                    onExitToParent={exitToParent}
                    onCommit={commitRow}
                    focusRow={focusRow}
                    onSelectionMissing={handleSelectionMissing}
                  />
                );
              })}
            </div>
          </div>
          {/* Columns that are going away play their exit here, above the
              strip; React renders this empty and never touches its children. */}
          <div
            ref={overlayRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden"
          />
        </div>

        {/* Pinned outside the strip, so opening or closing a column never moves
            it; only the columns scroll. */}
        <div
          style={
            {
              "--picker-preview-width": `${String(
                isUploadOpen
                  ? Math.max(layout.previewWidth, uploadPaneMinWidth)
                  : layout.previewWidth,
              )}px`,
            } as CSSProperties
          }
          // `-ml-px` lays this border over the last column's, so the two never
          // show as a double line when the columns fill the strip. Stacked,
          // it spans the dialog and is capped so the columns keep most of it.
          className={cn(
            "relative flex shrink-0 border-t bg-background md:-ml-px md:w-(--picker-preview-width) md:border-t-0 md:border-l",
            isUploadOpen ? "max-md:min-h-0 max-md:flex-1" : "max-md:max-h-1/2",
          )}
        >
          <PaneResizeHandle
            edge="start"
            label="Resize info pane"
            width={layout.previewWidth}
            limits={previewWidthLimits}
            onResize={layout.onPreviewWidthChange}
            className="hidden md:block"
          />
          {isUploadOpen && folderPath ? (
            <FolderPickerUpload
              target={target}
              targetPath={folderPath}
              homePath={homePath}
              initialUploadType={
                target.kind === "object"
                  ? target.types.find((type) => type in knownUploadTypes)
                  : undefined
              }
              isUploading={isUploading}
              onBack={() => {
                setIsUploadOpen(false);
                pendingFocusRef.current = { column: 0, path: null };
              }}
              onComplete={(uploaded) => {
                // Closed at once: the panel keeps its files, so left open
                // while the listings refresh it would offer the same upload
                // again.
                setIsUploadOpen(false);
                pendingFocusRef.current = { column: 0, path: null };
                const only = uploaded.length === 1 ? uploaded[0] : undefined;
                const pick =
                  target.kind === "object" &&
                  only &&
                  target.types.includes(only.type)
                    ? only.path
                    : null;
                const revision = revisionRef.current;
                void (async () => {
                  // Awaited, so the file is in its column's listing when it
                  // is selected; otherwise it would be dropped as gone.
                  await queryClient.invalidateQueries({
                    queryKey: workspaceQueryKeys.all,
                  });
                  // The user moved on meanwhile: the selection is theirs.
                  if (!pick || revisionRef.current !== revision) return;
                  setFile(pick);
                  pendingFocusRef.current = { column: lastIndex, path: pick };
                })();
              }}
              onUploadingChange={onUploadingChange}
            />
          ) : file && selectedItem ? (
            <FilePickerInfo item={selectedItem} place={place} commit={commit} />
          ) : (
            <FolderPickerInfo
              target={target}
              place={place}
              path={folderPath}
              homePath={homePath}
              item={selectedItem}
              contents={contents}
              commit={commit}
              canChange={canChange}
              onNewFolder={() => {
                pendingFocusRef.current = null;
                setIsUploadOpen(false);
                setNaming(true);
              }}
              onUpload={() => {
                pendingFocusRef.current = null;
                setNaming(false);
                setIsUploadOpen(true);
              }}
            />
          )}
        </div>
      </div>

      <DialogFooter className="sm:items-center sm:justify-between">
        <FolderPickerBreadcrumb
          place={place}
          chain={file ? [...chain, file] : chain}
          label={labelFor}
          navLabel={isPickingFiles ? "Selected file" : "Selected folder"}
          disabled={isUploading}
          onJump={jumpTo}
        />
        <div className="flex shrink-0 items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isUploading}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canCommitNow || isUploading}
            onClick={() => {
              if (selectedPath && canCommitNow) {
                onCommit(selectedPath, selectedItem);
              }
            }}
          >
            {selectedPath ? (
              <>
                {/* The space keeps the accessible name "Select “Name”". */}
                Select{" "}
                <span className="max-w-48 truncate">“{selectedName}”</span>
              </>
            ) : (
              "Select"
            )}
          </Button>
        </div>
      </DialogFooter>
    </>
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

export interface WorkspaceFolderPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the chosen path and its row (null for a place's own folder, e.g. Home; the file's row when picking files). The dialog then closes. */
  onSelect: (path: string, item: WorkspaceItem | null) => void;
  /** What to choose: a folder (the default), or a file of some types. */
  target?: PickerTarget;
  /** Current value; the picker opens with it selected. Defaults to Home. */
  initialPath?: string;
  /** Extra rule on top of "a folder you can write to", e.g. no hidden folders. */
  isSelectable?: PickerSelectablePredicate;
  /** Defaults to what the target picks: "Select a Folder", "Select a File", … */
  title?: string;
}

const anyFolder: PickerSelectablePredicate = () => true;

export function WorkspaceFolderPickerDialog({
  open,
  onOpenChange,
  onSelect,
  target = folderTarget,
  initialPath = "",
  isSelectable = anyFolder,
  title = pickerTitleFor(target),
}: WorkspaceFolderPickerDialogProps) {
  const [isUploading, setIsUploading] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);
  const [showFiles, setShowFiles] = useState(false);
  const [columnWidths, setColumnWidths] = useState<Record<number, number>>({});
  const [previewWidth, setPreviewWidth] = useState(previewWidthLimits.initial);
  const layout: PickerLayout = {
    showFiles,
    onShowFilesChange: setShowFiles,
    columnWidths,
    onColumnWidthChange: (index, width) => {
      setColumnWidths((previous) => ({ ...previous, [index]: width }));
    },
    previewWidth,
    onPreviewWidthChange: setPreviewWidth,
  };

  const close = () => {
    setIsUploading(false);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next, details) => {
        if (next) {
          onOpenChange(true);
          return;
        }
        // No closing mid-upload, and Esc in the new-folder input only cancels
        // the new folder.
        if (
          isUploading ||
          (details.reason === "escape-key" &&
            isInlineEditTarget(details.event.target))
        ) {
          details.cancel();
          return;
        }
        close();
      }}
    >
      {/* One fixed height, so nothing but the columns scroll and opening
          columns never resizes the dialog. The browser unmounts with the
          popup, so every open starts fresh. */}
      <DialogContent
        className="flex h-[min(42rem,calc(100dvh-2rem))] flex-col overflow-clip sm:max-w-5xl"
        showCloseButton={false}
        initialFocus={() =>
          stripRef.current?.querySelector<HTMLElement>(tabStopSelector) ?? true
        }
      >
        <FolderColumnsBrowser
          layout={layout}
          target={target}
          initialPath={initialPath}
          title={title}
          isSelectable={isSelectable}
          stripRef={stripRef}
          isUploading={isUploading}
          onUploadingChange={setIsUploading}
          onCommit={(path, item) => {
            onSelect(path, item);
            close();
          }}
          onCancel={close}
        />
      </DialogContent>
    </Dialog>
  );
}
