"use client";

/**
 * PROTOTYPE — variant C: no modal. The folder button opens a keyboard-first
 * command palette anchored under the field: a path bar (breadcrumb + filter),
 * click or ↵ to choose a folder, → to drill in, ← to go up, type a new name to
 * create it, and upload in place.
 */

import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Command as CommandPrimitive } from "cmdk";
import {
  ArrowLeft,
  ChevronRight,
  CornerLeftUp,
  Ellipsis,
  Folder,
  FolderLock,
  FolderOpen,
  FolderPlus,
  FolderX,
  Globe,
  HardDrive,
  History,
  House,
  Star,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CommandFooter,
  CommandFooterHint,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  emptyListingMessage,
  filterListing,
  folderNameError,
  initialPickerState,
  isOwnPath,
  isPickerItemNavigable,
  locationForView,
  parentLocation,
  pickerCommitState,
  pickerHomePath,
  pickerViewOptions,
  viewForLocation,
  type PickerForeignOrigin,
  type PickerListView,
  type PickerLocation,
  type PickerSelectablePredicate,
  type PickerTarget,
  type PickerView,
} from "@/lib/services/workspace/picker-views";
import { workspaceQueryKeys } from "@/lib/services/workspace/workspace-query-keys";
import { cn } from "@/lib/utils";
import type { FolderPickerVariantProps } from "./types";

const folderTarget: PickerTarget = { kind: "folder" };
const recentLocation: PickerLocation = { kind: "list", view: "recent" };
const favoritesLocation: PickerLocation = { kind: "list", view: "favorites" };
/** Quick jumps shown above the Home listing, per group. */
const quickJumpLimit = 3;
/** Breadcrumbs beyond this collapse their middle into an ellipsis. */
const maxCrumbs = 4;
const createValue = "action:create";
const allRecentValue = "action:all-recent";
const allFavoritesValue = "action:all-favorites";

type PalettePage = "browse" | "upload";

/** Keeps a control's keys away from the cmdk root around it. */
function stopKeys(event: KeyboardEvent<HTMLDivElement>) {
  event.stopPropagation();
}

interface Scope {
  value: PickerView;
  /** Short label for the segmented switcher. */
  label: string;
  icon: LucideIcon;
}

const scopes: readonly Scope[] = [
  { value: "home", label: "Home", icon: House },
  { value: "myWorkspaces", label: "Mine", icon: HardDrive },
  { value: "shared", label: "Shared", icon: Users },
  { value: "public", label: "Public", icon: Globe },
  { value: "favorites", label: "Favorites", icon: Star },
  { value: "recent", label: "Recent", icon: History },
];

function scopeFor(view: PickerView): Scope {
  return scopes.find((scope) => scope.value === view) ?? scopes[0];
}

function fullViewLabel(view: PickerView): string {
  return pickerViewOptions.find((option) => option.value === view)?.label ?? "";
}

function segmentsOf(path: string): string[] {
  return normalizePath(path).split("/").filter(Boolean);
}

function joinSegments(segments: string[]): string {
  return `/${segments.join("/")}`;
}

function parentPathOf(path: string): string {
  return joinSegments(segmentsOf(path).slice(0, -1));
}

/** "Home" for the home workspace, else the last segment. */
function folderLabel(path: string, username: string): string {
  if (normalizePath(path) === pickerHomePath(username)) return "Home";
  return segmentsOf(path).at(-1) ?? "/";
}

/** A path as people say it: "Home/Projects", "ws/sub", "alice@bvbrc/ws". */
function displayPath(path: string, username: string): string {
  const normalized = normalizePath(path);
  const segments = segmentsOf(normalized);
  const home = pickerHomePath(username);
  if (normalized === home || normalized.startsWith(`${home}/`)) {
    return `Home${normalized.slice(home.length)}`;
  }
  if (isOwnPath(normalized, username)) {
    return segments.length <= 1 ? "My Workspaces" : segments.slice(1).join("/");
  }
  return segments.join("/");
}

