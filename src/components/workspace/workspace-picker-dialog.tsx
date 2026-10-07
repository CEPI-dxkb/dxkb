"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FolderPlus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  buildPickerItems,
  canWriteTo,
  emptyListingMessage,
  filterListing,
  initialPickerState,
  isPickerItemNavigable,
  isPickerItemSelectable,
  locationForView,
  parentLocation,
  parentRowLabel,
  pickerCommitState,
  pickerViewOptions,
  viewForLocation,
  type PickerForeignOrigin,
  type PickerLocation,
  type PickerSelectablePredicate,
  type PickerTarget,
  type PickerView,
} from "@/lib/services/workspace/picker-views";
import { workspaceQueryKeys } from "@/lib/services/workspace/workspace-query-keys";
import { cn } from "@/lib/utils";
import { PickerNewFolderPage } from "./picker-new-folder-page";
import { WorkspaceUploadPanel } from "./upload-panel";
import { WorkspaceMiniBrowserView } from "./workspace-mini-browser-view";

export interface WorkspacePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the chosen path; the dialog then closes. */
  onSelect: (path: string) => void;
  /** A destination folder (default), or a file of the given types. */
  target?: PickerTarget;
  /** Current value; the dialog opens beside it. Defaults to Home. */
  initialPath?: string;
  /** Extra rule on top of `target`, e.g. no hidden folders. */
  isSelectable?: PickerSelectablePredicate;
  title?: string;
}

const folderTarget: PickerTarget = { kind: "folder" };

/** The browser, or one of the pages its toolbar opens in place of it. */
type PickerPage = "browse" | "upload" | "newFolder";

const subpageTitles: Record<Exclude<PickerPage, "browse">, string> = {
  upload: "Upload",
  newFolder: "New Folder",
};

interface PickerSelection {
  path: string;
  /** The row it came from; `null` when it came from the initial value. */
  item: WorkspaceItem | null;
}

