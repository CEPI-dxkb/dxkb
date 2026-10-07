"use client";

/**
 * PROTOTYPE — variant D: a full-height side sheet from the right, so the BLAST
 * form stays in view, with one scrolling folder tree (My Workspaces / Shared
 * with me / Public), quick-access chips, inline new-folder rows, and an upload
 * panel docked above the footer. The tree itself is `variant-d-folder-tree.tsx`.
 */

import { useRef, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronUp,
  CircleAlert,
  Clock,
  Folder,
  FolderOpen,
  Star,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { WorkspaceUploadPanel } from "@/components/workspace/upload-panel";
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
  isOwnPath,
  pickerCommitState,
  pickerHomePath,
  type PickerLocation,
  type PickerSelectablePredicate,
} from "@/lib/services/workspace/picker-views";
import { workspaceQueryKeys } from "@/lib/services/workspace/workspace-query-keys";
import { cn } from "@/lib/utils";
import type { FolderPickerVariantProps } from "./types";
import {
  FolderTree,
  folderTarget,
  isDescendantKey,
  nodeKey,
  sectionKey,
  type FolderTreeState,
  type TreeNodeTarget,
  type TreeSectionId,
} from "./variant-d-folder-tree";

/** A listing location that issues no query (recent folders read storage). */
const idleLocation: PickerLocation = { kind: "list", view: "recent" };
const recentLocation: PickerLocation = { kind: "list", view: "recent" };
const favoritesLocation: PickerLocation = { kind: "list", view: "favorites" };

const recentLimit = 4;
const favoritesLimit = 5;

function pathSegments(path: string): string[] {
  return normalizePath(path).split("/").filter(Boolean);
}

function folderLabel(path: string, username: string): string {
  if (normalizePath(path) === pickerHomePath(username)) return "Home";
  return pathSegments(path).at(-1) ?? path;
}

/**
 * Where a path sits in the tree, and the keys to expand so its node renders.
 * Foreign paths are revealed under Shared (a folder destination must be
 * writable, and Public is read-only).
 */
function revealPlan(
  path: string,
  username: string,
): { key: string; expand: string[] } {
  const section: TreeSectionId = isOwnPath(path, username) ? "mine" : "shared";
  const segments = pathSegments(path);
  const expand = [sectionKey(section)];
  for (let depth = 2; depth < segments.length; depth++) {
    expand.push(nodeKey(section, `/${segments.slice(0, depth).join("/")}`));
  }
  return { key: nodeKey(section, path), expand };
}

/**
 * A selection made from a bare path (initial value, quick access, a new
 * folder) has no permissions. For someone else's folder, read the listing that
 * holds it: the folder's own row, or a sibling's (permissions are per
 * workspace).
 */
function evidenceLocation(
  selection: TreeNodeTarget | null,
  username: string,
): PickerLocation {
  if (!selection || selection.item || isOwnPath(selection.path, username)) {
    return idleLocation;
  }
  const segments = pathSegments(selection.path);
  if (segments.length <= 2) return { kind: "list", view: "shared" };
  return { kind: "path", path: `/${segments.slice(0, -1).join("/")}` };
}

function initialSheetState(value: string, username: string) {
  const expanded = new Set([
    sectionKey("mine"),
    nodeKey("mine", pickerHomePath(username)),
  ]);
  const path = normalizePath(value);
  if (pathSegments(path).length < 2) {
    return { expanded, selection: null, reveal: null };
  }
  const plan = revealPlan(path, username);
  for (const key of plan.expand) expanded.add(key);
  return {
    expanded,
    selection: { key: plan.key, path, item: null } satisfies TreeNodeTarget,
    reveal: { key: plan.key, focus: false },
  };
}

