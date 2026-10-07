/**
 * Pure rules for the workspace folder picker
 * (`src/components/workspace/folder-picker/`).
 *
 * Each column of the picker shows one location: either a real directory, or
 * one of the top-level listings the sidebar offers (My Workspaces, Shared,
 * Public, Favorites, Recently Used). This module owns where each view points,
 * which view a path belongs to, where the picker opens, which rows show, and
 * whether the current choice can be committed. The component keeps state and
 * queries; everything decidable from data lives here.
 */

import type { WorkspaceItem } from "./domain";
import { hasWriteAccess } from "./helpers";
import { normalizePath } from "./mini-browser-items";
import { sanitizePathSegment } from "./path-utils";
import { isFolder, isFolderType, normalizeWorkspaceObjectType } from "./utils";

export type PickerView =
  "home" | "myWorkspaces" | "shared" | "public" | "favorites" | "recent";

/** Views that are a listing rather than a directory. */
export type PickerListView = Exclude<PickerView, "home">;

/** The listing another user's workspace was reached from. */
export type PickerForeignOrigin = "shared" | "public";

export type PickerLocation =
  { kind: "path"; path: string } | { kind: "list"; view: PickerListView };

/** What the picker is choosing: a destination folder, or a file of some types. */
export type PickerTarget =
  { kind: "folder" } | { kind: "object"; types: readonly string[] };

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

export const pickerViewOptions: readonly {
  value: PickerView;
  label: string;
}[] = [
  { value: "home", label: "Home" },
  { value: "myWorkspaces", label: "My Workspaces" },
  { value: "shared", label: "Shared Workspaces" },
  { value: "public", label: "Public Workspaces" },
  { value: "favorites", label: "Favorites" },
  { value: "recent", label: "Recently Used" },
];

/** The sidebar label of a view, e.g. "Shared Workspaces". */
export function viewLabel(view: PickerView): string {
  return pickerViewOptions.find((option) => option.value === view)?.label ?? "";
}

export function pathSegments(path: string): string[] {
  return normalizePath(path).split("/").filter(Boolean);
}

export function lastSegment(path: string): string {
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

/** The view (sidebar place) a location belongs to. */
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

/**
 * Where the picker opens: the view the current value lives in, and the chain
 * of folders selected from that view's first column down to the value. Home's
 * first column is a directory (`/owner/home`); every other view starts with a
 * listing of workspaces, so its first column already holds
 * `/owner/workspace`. With no usable value it opens on Home with nothing
 * selected, which makes Home itself the destination.
 */
export function initialColumnChain(
  initialPath: string | undefined,
  username: string,
): { view: PickerView; chain: string[] } {
  const segments = pathSegments(initialPath ?? "");
  if (segments.length < 2) return { view: "home", chain: [] };
  const view = viewForLocation(
    { kind: "path", path: `/${segments.join("/")}` },
    username,
    "shared",
  );
  const rootDepth = view === "home" ? 2 : 1;
  const chain: string[] = [];
  for (let depth = rootDepth + 1; depth <= segments.length; depth += 1) {
    chain.push(`/${segments.slice(0, depth).join("/")}`);
  }
  return { view, chain };
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

const folderTarget: PickerTarget = { kind: "folder" };

/**
 * Rows a folder-picker column shows: folders, plus the folder's files with
 * "Show files". Hidden (dot) items never show.
 */
export function visibleFolderRows(
  location: PickerLocation,
  items: WorkspaceItem[],
  showFiles: boolean,
): WorkspaceItem[] {
  const rows = buildPickerItems({
    items: filterListing({ location, items, target: folderTarget }),
    target: folderTarget,
    showAll: showFiles,
    keepOrder: location.kind === "list" && location.view === "recent",
  });
  return showFiles ? rows.filter((item) => !item.name.startsWith(".")) : rows;
}

/** `/owner/workspace` for a path inside a workspace; null above that. */
function workspaceRootOf(path: string): string | null {
  const [owner, workspace] = pathSegments(path);
  return owner && workspace ? `/${owner}/${workspace}` : null;
}

/** Whether rows for these paths need the `/` listing for their permissions. */
export function stubsNeedWorkspaces(
  paths: readonly string[],
  username: string,
): boolean {
  return paths.some((path) => !isOwnPath(path, username));
}

/**
 * Rows for path-only listings (favorites, recent folders). A bare path carries
 * no permission, so each row takes its workspace's row from `workspaces` (the
 * `/` listing), because permissions are per workspace. A row with no match
 * stays unknown, which `canWriteTo` reads as no.
 */
export function folderStubItems(
  paths: readonly string[],
  workspaces: readonly WorkspaceItem[] = [],
): WorkspaceItem[] {
  const permissionsByRoot = new Map(
    workspaces.map((workspace) => [
      normalizePath(workspace.path),
      workspace.permissions,
    ]),
  );
  return paths.map((rawPath) => {
    const path = normalizePath(rawPath);
    const root = workspaceRootOf(path);
    return {
      id: path,
      name: lastSegment(path),
      path,
      type: "folder",
      size: 0,
      ownerId: pathSegments(path)[0] ?? "",
      permissions: root ? permissionsByRoot.get(root) : undefined,
    };
  });
}

export function isPickerItemNavigable(item: WorkspaceItem): boolean {
  return isFolder(item.type);
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

/**
 * Why a new folder's name won't do, or null. The picker never lists hidden
 * (dot) folders, so one created here could not be seen or chosen; that rule
 * also covers "." and "..".
 */
export function folderNameError(name: string): string | null {
  const sanitizedName = sanitizePathSegment(name);
  if (!sanitizedName) return "Enter a folder name.";
  if (sanitizedName.startsWith(".")) {
    return 'Folder name cannot start with ".": hidden folders are not shown here.';
  }
  if (sanitizedName.includes("/")) return "Folder name cannot contain a slash.";
  return null;
}