function WorkspacePickerForm({
  onOpenChange,
  onSelect,
  target,
  initialPath,
  isSelectable,
  title,
  onBusyChange,
}: Omit<WorkspacePickerDialogProps, "open" | "target" | "title"> & {
  target: PickerTarget;
  title: string;
  /** True while an upload runs, so the dialog can hide its close button. */
  onBusyChange: (busy: boolean) => void;
}) {
  const { user } = useAuth();
  const username = workspaceUsername(user);
  const repository = useWorkspaceRepository("authenticated");
  const queryClient = useQueryClient();
  const destinationId = useId();

  const [initialState] = useState(() =>
    initialPickerState(initialPath, username),
  );
  const [location, setLocation] = useState<PickerLocation>(
    initialState.location,
  );
  const [selection, setSelection] = useState<PickerSelection | null>(
    initialState.selectedPath
      ? { path: initialState.selectedPath, item: null }
      : null,
  );
  /**
   * A row from the workspace being viewed, kept when navigating into it so an
   * empty folder in someone else's workspace still has a permission to check.
   */
  const [permissionEvidence, setPermissionEvidence] =
    useState<WorkspaceItem | null>(null);
  const [origin, setOrigin] = useState<PickerForeignOrigin>("shared");
  const [showAll, setShowAll] = useState(false);
  const [page, setPage] = useState<PickerPage>("browse");
  /** Which way the last page change went; drives the slide direction. */
  const [pageMotion, setPageMotion] = useState<"none" | "forward" | "back">(
    "none",
  );
  const [isUploading, setIsUploading] = useState(false);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const uploadButtonRef = useRef<HTMLButtonElement>(null);
  const newFolderButtonRef = useRef<HTMLButtonElement>(null);
  /** The toolbar button that opened the current page, refocused on return. */
  const openerRef = useRef<Exclude<PickerPage, "browse">>("upload");

  const listing = useWorkspacePickerListing({ location, username });
  const items = buildPickerItems({
    items: filterListing({ location, items: listing.items, target }),
    target,
    showAll,
    keepOrder: location.kind === "list" && location.view === "recent",
  });
  const currentPath = location.kind === "path" ? location.path : null;
  const siblings = currentPath ? listing.items : [];

  const isFolderTarget = target.kind === "folder";
  const committedPath =
    selection?.path ?? (isFolderTarget ? currentPath : null);
  const isViewingDestination =
    isFolderTarget && !selection && currentPath !== null;
  const commit = pickerCommitState({
    target,
    path: committedPath,
    isSelectable,
    writable:
      committedPath !== null &&
      canWriteTo({
        path: committedPath,
        username,
        item: selection ? selection.item : permissionEvidence,
        siblings,
      }),
  });
  const canChangeFolder =
    currentPath !== null &&
    canWriteTo({
      path: currentPath,
      username,
      item: permissionEvidence,
      siblings,
    });

  const goTo = (next: PickerLocation, evidence: WorkspaceItem | null) => {
    setLocation(next);
    setSelection(null);
    setPermissionEvidence(evidence);
  };

  const handleViewChange = (view: PickerView) => {
    if (view === "shared" || view === "public") setOrigin(view);
    goTo(locationForView(view, username), null);
  };

  const parent = currentPath
    ? parentLocation(currentPath, username, origin)
    : null;

  const commitPath = (path: string) => {
    onSelect(path);
    onOpenChange(false);
  };

  const invalidateListings = () => {
    void queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.all });
  };

  const openPage = (next: Exclude<PickerPage, "browse">) => {
    openerRef.current = next;
    setPageMotion("forward");
    setPage(next);
  };

  const goBack = () => {
    setPageMotion("back");
    setPage("browse");
  };

  // Pages replace each other, so the focused control unmounts with its page.
  // Move focus to the new page's first control, and back to the toolbar
  // button that opened it on return. (The new-folder page focuses its input.)
  useEffect(() => {
    if (pageMotion === "none") return;
    if (page === "upload") backButtonRef.current?.focus();
    if (page === "browse") {
      const opener =
        openerRef.current === "upload" ? uploadButtonRef : newFolderButtonRef;
      opener.current?.focus();
    }
  }, [page, pageMotion]);

  const createFolder = useMutation({
    mutationFn: async (name: string) => {
      const path = `${normalizePath(currentPath)}/${sanitizePathSegment(name)}`;
      await repository.createFolder(path);
      return path;
    },
    onSuccess: (path) => {
      setSelection({ path, item: null });
      invalidateListings();
      goBack();
    },
  });

  const viewLabel = isFolderTarget ? "Destination" : "Selection";
  const pageTitle = page === "browse" ? title : subpageTitles[page];

  return (
    <>
      <DialogHeader>
        {/* A margin (not padding) keeps the title clear of the close button. */}
        <div className="mr-8 flex items-center gap-2">
          {page !== "browse" ? (
            <Button
              ref={backButtonRef}
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Back to folders"
              title="Back to folders"
              disabled={isUploading || createFolder.isPending}
              onClick={goBack}
            >
              <ArrowLeft />
            </Button>
          ) : null}
          <DialogTitle>{pageTitle}</DialogTitle>
        </div>
      </DialogHeader>

      <div
        key={page}
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-4",
          pageMotion === "forward" &&
            "duration-200 animate-in fade-in-0 slide-in-from-right-8",
          pageMotion === "back" &&
            "duration-200 animate-in fade-in-0 slide-in-from-left-8",
        )}
      >
        {page === "upload" && currentPath ? (
          <WorkspaceUploadPanel
            targetPath={currentPath}
            onCancel={goBack}
            onUploadComplete={() => {
              invalidateListings();
              goBack();
            }}
            onUploadingChange={(uploading) => {
              setIsUploading(uploading);
              onBusyChange(uploading);
            }}
          />
        ) : page === "newFolder" && currentPath ? (
          <PickerNewFolderPage
            parentPath={currentPath}
            isCreating={createFolder.isPending}
            onCreate={async (name) => {
              await createFolder.mutateAsync(name);
            }}
            onCancel={goBack}
          />
        ) : (
          <>
            {/* Only the listing scrolls: it is the one part allowed to shrink,
                so a short viewport takes height from the table, not from the
                dialog body. */}
            <div className="flex min-h-0 flex-1 flex-col gap-4 pt-1">
              <div className="flex items-center justify-between gap-2">
                <Select
                  value={viewForLocation(location, username, origin)}
                  onValueChange={(value) => {
                    if (value != null) handleViewChange(value);
                  }}
                  items={pickerViewOptions}
                >
                  <SelectTrigger className="w-52" aria-label="Workspace view">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {pickerViewOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1">
                  <Button
                    ref={uploadButtonRef}
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Upload files"
                    title="Upload files"
                    disabled={!canChangeFolder}
                    onClick={() => {
                      openPage("upload");
                    }}
                  >
                    <Upload />
                  </Button>
                  <Button
                    ref={newFolderButtonRef}
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="New folder"
                    title="New folder"
                    disabled={!canChangeFolder}
                    onClick={() => {
                      openPage("newFolder");
                    }}
                  >
                    <FolderPlus />
                  </Button>
                </div>
              </div>

              <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
                <Label htmlFor={destinationId}>
                  {viewLabel}
                  {isViewingDestination ? (
                    <span className="font-normal text-muted-foreground">
                      (currently viewing)
                    </span>
                  ) : null}
                </Label>
                <Input
                  id={destinationId}
                  value={committedPath ?? ""}
                  title={committedPath ?? undefined}
                  disabled
                  placeholder={
                    isFolderTarget
                      ? "Select a folder below"
                      : "Select a file below"
                  }
                />
                {commit.reason ? (
                  <p className="text-xs text-destructive">{commit.reason}</p>
                ) : null}
                <WorkspaceMiniBrowserView
                  className="min-h-0 min-w-0 flex-1"
                  ariaLabel={
                    isFolderTarget
                      ? "Workspace destination browser"
                      : "Workspace file browser"
                  }
                  items={items}
                  isLoading={listing.isLoading}
                  error={listing.error}
                  emptyMessage={emptyListingMessage(location)}
                  selectedPath={selection?.path ?? null}
                  parentRowLabel={parent ? parentRowLabel(parent) : null}
                  onParentClick={() => {
                    if (!parent) return;
                    goTo(
                      parent,
                      parent.kind === "path" ? permissionEvidence : null,
                    );
                  }}
                  isItemNavigable={isPickerItemNavigable}
                  isItemSelectable={(item) =>
                    isPickerItemSelectable(item, target, isSelectable)
                  }
                  onNavigate={(item) => {
                    goTo(
                      { kind: "path", path: normalizePath(item.path) },
                      item,
                    );
                  }}
                  onSelect={(item) => {
                    setSelection({ path: normalizePath(item.path), item });
                  }}
                  onCommit={(item) => {
                    commitPath(normalizePath(item.path));
                  }}
                />
              </div>

              <Label leading="normal" className="cursor-pointer">
                <Checkbox
                  checked={showAll}
                  onCheckedChange={(checked) => {
                    setShowAll(checked);
                  }}
                />
                <span>Show all files and folders</span>
              </Label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!commit.canCommit}
                onClick={() => {
                  if (committedPath && commit.canCommit)
                    commitPath(committedPath);
                }}
              >
                Select
              </Button>
            </DialogFooter>
          </>
        )}
      </div>
    </>
  );
}