function SelectedPill({
  path,
  canCommit,
  isChecking,
  reason,
}: {
  path: string | null;
  canCommit: boolean;
  isChecking: boolean;
  reason: string | null;
}) {
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <div
        className={cn(
          "flex min-w-0 items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-xs",
          path === null && "border-dashed text-muted-foreground",
          path !== null && canCommit && "border-primary/40 bg-primary/10",
          path !== null &&
            !canCommit &&
            !isChecking &&
            "border-destructive/40 bg-destructive/10",
        )}
      >
        <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
          Selected
        </span>
        {path !== null ? (
          <>
            <FolderOpen className="size-3.5 shrink-0 text-highlight" />
            <span className="min-w-0 truncate font-mono" title={path}>
              {path}
            </span>
            {isChecking ? <Spinner className="size-3 shrink-0" /> : null}
          </>
        ) : (
          <span className="truncate">Nothing yet. Pick a folder below.</span>
        )}
      </div>
      {reason ? (
        <p
          role="status"
          className="flex items-center gap-1.5 text-xs text-destructive"
        >
          <CircleAlert className="size-3.5 shrink-0" />
          {reason}
        </p>
      ) : null}
    </div>
  );
}

function QuickAccessRow({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="flex h-6 w-20 shrink-0 items-center gap-1.5 text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
        <Icon className="size-3 shrink-0" />
        {label}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {children}
      </div>
    </div>
  );
}

function QuickAccess({
  username,
  selectedPath,
  isSelectable,
  onPick,
  onCommit,
}: {
  username: string;
  selectedPath: string | null;
  isSelectable: PickerSelectablePredicate;
  onPick: (path: string) => void;
  onCommit: (path: string) => void;
}) {
  const recent = useWorkspacePickerListing({
    location: recentLocation,
    username,
  });
  const favorites = useWorkspacePickerListing({
    location: favoritesLocation,
    username,
  });
  const [showAllFavorites, setShowAllFavorites] = useState(false);

  const recentItems = buildPickerItems({
    items: recent.items,
    target: folderTarget,
    showAll: false,
    keepOrder: true,
  }).slice(0, recentLimit);
  const allFavorites = buildPickerItems({
    items: favorites.items,
    target: folderTarget,
    showAll: false,
    keepOrder: true,
  });
  const favoriteItems = showAllFavorites
    ? allFavorites
    : allFavorites.slice(0, favoritesLimit);
  const moreFavorites = allFavorites.length - favoriteItems.length;

  const chip = (item: WorkspaceItem) => {
    const path = normalizePath(item.path);
    const selected = selectedPath === path;
    // Bare paths: only own folders are known to be writable up front.
    const quickCommit = pickerCommitState({
      target: folderTarget,
      path,
      writable: canWriteTo({ path, username, item: null, siblings: [] }),
      isSelectable,
    });
    return (
      <Button
        key={path}
        type="button"
        variant={selected ? "soft" : "outline"}
        size="xs"
        aria-pressed={selected}
        title={path}
        onClick={() => {
          onPick(path);
        }}
        onDoubleClick={() => {
          if (quickCommit.canCommit) onCommit(path);
        }}
      >
        <Folder className="text-highlight" />
        <span className="max-w-28 truncate">{folderLabel(path, username)}</span>
      </Button>
    );
  };

  return (
    <div className="flex shrink-0 flex-col gap-2 border-b px-4 py-3">
      <QuickAccessRow label="Recent" icon={Clock}>
        {recentItems.length > 0 ? (
          recentItems.map(chip)
        ) : (
          <span className="text-xs text-muted-foreground">
            Folders you open in the workspace show up here.
          </span>
        )}
      </QuickAccessRow>
      <QuickAccessRow label="Favorites" icon={Star}>
        {favorites.isLoading ? (
          <>
            <Skeleton className="h-6 w-20 rounded-md" />
            <Skeleton className="h-6 w-16 rounded-md" />
          </>
        ) : favorites.error ? (
          <span className="text-xs text-destructive">
            {favorites.error.message}
          </span>
        ) : favoriteItems.length > 0 ? (
          <>
            {favoriteItems.map(chip)}
            {moreFavorites > 0 || showAllFavorites ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => {
                  setShowAllFavorites(!showAllFavorites);
                }}
              >
                {showAllFavorites ? "Fewer" : `+${String(moreFavorites)} more`}
              </Button>
            ) : null}
          </>
        ) : (
          <span className="text-xs text-muted-foreground">
            Star folders in the workspace to pin them here.
          </span>
        )}
      </QuickAccessRow>
    </div>
  );
}

