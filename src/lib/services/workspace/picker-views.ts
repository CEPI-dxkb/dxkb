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
import { getJobResultDotPath, hasWriteAccess } from "./helpers";
import { normalizePath } from "./mini-browser-items";
import { sanitizePathSegment } from "./path-utils";
import { knownUploadTypes } from "./types";
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
  /** The row's type, when known (always for files). */
  type?: string;
}) => boolean;

const folderTarget: PickerTarget = { kind: "folder" };

/**
 * Picking files, a job result is opened (through its hidden folder, where its
 * outputs live) unless it is itself a requested type, when it is a file to
 * choose like any other.
 */
function opensJobResult(item: WorkspaceItem, target: PickerTarget): boolean {
  return (
    target.kind === "object" &&
    normalizeWorkspaceObjectType(item.type) === "job_result" &&
    !matchesTargetType(item, target)
  );
}

/**
 * Rows the picker opens as a column: folders, and, picking files, job
 * results that are not themselves a requested type.
 */
export function isPickerItemNavigable(
  item: WorkspaceItem,
  target: PickerTarget = folderTarget,
): boolean {
  return isFolder(item.type) || opensJobResult(item, target);
}

/** A file the picker can choose: picking files, one of the requested types. */
export function isPickerItemChoosable(
  item: WorkspaceItem,
  target: PickerTarget,
): boolean {
  return (
    target.kind === "object" &&
    !isPickerItemNavigable(item, target) &&
    matchesTargetType(item, target)
  );
}

export function isPickerItemInteractive(
  item: WorkspaceItem,
  target: PickerTarget,
): boolean {
  return (
    isPickerItemNavigable(item, target) || isPickerItemChoosable(item, target)
  );
}

/**
 * The path a row stands for in the selection: its own, except a job result
 * the picker opens, which stands for its hidden folder (`/a/J` -> `/a/.J`).
 */
