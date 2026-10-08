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
  initialColumnChain,
  isPickerItemNavigable,
  lastSegment,
  locationForView,
  pickerCommitState,
  pickerHomePath,
  viewLabel,
  visibleFolderRows,
  type PickerLocation,
  type PickerSelectablePredicate,
  type PickerView,
} from "@/lib/services/workspace/picker-views";
import { workspaceQueryKeys } from "@/lib/services/workspace/workspace-query-keys";
import { cn } from "@/lib/utils";
import { FolderPickerBreadcrumb } from "./folder-picker-breadcrumb";
import { FolderPickerColumn } from "./folder-picker-column";
import {
  captureColumns,
  playColumnTransition,
  type ColumnsSnapshot,
} from "./folder-picker-motion";
import { FolderPickerInfo, FolderPickerUpload } from "./folder-picker-preview";
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
  initialPath: string;
  title: string;
  isSelectable: PickerSelectablePredicate;
  stripRef: RefObject<HTMLDivElement | null>;
  isUploading: boolean;
  onUploadingChange: (uploading: boolean) => void;
  onCommit: (path: string) => void;
  onCancel: () => void;
}

function FolderColumnsBrowser({
  layout,
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

  const [initial] = useState(() => initialColumnChain(initialPath, username));
  const [place, setPlace] = useState<PickerView>(initial.view);
  /** chain[i] is the folder selected in column i; column i + 1 lists it. */
  const [chain, setChain] = useState<string[]>(initial.chain);
  const { showFiles, onShowFilesChange } = layout;
  const [isNaming, setIsNaming] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  // Bumped whenever the new-folder field opens or closes, which every
  // navigation does, so a creation that finishes after the user moved on can
  // tell and leave the picker alone.
  const namingRevisionRef = useRef(0);
  const setNaming = (naming: boolean) => {
    namingRevisionRef.current += 1;
    setIsNaming(naming);
  };
  const pendingFocusRef = useRef<PendingFocus | null>(
    initial.chain.length > 0
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
  const currentIndex = chain.length - 1;
  const selectedPath =
    chain.at(-1) ?? (rootLocation.kind === "path" ? rootLocation.path : null);
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
    chain.length > 0
      ? (containing.items.find(
          (item) => normalizePath(item.path) === selectedPath,
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
      target: folderTarget,
      path,
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
  const canChange =
    selectedPath !== null &&
    isWritable(selectedPath, selectedItem, selectedEvidence);

  // --- focus -------------------------------------------------------------

  const findRow = (target: PendingFocus) =>
    stripRef.current?.querySelector<HTMLElement>(
      target.path === null
        ? tabStopSelector
        : rowSelector(target.column, target.path),
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
    closePanes();
  };

  const selectAt = (column: number, item: WorkspaceItem) => {
    if (!isPickerItemNavigable(item)) return;
    // Keyboard moves focus before selecting, so nothing is left pending here;
    // a stale request must not pull focus back after the user moved on.
    pendingFocusRef.current = null;
    prepareTransition();
    setChain([...chain.slice(0, column), normalizePath(item.path)]);
    closePanes();
  };

  const enterChild = (column: number, item: WorkspaceItem) => {
    if (!isPickerItemNavigable(item)) return;
    const path = normalizePath(item.path);
    if (chain.at(column) !== path) {
      selectAt(column, item);
      return;
    }
    const deeper = chain.at(column + 1);
    if (deeper) {
      focusRow(column + 1, deeper);
      return;
    }
    const first = visibleFolderRows(
      lastLocation,
      contents.items,
      showFiles,
    ).find(isPickerItemNavigable);
    if (!first) return;
    const firstPath = normalizePath(first.path);
    prepareTransition();
    focusRow(column + 1, firstPath);
    setChain([...chain, firstPath]);
    closePanes();
  };

  const exitToParent = (column: number) => {
    const parentPath = column > 0 ? chain.at(column - 1) : undefined;
    if (!parentPath) return;
    prepareTransition();
    focusRow(column - 1, parentPath);
    setChain(chain.slice(0, column));
    closePanes();
  };

  const jumpTo = (depth: number) => {
    const target = depth > 0 ? chain.at(depth - 1) : undefined;
    prepareTransition();
    if (target) focusRow(depth - 1, target);
    else pendingFocusRef.current = { column: 0, path: null };
    setChain(chain.slice(0, depth));
    closePanes();
  };

  const commitRow = (item: WorkspaceItem, siblings: WorkspaceItem[]) => {
    const path = normalizePath(item.path);
    if (commitStateFor(path, item, evidenceFor(path, siblings)).canCommit)
      onCommit(path);
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
    const revision = namingRevisionRef.current;
    const path = await createFolder.mutateAsync({ parent: selectedPath, name });
    // The user navigated or closed the field meanwhile: the folder is in its
    // listing, but the selection, the field and focus are theirs now.
    if (namingRevisionRef.current !== revision) return;
    // Select it, opening its empty column. Nothing has moved since the field
    // opened, so this render's chain is still current.
    prepareTransition();
    setChain([...chain, path]);
    setNaming(false);
    pendingFocusRef.current = { column, path };
  };

  const isRowWritable = (item: WorkspaceItem, siblings: WorkspaceItem[]) => {
    const path = normalizePath(item.path);
    return isWritable(path, item, evidenceFor(path, siblings));
  };
  const isRowUsable = (item: WorkspaceItem) =>
    isSelectable({ name: item.name, path: item.path });

  const selectedName =
    selectedPath === homePath
      ? "Home"
      : selectedPath
        ? lastSegment(selectedPath)
        : "";

  return (
    <>
      <DialogHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Click a folder to open it. Double-click it, or press Enter, to
              choose it.
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
              {showFiles ? "Hide files" : "Show files"}
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
                    label={
                      parent
                        ? parent === homePath
                          ? "Home"
                          : lastSegment(parent)
                        : viewLabel(place)
                    }
                    username={username}
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
                    selectedPath={chain.at(index) ?? null}
                    isCurrent={index === currentIndex}
                    hasTabStop={index === Math.max(currentIndex, 0)}
                    folderVariant={columnFolderVariant(index, place)}
                    showOwner={
                      index === 0 && (place === "shared" || place === "public")
                    }
                    inert={isUploading}
                    newFolder={
                      isLast && isNaming
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
          {isUploadOpen && selectedPath ? (
            <FolderPickerUpload
              targetPath={selectedPath}
              homePath={homePath}
              isUploading={isUploading}
              onBack={() => {
                setIsUploadOpen(false);
                pendingFocusRef.current = { column: 0, path: null };
              }}
              onComplete={() => {
                void queryClient.invalidateQueries({
                  queryKey: workspaceQueryKeys.all,
                });
                setIsUploadOpen(false);
                pendingFocusRef.current = { column: 0, path: null };
              }}
              onUploadingChange={onUploadingChange}
            />
          ) : (
            <FolderPickerInfo
              place={place}
              path={selectedPath}
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
          chain={chain}
          homePath={homePath}
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
            disabled={!commit.canCommit || isUploading}
            onClick={() => {
              if (selectedPath && commit.canCommit) onCommit(selectedPath);
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
  /** Called with the chosen folder; the dialog then closes. */
  onSelect: (path: string) => void;
  /** Current value; the picker opens with it selected. Defaults to Home. */
  initialPath?: string;
  /** Extra rule on top of "a folder you can write to", e.g. no hidden folders. */
  isSelectable?: PickerSelectablePredicate;
  title?: string;
}

const anyFolder: PickerSelectablePredicate = () => true;

export function WorkspaceFolderPickerDialog({
  open,
  onOpenChange,
  onSelect,
  initialPath = "",
  isSelectable = anyFolder,
  title = "Select a Folder",
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
          initialPath={initialPath}
          title={title}
          isSelectable={isSelectable}
          stripRef={stripRef}
          isUploading={isUploading}
          onUploadingChange={setIsUploading}
          onCommit={(path) => {
            onSelect(path);
            close();
          }}
          onCancel={close}
        />
      </DialogContent>
    </Dialog>
  );
}
