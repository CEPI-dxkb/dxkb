/**
 * Pure rules for the workspace picker dialog
 * (`src/components/workspace/workspace-picker-dialog.tsx`).
 *
 * The picker shows one location at a time: either a real directory, or one of
 * the top-level listings the switcher offers (My Workspaces, Shared, Public,
 * Favorites, Recently Used). This module owns where each view points, which
 * view a path belongs to, how "parent" works across that boundary, which rows
 * show and can be picked, and whether the current choice can be committed. The
 * component keeps state and queries; everything decidable from data lives here.
 */

import type { WorkspaceItem } from "./domain";
import { hasWriteAccess } from "./helpers";
import { normalizePath } from "./mini-browser-items";
import { sanitizePathSegment } from "./path-utils";
import { isFolder, isFolderType, normalizeWorkspaceObjectType } from "./utils";

export type PickerView =
  | "home"
  | "myWorkspaces"
  | "shared"
  | "public"
  | "favorites"
  | "recent";

/** Views that are a listing rather than a directory. */
export type PickerListView = Exclude<PickerView, "home">;

/** The listing another user's workspace was reached from. */
export type PickerForeignOrigin = "shared" | "public";

export type PickerLocation =
  | { kind: "path"; path: string }
  | { kind: "list"; view: PickerListView };

/** What the picker is choosing: a destination folder, or a file of some types. */
export type PickerTarget =
  | { kind: "folder" }
  | { kind: "object"; types: readonly string[] };

/** Extra caller rule on top of the target, e.g. "no hidden folders". */
export type PickerSelectablePredicate = (object: {
  name: string;
  path: string;
}) => boolean;

export type PickerListingSource =
  | { kind: "directory"; path: string }
  | { kind: "root" }
  | { kind: "favorites" }
  | { kind: "recent" };

export const pickerViewOptions: readonly { value: PickerView; label: string }[] =
  [
    { value: "home", label: "Home" },
    { value: "myWorkspaces", label: "My Workspaces" },
    { value: "shared", label: "Shared Workspaces" },
    { value: "public", label: "Public Workspaces" },
    { value: "favorites", label: "Favorites" },
    { value: "recent", label: "Recently Used" },
  ];

function viewLabel(view: PickerView): string {
  return pickerViewOptions.find((option) => option.value === view)?.label ?? "";
}

function pathSegments(path: string): string[] {
  return normalizePath(path).split("/").filter(Boolean);
}

function lastSegment(path: string): string {
  return pathSegments(path).pop() ?? "";
}

export function pickerHomePath(username: string): string {
  return `/${username}/home`;
}

function isWithin(path: string, root: string): boolean {
  const normalized = normalizePath(path);
  return normalized === root || normalized.startsWith(`${root}/`);
}

/** True for the user's own workspaces and everything inside them. */
export function isOwnPath(path: string, username: string): boolean {
  return !!username && isWithin(path, `/${username}`);
}

export function locationForView(
  view: PickerView,
  username: string,
): PickerLocation {
  if (view === "home") return { kind: "path", path: pickerHomePath(username) };
  return { kind: "list", view };
}

/**
 * Parent of a directory. Above a workspace root (`/owner/workspace`) there is
 * no directory to show, so it goes back to the listing that holds it.
 */
export function parentLocation(
  path: string,
  username: string,
  origin: PickerForeignOrigin,
): PickerLocation {
  const segments = pathSegments(path);
  if (segments.length <= 2) {
    return {
      kind: "list",
      view: segments[0] === username ? "myWorkspaces" : origin,
    };
  }
  return { kind: "path", path: `/${segments.slice(0, -1).join("/")}` };
}

/**
 * Opens on the folder that holds the current value, with the value selected,
 * so its siblings are visible. With no value it opens on Home.
 */
export function initialPickerState(
  initialPath: string | undefined,
  username: string,
): { location: PickerLocation; selectedPath: string | null } {
  const normalized = normalizePath(initialPath);
  if (pathSegments(normalized).length < 2) {
    return { location: locationForView("home", username), selectedPath: null };
  }
  return {
    location: parentLocation(normalized, username, "shared"),
    selectedPath: normalized,
  };
}

/** The switcher entry that describes the current location. */
export function viewForLocation(
  location: PickerLocation,
  username: string,
  origin: PickerForeignOrigin,
): PickerView {
  if (location.kind === "list") return location.view;
  if (isWithin(location.path, pickerHomePath(username))) return "home";
  if (isOwnPath(location.path, username)) return "myWorkspaces";
  return origin;
}

export function parentRowLabel(parent: PickerLocation): string {
  return parent.kind === "path"
    ? "Parent folder"
    : `Back to ${viewLabel(parent.view)}`;
}

const emptyListMessages: Record<PickerListView, string> = {
  myWorkspaces: "No workspaces yet.",
  shared: "No workspaces are shared with you.",
  public: "No public workspaces.",
  favorites: "No favorite folders yet.",
  recent: "No recently used folders.",
};

export function emptyListingMessage(location: PickerLocation): string {
  return location.kind === "path"
    ? "This folder is empty."
    : emptyListMessages[location.view];
}

