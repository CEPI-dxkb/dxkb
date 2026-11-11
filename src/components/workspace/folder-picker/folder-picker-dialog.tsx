"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import type { UploadedFile } from "@/components/workspace/upload-panel";
import type { FolderIconVariant } from "@/components/workspace/workspace-item-icon";
import { useWorkspaceRepository } from "@/contexts/workspace-repository-context";
import { useKeptQueryError } from "@/hooks/services/jobs/use-kept-query-error";
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
import { FolderPickerHeader } from "./folder-picker-header";
import { FolderPickerPlacesNav } from "./folder-picker-places-nav";
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
  previewWidthLimits,
  rowSelector,
  tabStopSelector,
  uploadPaneMinWidth,
} from "./folder-picker-utils";
import { useColumnStripMotion } from "./use-column-strip-motion";

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

interface PendingFocus {
  column: number;
  path: string | null;
}

interface PickerLayout {
  showFiles: boolean;
  onShowFilesChange: (showFiles: boolean) => void;
  columnWidths: Record<number, number>;
  onColumnWidthChange: (index: number, width: number) => void;
  previewWidth: number;
  onPreviewWidthChange: (width: number) => void;
}

interface FolderColumnsBrowserProps {
  layout: PickerLayout;
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
  const [chain, setChain] = useState<string[]>(initial.chain);
  const [file, setFile] = useState<string | null>(initial.file);
  const { showFiles, onShowFilesChange } = layout;
  const [isNaming, setIsNaming] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  // Bumped whenever the new-folder field opens or closes, so work that finishes after the
  // user moved on can tell and leave the picker alone.
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
  const currentIndex = file ? lastIndex : chain.length - 1;
  const selectedPath =
    file ??
    chain.at(-1) ??
    (rootLocation.kind === "path" ? rootLocation.path : null);
  const labelFor = (path: string) => pickerPathLabel(path, homePath, target);
  const lastLocation = columnLocation(lastIndex);

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

  // The rows `canWriteTo` falls back on come from the folder's own workspace first: in
  // Favorites and Recently Used the containing rows are stubs with no permission when
  // their workspace is not in `/`.
  const selectedEvidence = contents.items.some((item) => item.permissions)
    ? contents.items
    : containing.items;
  const evidenceFor = (path: string, siblings: WorkspaceItem[]) =>
    path === selectedPath ? selectedEvidence : siblings;

  const commit = commitStateFor(selectedPath, selectedItem, selectedEvidence);
  // The error is kept through Retry, as the column keeps its own: TanStack clears it when
  // a listing with no rows refetches, which would offer New folder, Upload and Select for
  // the whole wait.
  const listingError = useKeptQueryError(
    {
      error: containing.error ?? contents.error,
      hasData:
        !containing.isLoading &&
        !contents.isLoading &&
        containing.error === null &&
        contents.error === null,
    },
    JSON.stringify([
      username,
      columnLocation(Math.max(currentIndex, 0)),
      lastLocation,
    ]),
  ) as Error | null;
  const canCommitNow =
    commit.canCommit && !containing.isLoading && listingError === null;
  const folderPath = file
    ? (chain.at(-1) ??
      (rootLocation.kind === "path" ? rootLocation.path : null))
    : selectedPath;
  const canChange =
    listingError === null &&
    folderPath !== null &&
    isWritable(folderPath, file ? null : selectedItem, selectedEvidence);

  const findRow = (pending: PendingFocus) =>
    stripRef.current?.querySelector<HTMLElement>(
      pending.path === null
        ? tabStopSelector
        : rowSelector(pending.column, pending.path),
    ) ?? null;

  // `preventScroll`: focusing a row would scroll the strip sideways on its own;
  // `useColumnStripMotion` owns that.
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

  const lastPath = chain.at(-1) ?? "";
  const { contentRef, overlayRef, prepareTransition } = useColumnStripMotion({
    stripRef,
    place,
    lastIndex,
    currentIndex,
    lastPath,
  });

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

  const selectAt = (column: number, item: WorkspaceItem) => {
    if (!isPickerItemInteractive(item, target)) return;
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
    if (depth > chain.length) return;
    const folder = depth > 0 ? chain.at(depth - 1) : undefined;
    prepareTransition();
    if (folder) focusRow(depth - 1, folder);
    else pendingFocusRef.current = { column: 0, path: null };
    setChain(chain.slice(0, depth));
    setFile(null);
    closePanes();
  };

  // A column that loads without its selected row ends the chain at its own folder; focus
  // follows only if it was still headed to that row.
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
    if (path === selectedPath && listingError !== null) return;
    if (commitStateFor(path, item, evidenceFor(path, siblings)).canCommit)
      onCommit(path, item);
  };

  const createFolder = useMutation({
    mutationFn: async ({ parent, name }: { parent: string; name: string }) => {
      const path = `${normalizePath(parent)}/${sanitizePathSegment(name)}`;
      await repository.createFolder(path);
      return path;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.all }),
  });

  const handleCreate = async (name: string) => {
    if (!selectedPath) return;
    const column = lastIndex;
    const revision = revisionRef.current;
    const path = await createFolder.mutateAsync({ parent: selectedPath, name });
    if (revisionRef.current !== revision) return;
    prepareTransition();
    setChain([...chain, path]);
    setNaming(false);
    pendingFocusRef.current = { column, path };
  };

  const handleUploadComplete = (uploaded: UploadedFile[]) => {
    // Closed at once; the panel keeps its files, so left open while the listings refresh
    // it would offer the same upload again.
    setIsUploadOpen(false);
    pendingFocusRef.current = { column: 0, path: null };
    const only = uploaded.length === 1 ? uploaded[0] : undefined;
    const pick =
      target.kind === "object" && only && target.types.includes(only.type)
        ? only.path
        : null;
    const revision = revisionRef.current;
    void (async () => {
      // Awaited so the file is in its column's listing when selected; otherwise it would
      // be dropped as gone.
      await queryClient.invalidateQueries({
        queryKey: workspaceQueryKeys.all,
      });
      if (!pick || revisionRef.current !== revision) return;
      setFile(pick);
      pendingFocusRef.current = { column: lastIndex, path: pick };
    })();
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
      <FolderPickerHeader
        title={title}
        target={target}
        showFiles={showFiles}
        onShowFilesChange={onShowFilesChange}
        isUploading={isUploading}
      />

      <div className="-mx-4 -mb-4 flex min-h-0 flex-1 flex-col border-t md:flex-row">
        <FolderPickerPlacesNav
          place={place}
          isUploading={isUploading}
          onSelectPlace={selectPlace}
        />

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
          {/* React renders this overlay empty and never touches its children;
             exiting columns play here. */}
          <div
            ref={overlayRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden"
          />
        </div>

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
          // `-ml-px` lays this border over the last column's so the two never show as a
          // double line.
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
              onComplete={handleUploadComplete}
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
              listingError={listingError}
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

export interface WorkspaceFolderPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (path: string, item: WorkspaceItem | null) => void;
  target?: PickerTarget;
  initialPath?: string;
  isSelectable?: PickerSelectablePredicate;
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
        // No closing mid-upload, and Esc in the new-folder input only cancels the new
        // folder.
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