function PickerSheet({
  open,
  onOpenChange,
  value,
  onChange,
  isSelectable,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onChange: (path: string) => void;
  isSelectable: PickerSelectablePredicate;
  title: string;
}) {
  const { user } = useAuth();
  const username = workspaceUsername(user);
  const repository = useWorkspaceRepository("authenticated");
  const queryClient = useQueryClient();
  const treeRef = useRef<HTMLUListElement>(null);

  // This component remounts on every open (see `VariantD`), so every open
  // starts from the field's value.
  const [initial] = useState(() => initialSheetState(value, username));
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    initial.expanded,
  );
  const [selection, setSelection] = useState<TreeNodeTarget | null>(
    initial.selection,
  );
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [reveal, setReveal] = useState<FolderTreeState["reveal"]>(
    initial.reveal,
  );
  const [creatingKey, setCreatingKey] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const evidence = useWorkspacePickerListing({
    location: open ? evidenceLocation(selection, username) : idleLocation,
    username,
  });
  const selectionItem = selection
    ? (selection.item ??
      evidence.items.find(
        (item) => normalizePath(item.path) === selection.path,
      ) ??
      null)
    : null;
  const writable =
    selection !== null &&
    canWriteTo({
      path: selection.path,
      username,
      item: selectionItem,
      siblings: selection.item ? [] : evidence.items,
    });
  const isCheckingAccess =
    selection !== null &&
    !selection.item &&
    !isOwnPath(selection.path, username) &&
    evidence.isLoading;
  const commit = pickerCommitState({
    target: folderTarget,
    path: selection?.path ?? null,
    writable,
    isSelectable,
  });
  const canCommit = commit.canCommit && !isUploading;

  const invalidateListings = () => {
    void queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.all });
  };

  const commitPath = (path: string) => {
    onChange(path);
    onOpenChange(false);
  };

  const createFolder = useMutation({
    mutationFn: async ({
      parentPath,
      name,
    }: {
      parentPath: string;
      name: string;
    }) => {
      const path = `${normalizePath(parentPath)}/${sanitizePathSegment(name)}`;
      await repository.createFolder(path);
      return path;
    },
  });

  const select = (node: TreeNodeTarget) => {
    setSelection(node);
    // An open upload panel follows the selection to any folder it can use.
    if (
      uploadOpen &&
      !isUploading &&
      canWriteTo({
        path: node.path,
        username,
        item: node.item,
        siblings: [],
      })
    ) {
      setUploadTarget(node.path);
    }
  };

  // An updater: `onCreate` calls this after an await, from a stale render.
  const expand = (keys: string[]) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      for (const key of keys) next.add(key);
      return next;
    });
  };

  const toggle = (key: string) => {
    const next = new Set(expanded);
    const collapsing = next.has(key);
    if (collapsing) next.delete(key);
    else next.add(key);
    setExpanded(next);
    setReveal(null);
    if (!collapsing) return;
    if (focusKey !== null && isDescendantKey(focusKey, key)) setFocusKey(key);
    if (
      creatingKey !== null &&
      (creatingKey === key || isDescendantKey(creatingKey, key))
    ) {
      setCreatingKey(null);
    }
  };

  const revealPath = (path: string) => {
    const plan = revealPlan(path, username);
    expand(plan.expand);
    select({ key: plan.key, path, item: null });
    setReveal({ key: plan.key, focus: false });
  };

  const treeState: FolderTreeState = {
    username,
    isSelectable,
    expanded,
    selectedKey: selection?.key ?? null,
    focusKey,
    reveal,
    creatingKey,
    isCreating: createFolder.isPending,
    isUploading,
    onToggle: toggle,
    onFocusNode: (key, node) => {
      setFocusKey(key);
      if (reveal?.focus && reveal.key === key) setReveal(null);
      if (node) select(node);
    },
    onCommit: commitPath,
    onStartCreate: (node) => {
      select(node);
      expand([node.key]);
      setCreatingKey(node.key);
    },
    onCancelCreate: () => {
      setCreatingKey(null);
    },
    onCreate: async ({ parentKey, section, parentPath, name }) => {
      const path = await createFolder.mutateAsync({ parentPath, name });
      invalidateListings();
      const key = nodeKey(section, path);
      expand([parentKey]);
      setCreatingKey(null);
      select({ key, path, item: null });
      setFocusKey(key);
      setReveal({ key, focus: true });
    },
    onStartUpload: (node) => {
      setSelection(node);
      setUploadTarget(node.path);
      setUploadOpen(true);
    },
  };

  const closeUpload = () => {
    setUploadOpen(false);
    setUploadTarget(null);
  };

  /** What the dock would upload into if opened now. */
  const dockPath = uploadOpen
    ? uploadTarget
    : selection && writable
      ? selection.path
      : uploadTarget;

  return (
    <Sheet
      open={open}
      onOpenChange={(next, details) => {
        if (!next && isUploading) {
          details.cancel();
          return;
        }
        onOpenChange(next);
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={!isUploading}
        className="data-[side=right]:w-full data-[side=right]:sm:max-w-md"
        initialFocus={() =>
          treeRef.current?.querySelector<HTMLElement>(
            '[role="treeitem"][tabindex="0"]',
          ) ?? true
        }
      >
        {/* One child, so the sheet's own gap does not apply; header, quick
            access, dock and footer are fixed and only the tree scrolls. */}
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 flex-col gap-1 border-b px-4 pt-4 pb-3">
            <div className="mr-8">
              <SheetTitle>{title}</SheetTitle>
            </div>
            <SheetDescription>
              Click to select, double-click or Enter to use a folder. Arrow
              keys walk the tree.
            </SheetDescription>
            <SelectedPill
              path={selection?.path ?? null}
              canCommit={commit.canCommit}
              isChecking={isCheckingAccess}
              reason={isCheckingAccess ? null : commit.reason}
            />
          </div>

          <QuickAccess
            username={username}
            selectedPath={selection?.path ?? null}
            isSelectable={isSelectable}
            onPick={revealPath}
            onCommit={commitPath}
          />

          <div className="min-h-32 flex-1 overflow-y-auto p-2">
            <FolderTree state={treeState} treeRef={treeRef} />
          </div>

          <Collapsible
            open={uploadOpen}
            disabled={isUploading || (!uploadOpen && dockPath === null)}
            onOpenChange={(next) => {
              if (!next) {
                setUploadOpen(false);
                return;
              }
              if (dockPath === null) return;
              setUploadTarget(dockPath);
              setUploadOpen(true);
            }}
            className="flex max-h-[55%] min-h-0 shrink-0 flex-col border-t bg-muted/30"
          >
            <CollapsibleTrigger className="flex h-11 w-full shrink-0 items-center gap-2 px-4 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset data-disabled:cursor-not-allowed data-disabled:opacity-60 data-disabled:hover:bg-transparent">
              <Upload className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">
                {dockPath !== null ? (
                  <>
                    Upload to{" "}
                    <span className="font-medium" title={dockPath}>
                      {folderLabel(dockPath, username)}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    Select a folder you can write to, to upload files
                  </span>
                )}
              </span>
              <ChevronUp
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform",
                  uploadOpen && "rotate-180",
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="flex min-h-0 flex-1 flex-col">
              {uploadTarget !== null ? (
                // The panel's footer bleeds -mx-4 -mb-4 for a p-4 dialog.
                <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
                  <WorkspaceUploadPanel
                    targetPath={uploadTarget}
                    cancelLabel="Close upload"
                    onCancel={closeUpload}
                    onUploadComplete={() => {
                      invalidateListings();
                      closeUpload();
                    }}
                    onUploadingChange={setIsUploading}
                  />
                </div>
              ) : null}
            </CollapsibleContent>
          </Collapsible>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t px-4 py-3">
            <Button
              type="button"
              variant="outline"
              disabled={isUploading}
              onClick={() => {
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!canCommit}
              onClick={() => {
                if (selection && canCommit) commitPath(selection.path);
              }}
            >
              Select
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function VariantD({
  value,
  onChange,
  disabled,
  isSelectable,
  title,
}: FolderPickerVariantProps) {
  const [open, setOpen] = useState(false);
  // Bumped on every open: remounting the sheet resets all of its state.
  const [session, setSession] = useState(0);

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
          setSession(session + 1);
          setOpen(true);
        }}
      >
        <FolderOpen />
      </Button>
      <PickerSheet
        key={session}
        open={open}
        onOpenChange={setOpen}
        value={value}
        onChange={onChange}
        isSelectable={isSelectable}
        title={title}
      />
    </>
  );
}