export function listingSourceFor(
  location: PickerLocation,
  username: string,
): PickerListingSource {
  if (location.kind === "path") {
    return { kind: "directory", path: location.path };
  }
  switch (location.view) {
    case "myWorkspaces":
      return { kind: "directory", path: `/${username}` };
    case "shared":
    case "public":
      return { kind: "root" };
    case "favorites":
      return { kind: "favorites" };
    case "recent":
      return { kind: "recent" };
  }
}

function isSharedWorkspace(item: WorkspaceItem): boolean {
  const globalPermission = item.permissions?.global ?? "";
  const userPermission = item.permissions?.user ?? "";
  return globalPermission === "n" && userPermission !== "o";
}

function isPublicWorkspace(item: WorkspaceItem): boolean {
  return (item.permissions?.global ?? "") !== "n";
}

/**
 * Shared and Public both come from the `/` listing. A folder destination has to
 * be writable, so Shared drops read-only workspaces when picking a folder.
 */
export function filterListing({
  location,
  items,
  target,
}: {
  location: PickerLocation;
  items: WorkspaceItem[];
  target: PickerTarget;
}): WorkspaceItem[] {
  if (location.kind !== "list") return items;
  if (location.view === "shared") {
    const shared = items.filter(isSharedWorkspace);
    return target.kind === "folder" ? shared.filter(hasWriteAccess) : shared;
  }
  if (location.view === "public") return items.filter(isPublicWorkspace);
  return items;
}

function matchesTargetType(item: WorkspaceItem, target: PickerTarget): boolean {
  if (target.kind === "folder") return isFolder(item.type);
  return target.types.includes(normalizeWorkspaceObjectType(item.type));
}

/**
 * Rows to show. By default: folders, plus files of the requested types, minus
 * hidden items. "Show all" lifts both filters. Folder-like items sort first.
 */
export function buildPickerItems({
  items,
  target,
  showAll,
  keepOrder = false,
}: {
  items: WorkspaceItem[];
  target: PickerTarget;
  showAll: boolean;
  keepOrder?: boolean;
}): WorkspaceItem[] {
  const visible = showAll
    ? items
    : items.filter(
        (item) =>
          !item.name.startsWith(".") &&
          (isFolder(item.type) || matchesTargetType(item, target)),
      );
  if (keepOrder) return visible;
  return [...visible].sort((a, b) => {
    const aFolder = isFolderType(a.type);
    const bFolder = isFolderType(b.type);
    if (aFolder !== bFolder) return aFolder ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

/** Rows for path-only listings (favorites, recent folders). */
export function folderStubItems(paths: readonly string[]): WorkspaceItem[] {
  return paths.map((rawPath) => {
    const path = normalizePath(rawPath);
    return {
      id: path,
      name: lastSegment(path),
      path,
      type: "folder",
      size: 0,
      ownerId: pathSegments(path)[0] ?? "",
    };
  });
}

export function isPickerItemNavigable(item: WorkspaceItem): boolean {
  return isFolder(item.type);
}

export function isPickerItemSelectable(
  item: WorkspaceItem,
  target: PickerTarget,
  isSelectable?: PickerSelectablePredicate,
): boolean {
  if (!matchesTargetType(item, target)) return false;
  return isSelectable?.({ name: item.name, path: item.path }) ?? true;
}

/**
 * Whether the user can write into `path`. Own paths always can. Otherwise the
 * item's permission decides; failing that, a sibling's does, because listing
 * permissions are per workspace. With no evidence the answer is no.
 */
export function canWriteTo({
  path,
  username,
  item,
  siblings,
}: {
  path: string;
  username: string;
  item?: WorkspaceItem | null;
  siblings: WorkspaceItem[];
}): boolean {
  if (isOwnPath(path, username)) return true;
  const known = item?.permissions
    ? item
    : siblings.find((sibling) => sibling.permissions);
  return known ? hasWriteAccess(known) : false;
}

export function pickerCommitState({
  target,
  path,
  writable,
  isSelectable,
}: {
  target: PickerTarget;
  path: string | null;
  writable: boolean;
  isSelectable?: PickerSelectablePredicate;
}): { canCommit: boolean; reason: string | null } {
  if (!path) return { canCommit: false, reason: null };
  if (target.kind === "object") return { canCommit: true, reason: null };
  if (isSelectable && !isSelectable({ name: lastSegment(path), path })) {
    return { canCommit: false, reason: "This folder can't be used here." };
  }
  if (!writable) {
    return {
      canCommit: false,
      reason: "You don't have write access to this folder.",
    };
  }
  return { canCommit: true, reason: null };
}

export function folderNameError(name: string): string | null {
  const sanitizedName = sanitizePathSegment(name);
  if (!sanitizedName) return "Enter a folder name.";
  if (sanitizedName === "." || sanitizedName === "..") {
    return 'Folder name cannot be "." or "..".';
  }
  if (sanitizedName.includes("/")) return "Folder name cannot contain a slash.";
  return null;
}