export function pickerRowKey(
  item: WorkspaceItem,
  target: PickerTarget = folderTarget,
): string {
  const path = normalizePath(item.path);
  return opensJobResult(item, target)
    ? getJobResultDotPath({ path, name: item.name })
    : path;
}

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
 * Rows to show of the items given. By default: folders, plus files of the
 * requested types. "Show all" lifts that filter. Folder-like items sort first.
 * Hidden items are `visiblePickerRows`'s call.
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
          isPickerItemNavigable(item, target) ||
          matchesTargetType(item, target),
      );
  if (keepOrder) return visible;
  return [...visible].sort((a, b) => {
    const aFolder = isFolderType(a.type);
    const bFolder = isFolderType(b.type);
    if (aFolder !== bFolder) return aFolder ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

/**
 * Whether the picker leaves a row out for being hidden (a dot name). Hidden
 * items stay out, with one exception: picking files inside a job's hidden
 * folder, a hidden folder holds outputs too (a Comprehensive Genome Analysis
 * keeps its annotation in `.annotation`), so it shows, unless a job result
 * listed beside it already opens it, which would list the folder twice.
 */
export function isHiddenPickerItem({
  item,
  location,
  items,
  target,
}: {
  item: WorkspaceItem;
  location: PickerLocation;
  /** The listing `item` is in. */
  items: readonly WorkspaceItem[];
  target: PickerTarget;
}): boolean {
  if (!item.name.startsWith(".")) return false;
  const insideJobFolder =
    target.kind === "object" &&
    location.kind === "path" &&
    pathSegments(location.path).some((segment) => segment.startsWith("."));
  if (!insideJobFolder || !isFolder(item.type)) return true;
  const path = normalizePath(item.path);
  return items.some(
    (other) =>
      opensJobResult(other, target) && pickerRowKey(other, target) === path,
  );
}

/**
 * Rows a picker column shows: folders (and, picking files, job results and
 * files of the requested types), plus every other file with `showAll`.
 * Hidden (dot) items show only as `isHiddenPickerItem` allows.
 */
export function visiblePickerRows({
  location,
  items,
  target,
  showAll,
}: {
  location: PickerLocation;
  items: WorkspaceItem[];
  target: PickerTarget;
  showAll: boolean;
}): WorkspaceItem[] {
  const listed = filterListing({ location, items, target });
  return buildPickerItems({
    items: listed.filter(
      (item) => !isHiddenPickerItem({ item, location, items: listed, target }),
    ),
    target,
    showAll,
    keepOrder: location.kind === "list" && location.view === "recent",
  });
}

/**
 * Where the picker opens. Picking files, the value is a file: open its folder
 * (a job result's hidden folder included) with the file selected.
 */
export function initialPickerSelection(
  initialPath: string | undefined,
  username: string,
  target: PickerTarget,
): { view: PickerView; chain: string[]; file: string | null } {
  if (target.kind === "folder") {
    return { ...initialColumnChain(initialPath, username), file: null };
  }
  const segments = pathSegments(initialPath ?? "");
  // A file sits at least one level below a workspace: /owner/workspace/file.
  if (segments.length < 3) return { view: "home", chain: [], file: null };
  const { view, chain } = initialColumnChain(
    `/${segments.slice(0, -1).join("/")}`,
    username,
  );
  return { view, chain, file: `/${segments.join("/")}` };
}

/** A folder's name in columns and crumbs; a job folder drops its dot. */
export function pickerPathLabel(
  path: string,
  homePath: string,
  target: PickerTarget,
): string {
  if (path === homePath) return "Home";
  const name = lastSegment(path);
  return target.kind === "object" && name.startsWith(".")
    ? name.slice(1)
    : name;
}

const uploadTypeLabels: Record<string, { label: string } | undefined> =
  knownUploadTypes;
const typeListFormat = new Intl.ListFormat("en", { type: "disjunction" });

/** "contigs" -> "Contigs"; types with no upload label read from their name. */
export function pickerTypeLabel(type: string): string {
  const known = uploadTypeLabels[type]?.label;
  if (known) return known;
  const words = type.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "Contigs or Reads". */
export function pickerTypeList(types: readonly string[]): string {
  return typeListFormat.format([...new Set(types.map(pickerTypeLabel))]);
}

const groupKindByType: Record<string, string | undefined> = {
  genome_group: "genome",
  feature_group: "feature",
};

/**
 * The kinds of group ("genome", "feature") when every type is a group type,
 * otherwise null. A group is picked as a unit, so it reads as a group, not as
 * a file of some type.
 */
function groupKinds(types: readonly string[]): string[] | null {
  const kinds = new Set<string>();
  for (const type of types) {
    const kind = groupKindByType[type];
    if (!kind) return null;
    kinds.add(kind);
  }
  return kinds.size > 0 ? [...kinds] : null;
}

/** What a picker of this target is titled: "Select a File", "Select a Genome Group". */
export function pickerTitleFor(target: PickerTarget): string {
  if (target.kind === "folder") return "Select a Folder";
  const kinds = groupKinds(target.types);
  if (!kinds) return "Select a File";
  const names = kinds.map((kind) => kind.charAt(0).toUpperCase() + kind.slice(1));
  return `Select a ${typeListFormat.format(names)} Group`;
}

/** What a picker of these types accepts: "Contigs or Reads files", "genome groups". */
export function pickerTypePhrase(types: readonly string[]): string {
  const kinds = groupKinds(types);
  return kinds
    ? `${typeListFormat.format(kinds)} groups`
    : `${pickerTypeList(types)} files`;
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
  item = null,
  writable,
  isSelectable,
}: {
  target: PickerTarget;
  path: string | null;
  /** The selected row; object targets need it to judge the file. */
  item?: WorkspaceItem | null;
  writable: boolean;
  isSelectable?: PickerSelectablePredicate;
}): { canCommit: boolean; reason: string | null } {
  if (!path) return { canCommit: false, reason: null };
  if (target.kind === "object") {
    if (!item || isPickerItemNavigable(item, target)) {
      const kinds = groupKinds(target.types);
      return {
        canCommit: false,
        reason: kinds
          ? `Pick a ${typeListFormat.format(kinds)} group.`
          : `Pick a file: ${pickerTypeList(target.types)}.`,
      };
    }
    if (!matchesTargetType(item, target)) {
      return {
        canCommit: false,
        reason: `Only ${pickerTypePhrase(target.types)} can be used here.`,
      };
    }
    if (
      isSelectable &&
      !isSelectable({ name: item.name, path, type: item.type })
    ) {
      return { canCommit: false, reason: "This file can't be used here." };
    }
    return { canCommit: true, reason: null };
  }
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
 * What a selector of these types picks: a folder when every type is a folder
 * type, otherwise objects of those types. A job result is an object here.
 */
export function pickerTargetFor(types: readonly string[]): PickerTarget {
  return types.length > 0 && types.every((type) => isFolder(type))
    ? { kind: "folder" }
    : { kind: "object", types };
}

/** Output folders can't be, or sit inside, a hidden (dot) folder. */
export function isSelectableOutputFolder(object: {
  name: string;
  path: string;
}): boolean {
  return (
    !object.name.startsWith(".") &&
    !pathSegments(object.path).some((segment) => segment.startsWith("."))
  );
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