/**
 * Workspace browser in a dialog, for choosing a destination folder or an
 * input file: a view switcher (Home, My / Shared / Public Workspaces,
 * Favorites, Recently Used), new folder and upload, and a show-all toggle.
 * New folder and upload open as pages inside the dialog (slide in, back
 * arrow top-left) rather than as dialogs on top of it. The form unmounts with
 * the popup, so every open starts fresh.
 */
export function WorkspacePickerDialog({
  open,
  onOpenChange,
  onSelect,
  target = folderTarget,
  initialPath,
  isSelectable,
  title,
}: WorkspacePickerDialogProps) {
  const [isBusy, setIsBusy] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* One fixed height for every page, so switching pages swaps the
          content in place instead of resizing and re-centring the dialog.
          `overflow-clip`, not `overflow-hidden`: a hidden box can still be
          scrolled by script, and focusing the new-folder input while its page
          is sliding in from the right scrolled the whole dialog sideways. */}
      <DialogContent
        className="flex h-[min(38rem,calc(100dvh-2rem))] flex-col overflow-clip sm:max-w-2xl"
        showCloseButton={!isBusy}
      >
        <WorkspacePickerForm
          onBusyChange={setIsBusy}
          onOpenChange={onOpenChange}
          onSelect={onSelect}
          target={target}
          initialPath={initialPath}
          isSelectable={isSelectable}
          title={
            title ??
            (target.kind === "folder" ? "Select a Folder" : "Select a File")
          }
        />
      </DialogContent>
    </Dialog>
  );
}