interface Crumb {
  key: string;
  label: string;
  title: string;
  target: PickerLocation;
  icon?: LucideIcon;
  iconOnly?: boolean;
}

/** Breadcrumb for a location, rooted at the switcher scope it belongs to. */
function crumbsFor(
  location: PickerLocation,
  username: string,
  origin: PickerForeignOrigin,
): Crumb[] {
  if (location.kind === "list") {
    const label = fullViewLabel(location.view);
    return [
      {
        key: location.view,
        label,
        title: label,
        target: location,
        icon: scopeFor(location.view).icon,
      },
    ];
  }
  const segments = segmentsOf(location.path);
  const owner = segments.at(0) ?? "";
  const workspace = segments.at(1) ?? "";
  const crumbs: Crumb[] = [];
  if (owner === username && workspace === "home") {
    crumbs.push({
      key: "home",
      label: "Home",
      title: pickerHomePath(username),
      target: { kind: "path", path: pickerHomePath(username) },
      icon: House,
    });
  } else {
    const rootView: PickerListView =
      owner === username ? "myWorkspaces" : origin;
    crumbs.push({
      key: rootView,
      label: scopeFor(rootView).label,
      title: fullViewLabel(rootView),
      target: { kind: "list", view: rootView },
      icon: scopeFor(rootView).icon,
    });
    if (workspace) {
      const workspacePath = joinSegments([owner, workspace]);
      crumbs.push({
        key: workspacePath,
        label: workspace,
        title: workspacePath,
        target: { kind: "path", path: workspacePath },
      });
    }
  }
  for (let index = 2; index < segments.length; index += 1) {
    const path = joinSegments(segments.slice(0, index + 1));
    crumbs.push({
      key: path,
      label: segments.at(index) ?? "",
      title: path,
      target: { kind: "path", path },
    });
  }
  if (crumbs.length <= maxCrumbs) return crumbs;
  const hidden = crumbs.slice(1, -2);
  const lastHidden = hidden.at(-1);
  const first = crumbs.at(0);
  if (!lastHidden || !first) return crumbs;
  return [
    first,
    {
      key: "ellipsis",
      label: hidden.map((crumb) => crumb.label).join(" / "),
      title: `Up to ${lastHidden.label}`,
      target: lastHidden.target,
      icon: Ellipsis,
      iconOnly: true,
    },
    ...crumbs.slice(-2),
  ];
}

/** Name matches first by prefix, then anywhere. */
function rankMatches(items: WorkspaceItem[], needle: string): WorkspaceItem[] {
  const prefix: WorkspaceItem[] = [];
  const anywhere: WorkspaceItem[] = [];
  for (const item of items) {
    const name = item.name.toLowerCase();
    if (name.startsWith(needle)) prefix.push(item);
    else if (name.includes(needle)) anywhere.push(item);
  }
  return [...prefix, ...anywhere];
}

function MatchedName({ name, needle }: { name: string; needle: string }) {
  const index = needle ? name.toLowerCase().indexOf(needle) : -1;
  if (index < 0) return name;
  return (
    <>
      {name.slice(0, index)}
      <span className="font-semibold text-foreground">
        {name.slice(index, index + needle.length)}
      </span>
      {name.slice(index + needle.length)}
    </>
  );
}

/** "Show all 7 favorites…" under a capped quick-jump group. */
function ShowAllRow({
  value,
  view,
  count,
  onSelect,
}: {
  value: string;
  view: PickerView;
  count: number;
  onSelect: () => void;
}) {
  return (
    <CommandItem value={value} onSelect={onSelect}>
      <span className="flex size-4 shrink-0" />
      <span className="text-xs text-muted-foreground">
        Show all {String(count)} {fullViewLabel(view).toLowerCase()}…
      </span>
    </CommandItem>
  );
}

type RowGroup = "recent" | "favorite" | "folder";

interface FolderRow {
  /** cmdk value; prefixed so a folder can sit in two groups. */
  value: string;
  item: WorkspaceItem;
  path: string;
  name: string;
  writable: boolean;
  canCommit: boolean;
  reason: string | null;
  /** Where the folder lives, for rows outside the folder being browsed. */
  context: string | null;
}

interface PaletteProps {
  value: string;
  isSelectable: PickerSelectablePredicate;
  title: string;
  page: PalettePage;
  onPageChange: (page: PalettePage) => void;
  isUploading: boolean;
  onUploadingChange: (uploading: boolean) => void;
  onCommit: (path: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}

function FolderPalette({
  value,
  isSelectable,
  title,
  page,
  onPageChange,
  isUploading,
  onUploadingChange,
  onCommit,
  inputRef,
}: PaletteProps) {
  const { user } = useAuth();
  const username = workspaceUsername(user);
  const repository = useWorkspaceRepository("authenticated");
  const queryClient = useQueryClient();
  const listRef = useRef<HTMLDivElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const [modKey] = useState(() =>
    /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl",
  );

  const [initialState] = useState(() => initialPickerState(value, username));
  const [location, setLocation] = useState<PickerLocation>(
    initialState.location,
  );
  const [origin, setOrigin] = useState<PickerForeignOrigin>("shared");
  /**
   * A row from the workspace being browsed, kept when drilling in so an empty
   * folder in someone else's workspace still has a permission to check.
   */
  const [permissionEvidence, setPermissionEvidence] =
    useState<WorkspaceItem | null>(null);
  const [query, setQuery] = useState("");
  /** The keyboard cursor (cmdk value); falls back to the first row. */
  const [highlighted, setHighlighted] = useState(
    initialState.selectedPath ? `folder:${initialState.selectedPath}` : "",
  );
  /** A row the user tried to choose but can't; its reason turns red. */
  const [rejected, setRejected] = useState<string | null>(null);
  /**
   * Set when a move picks its own cursor row (the initial value, or the
   * folder just left when going up). cmdk re-selects its first row when the
   * highlighted row unmounts; that must not win. The next key or pointer move
   * hands the cursor back to cmdk.
   */
  const pinnedHighlightRef = useRef(initialState.selectedPath !== null);
  /**
   * cmdk moves its internal cursor before it reports the change, and only
   * re-reads `value` when the prop string changes. Flipping a trailing space
   * (cmdk trims it) makes it re-read the pinned row.
   */
  const [resyncCursor, setResyncCursor] = useState(false);

  const listing = useWorkspacePickerListing({ location, username });
  const recent = useWorkspacePickerListing({
    location: recentLocation,
    username,
  });
  const favorites = useWorkspacePickerListing({
    location: favoritesLocation,
    username,
  });

  const currentPath = location.kind === "path" ? location.path : null;
  const listView = location.kind === "list" ? location.view : null;
  const siblings = currentPath ? listing.items : [];
  const currentValue = value ? normalizePath(value) : null;
  const currentName = currentPath ? folderLabel(currentPath, username) : "";
  const canChangeFolder =
    currentPath !== null &&
    canWriteTo({
      path: currentPath,
      username,
      item: permissionEvidence,
      siblings,
    });
  const currentCommit = pickerCommitState({
    target: folderTarget,
    path: currentPath,
    isSelectable,
    writable: canChangeFolder,
  });
  const parent = currentPath
    ? parentLocation(currentPath, username, origin)
    : null;

  const goTo = (
    next: PickerLocation,
    evidence: WorkspaceItem | null,
    highlight = "",
  ) => {
    setLocation(next);
    setPermissionEvidence(evidence);
    setQuery("");
    setHighlighted(highlight);
    setRejected(null);
    pinnedHighlightRef.current = highlight !== "";
  };

  const goUp = () => {
    if (!parent || !currentPath) return;
    goTo(
      parent,
      parent.kind === "path" ? permissionEvidence : null,
      `folder:${currentPath}`,
    );
  };

  const changeScope = (view: PickerView) => {
    if (view === "shared" || view === "public") setOrigin(view);
    goTo(locationForView(view, username), null);
  };

  const invalidateListings = () => {
    void queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.all });
  };

  const createFolder = useMutation({
    mutationFn: async ({ parentPath, name }: { parentPath: string; name: string }) => {
      const path = `${normalizePath(parentPath)}/${sanitizePathSegment(name)}`;
      await repository.createFolder(path);
      return path;
    },
    onSuccess: (path) => {
      invalidateListings();
      goTo({ kind: "path", path }, permissionEvidence);
    },
  });

  const rowFor = (
    group: RowGroup,
    item: WorkspaceItem,
    rowSiblings: WorkspaceItem[],
  ): FolderRow => {
    const path = normalizePath(item.path);
    const writable = canWriteTo({
      path,
      username,
      item,
      siblings: rowSiblings,
    });
    const commit = pickerCommitState({
      target: folderTarget,
      path,
      isSelectable,
      writable,
    });
    const isElsewhere =
      group !== "folder" || listView === "favorites" || listView === "recent";
    const context = isElsewhere
      ? `in ${displayPath(parentPathOf(path), username)}`
      : listView === "shared" || listView === "public"
        ? item.ownerId || (segmentsOf(path).at(0) ?? null)
        : null;
    return {
      value: `${group}:${path}`,
      item,
      path,
      name: item.name,
      writable,
      canCommit: commit.canCommit,
      reason: commit.reason,
      context,
    };
  };

  const trimmedQuery = query.trim();
  const needle = trimmedQuery.toLowerCase();

  const folderItems = buildPickerItems({
    items: filterListing({
      location,
      items: listing.items,
      target: folderTarget,
    }),
    target: folderTarget,
    showAll: false,
    keepOrder: listView === "recent",
  });
  const folderRows = (
    needle ? rankMatches(folderItems, needle) : folderItems
  ).map((item) => rowFor("folder", item, siblings));

  const showQuickJumps =
    currentPath === pickerHomePath(username) && needle === "";
  const recentItems = showQuickJumps
    ? buildPickerItems({
        items: recent.items,
        target: folderTarget,
        showAll: false,
        keepOrder: true,
      })
    : [];
  const favoriteItems = showQuickJumps
    ? buildPickerItems({
        items: favorites.items,
        target: folderTarget,
        showAll: false,
        keepOrder: true,
      })
    : [];
  const recentRows = recentItems
    .slice(0, quickJumpLimit)
    .map((item) => rowFor("recent", item, []));
  const favoriteRows = favoriteItems
    .slice(0, quickJumpLimit)
    .map((item) => rowFor("favorite", item, []));
  const hasMoreRecent = recentItems.length > quickJumpLimit;
  const hasMoreFavorites = favoriteItems.length > quickJumpLimit;

  // "Create" is offered for any name no row already has.
  const sanitizedName = sanitizePathSegment(trimmedQuery);
  const nameTaken = listing.items.some((item) => item.name === sanitizedName);
  const offerCreate =
    currentPath !== null &&
    trimmedQuery !== "" &&
    !listing.isLoading &&
    !listing.error &&
    !nameTaken;
  const createBlocker = offerCreate
    ? canChangeFolder
      ? folderNameError(trimmedQuery)
      : "You don't have write access to this folder."
    : null;
  const canCreate = offerCreate && createBlocker === null;
  const createError =
    createFolder.error &&
    createFolder.variables.parentPath === currentPath &&
    createFolder.variables.name === trimmedQuery
      ? createFolder.error.message
      : null;

  const rows = [...recentRows, ...favoriteRows, ...folderRows];
  const rowsByValue = new Map(rows.map((row) => [row.value, row]));
  const rowValues = [
    ...recentRows.map((row) => row.value),
    ...(hasMoreRecent ? [allRecentValue] : []),
    ...favoriteRows.map((row) => row.value),
    ...(hasMoreFavorites ? [allFavoritesValue] : []),
    ...folderRows.map((row) => row.value),
    ...(canCreate && !createFolder.isPending ? [createValue] : []),
  ];
  const activeValue = rowValues.includes(highlighted)
    ? highlighted
    : (rowValues.at(0) ?? "");
  const rejectedRow = rejected ? rowsByValue.get(rejected) : undefined;

  const choose = (row: FolderRow) => {
    if (row.canCommit) {
      onCommit(row.path);
      return;
    }
    setHighlighted(row.value);
    setRejected(row.value);
  };

  const drill = (row: FolderRow) => {
    if (!isPickerItemNavigable(row.item)) return;
    goTo({ kind: "path", path: row.path }, row.item);
  };

  const commitCurrent = () => {
    if (currentPath && currentCommit.canCommit) onCommit(currentPath);
  };

  const create = () => {
    if (!currentPath || !canCreate || createFolder.isPending) return;
    createFolder.mutate({ parentPath: currentPath, name: trimmedQuery });
  };

  // Path-like keys on top of cmdk's ↑ ↓ ↵. Runs before cmdk's own handler,
  // which skips anything this prevents.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    pinnedHighlightRef.current = false;
    const input = inputRef.current;
    if (!input || event.target !== input || event.nativeEvent.isComposing) {
      return;
    }
    const activeRow = rowsByValue.get(activeValue);
    const caretAtEnd =
      input.selectionStart === input.value.length &&
      input.selectionEnd === input.value.length;
    if (event.key === "Enter") {
      if (event.metaKey || event.ctrlKey || (!activeValue && query === "")) {
        event.preventDefault();
        commitCurrent();
      }
    } else if (event.key === "ArrowRight" || event.key === "/") {
      // A slash can't be in a folder name, so it reads as "go into".
      if (event.key === "/") event.preventDefault();
      if (
        activeRow &&
        isPickerItemNavigable(activeRow.item) &&
        (event.key === "/" || caretAtEnd)
      ) {
        event.preventDefault();
        drill(activeRow);
      }
    } else if (event.key === "ArrowLeft" || event.key === "Backspace") {
      if (query === "" && parent) {
        event.preventDefault();
        goUp();
      }
    }
  };

  // Keep the cursor row in view after moving to another folder (the initial
  // value, or the folder just left when going up).
  const locationKey = currentPath ?? listView ?? "";
  useEffect(() => {
    if (page !== "browse") return;
    const frame = requestAnimationFrame(() => {
      listRef.current
        ?.querySelector('[cmdk-item][data-selected="true"]')
        ?.scrollIntoView({ block: "nearest" });
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [locationKey, listing.isLoading, page]);

  // Pages replace each other, so move focus with them.
  useEffect(() => {
    if (page === "browse") inputRef.current?.focus();
    else backButtonRef.current?.focus();
  }, [page, inputRef]);

  if (page === "upload" && currentPath) {
    return (
      <>
        <div className="flex items-center gap-2 border-b p-2">
          <Button
            ref={backButtonRef}
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Back to folders"
            title="Back to folders"
            disabled={isUploading}
            onClick={() => {
              onPageChange("browse");
            }}
          >
            <ArrowLeft />
          </Button>
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">
              Upload to {currentName}
            </span>
            <span
              className="truncate text-xs text-muted-foreground"
              title={currentPath}
            >
              {displayPath(currentPath, username)}
            </span>
          </div>
        </div>
        {/* The panel's footer bleeds into a p-4 dialog; give it one. */}
        <div className="flex min-h-0 flex-1 flex-col p-4">
          <WorkspaceUploadPanel
            targetPath={currentPath}
            cancelLabel="Back"
            onCancel={() => {
              onPageChange("browse");
            }}
            onUploadComplete={() => {
              invalidateListings();
              onPageChange("browse");
            }}
            onUploadingChange={onUploadingChange}
          />
        </div>
      </>
    );
  }

  const crumbs = crumbsFor(location, username, origin);

  const renderRow = (row: FolderRow) => {
    const navigable = isPickerItemNavigable(row.item);
    const isRejected = rejected === row.value;
    const RowIcon = row.canCommit ? Folder : row.writable ? FolderX : FolderLock;
    const secondary = isRejected
      ? `${row.reason ?? ""}${navigable ? " Press → to open it instead." : ""}`
      : [row.context, row.reason].filter(Boolean).join(" · ");
    return (
      <CommandItem
        key={row.value}
        value={row.value}
        title={row.reason ?? row.path}
        onSelect={() => {
          choose(row);
        }}
      >
        <span
          className={cn(
            "flex shrink-0 text-highlight",
            !row.canCommit && "opacity-50",
          )}
        >
          <RowIcon className="size-4" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className={cn("truncate", !row.canCommit && "text-muted-foreground")}
          >
            <MatchedName name={row.name} needle={needle} />
          </span>
          {secondary ? (
            <span
              className={cn(
                "truncate text-xs",
                isRejected ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {secondary}
            </span>
          ) : null}
        </span>
        <CommandShortcut>
          <span className="flex items-center gap-1 tracking-normal">
            {row.path === currentValue ? (
              <Badge variant="outline" size="xs">
                Current
              </Badge>
            ) : null}
            {navigable ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                tabIndex={-1}
                aria-label={`Open ${row.name}`}
                title="Open (→)"
                onClick={(event) => {
                  event.stopPropagation();
                  drill(row);
                }}
              >
                <ChevronRight />
              </Button>
            ) : null}
          </span>
        </CommandShortcut>
      </CommandItem>
    );
  };

  const emptyMessage =
    location.kind === "path"
      ? "No subfolders here."
      : emptyListingMessage(location);

  return (
    <>
      <CommandPrimitive
        label={title}
        shouldFilter={false}
        loop
        value={resyncCursor ? `${activeValue} ` : activeValue}
        onValueChange={(next) => {
          if (!pinnedHighlightRef.current) {
            setHighlighted(next);
          } else if (next !== activeValue) {
            setResyncCursor((flag) => !flag);
          }
        }}
        onKeyDown={handleKeyDown}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex flex-col gap-2 border-b p-2">
          {/* The switcher and crumbs take Enter and Space themselves; keep
              their keys from cmdk, whose root turns Enter into "choose the
              highlighted row". */}
          <div onKeyDown={stopKeys}>
            <Tabs value={viewForLocation(location, username, origin)}>
              <TabsList className="w-full" aria-label="Workspace scope">
                {scopes.map((scope) => (
                  <TabsTrigger
                    key={scope.value}
                    value={scope.value}
                    size="xs"
                    title={fullViewLabel(scope.value)}
                    onClick={() => {
                      changeScope(scope.value);
                      inputRef.current?.focus();
                    }}
                  >
                    {scope.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {/* Path bar: the breadcrumb is the prefix of the filter, so typing
              reads as "inside this folder" and ← / Backspace pops a segment. */}
          <div className="flex items-center gap-1 rounded-lg border border-input bg-input/30 px-1 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
            <div
              className="flex min-w-0 shrink items-center gap-0.5"
              onKeyDown={stopKeys}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Up one level"
                title="Up one level (←)"
                disabled={!parent}
                onClick={() => {
                  goUp();
                  inputRef.current?.focus();
                }}
              >
                <CornerLeftUp />
              </Button>
              <nav
                aria-label="Folder path"
                className="flex min-w-0 shrink items-center gap-0.5"
              >
                {crumbs.map((crumb, index) => {
                  const CrumbIcon = crumb.icon;
                  const isLast = index === crumbs.length - 1;
                  const content = (
                    <>
                      {CrumbIcon ? (
                        <CrumbIcon className="size-3.5 shrink-0" />
                      ) : null}
                      {crumb.iconOnly ? (
                        <span className="sr-only">{crumb.label}</span>
                      ) : (
                        <span className="truncate">{crumb.label}</span>
                      )}
                    </>
                  );
                  return (
                    <Fragment key={crumb.key}>
                      {index > 0 ? (
                        <ChevronRight
                          aria-hidden
                          className="size-3 shrink-0 text-muted-foreground"
                        />
                      ) : null}
                      {isLast ? (
                        <span
                          aria-current="location"
                          title={crumb.title}
                          className="flex min-w-0 shrink items-center gap-1 px-1 text-xs font-medium text-foreground"
                        >
                          {content}
                        </span>
                      ) : (
                        <button
                          type="button"
                          title={crumb.iconOnly ? crumb.label : crumb.title}
                          className="flex max-w-28 min-w-0 shrink items-center gap-1 rounded px-1 py-0.5 text-xs text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                          onClick={() => {
                            goTo(
                              crumb.target,
                              crumb.target.kind === "path"
                                ? permissionEvidence
                                : null,
                            );
                            inputRef.current?.focus();
                          }}
                        >
                          {content}
                        </button>
                      )}
                    </Fragment>
                  );
                })}
              </nav>
            </div>
            <ChevronRight
              aria-hidden
              className="size-3 shrink-0 text-muted-foreground"
            />
            <CommandPrimitive.Input
              ref={inputRef}
              value={query}
              onValueChange={(next) => {
                setQuery(next);
                setHighlighted("");
                setRejected(null);
              }}
              placeholder={canChangeFolder ? "Filter or new folder…" : "Filter…"}
              className="h-8 min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <CommandList
          ref={listRef}
          className="max-h-none min-h-0 flex-1"
          onPointerMoveCapture={() => {
            pinnedHighlightRef.current = false;
          }}
          onMouseDown={(event) => {
            // Rows aren't focusable; keep focus (and the keyboard) in the
            // filter when one is clicked.
            event.preventDefault();
          }}
        >
          {recentRows.length > 0 ? (
            <CommandGroup heading="Recent">
              {recentRows.map(renderRow)}
              {hasMoreRecent ? (
                <ShowAllRow
                  value={allRecentValue}
                  view="recent"
                  count={recentItems.length}
                  onSelect={() => {
                    changeScope("recent");
                  }}
                />
              ) : null}
            </CommandGroup>
          ) : null}
          {favoriteRows.length > 0 ? (
            <CommandGroup heading="Favorites">
              {favoriteRows.map(renderRow)}
              {hasMoreFavorites ? (
                <ShowAllRow
                  value={allFavoritesValue}
                  view="favorites"
                  count={favoriteItems.length}
                  onSelect={() => {
                    changeScope("favorites");
                  }}
                />
              ) : null}
            </CommandGroup>
          ) : null}

          {listing.error ? (
            <p
              role="alert"
              className="px-4 py-6 text-center text-sm text-destructive"
            >
              {listing.error.message}
            </p>
          ) : listing.isLoading ? (
            <div className="flex flex-col gap-1.5 p-2" aria-busy="true">
              <Skeleton className="h-7 w-full" />
              <Skeleton className="h-7 w-5/6" />
              <Skeleton className="h-7 w-2/3" />
              <Skeleton className="h-7 w-3/4" />
            </div>
          ) : folderRows.length > 0 ? (
            <CommandGroup
              heading={
                location.kind === "path"
                  ? needle
                    ? `Matching in ${currentName}`
                    : `Folders in ${currentName}`
                  : fullViewLabel(location.view)
              }
            >
              {folderRows.map(renderRow)}
            </CommandGroup>
          ) : !offerCreate ? (
            <div className="flex flex-col items-center gap-1 px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">
                {needle ? `No folders match “${trimmedQuery}”.` : emptyMessage}
              </p>
              {!needle && currentCommit.canCommit ? (
                <p className="text-xs text-muted-foreground">
                  Press ↵ to use {currentName}
                  {canChangeFolder ? ", or type a name to create a folder." : "."}
                </p>
              ) : null}
            </div>
          ) : null}

          {offerCreate ? (
            <CommandGroup heading={folderRows.length > 0 ? "New" : undefined}>
              {createBlocker ? (
                <div className="flex items-start gap-2 px-2 py-1.5">
                  <FolderX className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-muted-foreground">
                      Can&apos;t create “{trimmedQuery}”
                    </span>
                    <span className="text-xs text-destructive">
                      {createBlocker}
                    </span>
                  </span>
                </div>
              ) : (
                <CommandItem
                  value={createValue}
                  disabled={createFolder.isPending}
                  onSelect={create}
                >
                  <span className="flex shrink-0 text-highlight">
                    {createFolder.isPending ? (
                      <Spinner className="size-4" />
                    ) : (
                      <FolderPlus className="size-4" />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">
                      Create folder{" "}
                      <span className="font-semibold">“{trimmedQuery}”</span>{" "}
                      in {currentName}
                    </span>
                    {createError ? (
                      <span className="text-xs text-destructive">
                        {createError}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {createFolder.isPending
                          ? "Creating…"
                          : "Creates it and opens it"}
                      </span>
                    )}
                  </span>
                </CommandItem>
              )}
            </CommandGroup>
          ) : null}
        </CommandList>
      </CommandPrimitive>

      <p aria-live="polite" className="sr-only">
        {rejectedRow?.reason ?? ""}
      </p>

      <div className="flex flex-col gap-1.5 border-t p-2">
        {currentCommit.reason ? (
          <p className="px-1 text-xs text-destructive">
            {currentCommit.reason}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!canChangeFolder}
            title={
              canChangeFolder
                ? `Upload files to ${currentName}`
                : "Open a folder you can write to"
            }
            onClick={() => {
              onPageChange("upload");
            }}
          >
            <Upload />
            Upload here
          </Button>
          <Button
            type="button"
            size="sm"
            className="max-w-60 min-w-0"
            disabled={!currentCommit.canCommit}
            title={currentPath ?? "Open a workspace first"}
            onClick={commitCurrent}
          >
            <span className="min-w-0 truncate">
              {currentPath ? `Use “${currentName}”` : "Use this folder"}
            </span>
          </Button>
        </div>
      </div>
      <CommandFooter>
        <CommandFooterHint keys={["↑", "↓"]}>move</CommandFooterHint>
        <CommandFooterHint keys={["→"]}>open</CommandFooterHint>
        <CommandFooterHint keys={["←"]}>up</CommandFooterHint>
        <CommandFooterHint keys={["↵"]}>choose</CommandFooterHint>
        <CommandFooterHint keys={[modKey, "↵"]}>use current</CommandFooterHint>
      </CommandFooter>
    </>
  );
}

export function VariantC({
  value,
  onChange,
  disabled,
  isSelectable,
  title,
}: FolderPickerVariantProps) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<PalettePage>("browse");
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Popover
      open={open}
      onOpenChange={(next, details) => {
        if (!next && isUploading) return;
        // Escape on the upload page steps back instead of closing.
        if (!next && page === "upload" && details.reason === "escape-key") {
          setPage("browse");
          return;
        }
        if (next) setPage("browse");
        setOpen(next);
      }}
    >
      <PopoverTrigger
        disabled={disabled}
        render={
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Browse workspace folders"
            title="Browse workspace folders"
          >
            <FolderOpen />
          </Button>
        }
      />
      {/* The palette unmounts with the popup, so every open starts fresh. */}
      <PopoverContent
        size="flush"
        variant="raised"
        align="end"
        sideOffset={6}
        initialFocus={inputRef}
        // One fixed height, so filtering or drilling never changes the size and
        // makes the popover flip to another side of the field mid-use.
        className="h-104 max-h-(--available-height) w-md max-w-(--available-width) overflow-hidden"
      >
        <PopoverTitle className="sr-only">{title}</PopoverTitle>
        <FolderPalette
          value={value}
          isSelectable={isSelectable}
          title={title}
          page={page}
          onPageChange={setPage}
          isUploading={isUploading}
          onUploadingChange={setIsUploading}
          onCommit={(path) => {
            onChange(path);
            setOpen(false);
          }}
          inputRef={inputRef}
        />
      </PopoverContent>
    </Popover>
  );
}
