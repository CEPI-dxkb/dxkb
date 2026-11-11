/**
 * Pure rules for the workspace folder picker
 * (`src/components/workspace/folder-picker/`): where each view points, which
 * view a path belongs to, where the picker opens, which rows show, and whether
 * the choice can be committed.
 */

import type { WorkspaceItem } from "./domain";
import { getJobResultDotPath, hasWriteAccess } from "./helpers";
import { normalizePath } from "./mini-browser-items";
import { sanitizePathSegment } from "./path-utils";
import { knownUploadTypes } from "./types";
import { isFolder, isFolderType, normalizeWorkspaceObjectType } from "./utils";

export type PickerView =
  "home" | "myWorkspaces" | "shared" | "public" | "favorites" | "recent";

export type PickerListView = Exclude<PickerView, "home">;

export type PickerForeignOrigin = "shared" | "public";

export type PickerLocation =
  { kind: "path"; path: string } | { kind: "list"; view: PickerListView };

export type PickerTarget =
  { kind: "folder" } | { kind: "object"; types: readonly string[] };

/** Extra caller rule on top of the target, e.g. "no hidden folders". */
export type PickerSelectablePredicate = (object: {
  name: string;
  path: string;
  type?: string;
}) => boolean;

const nameCollator = new Intl.Collator(undefined, { sensitivity: "base" });

const folderTarget: PickerTarget = { kind: "folder" };

/**
 * Picking files, a job result opens (through its hidden folder, where its
 * outputs live) unless it is itself a requested type.
 */
function opensJobResult(item: WorkspaceItem, target: PickerTarget): boolean {
  return (
    target.kind === "object" &&
    normalizeWorkspaceObjectType(item.type) === "job_result" &&
    !matchesTargetType(item, target)
  );
}

export function isPickerItemNavigable(
  item: WorkspaceItem,
  target: PickerTarget = folderTarget,
): boolean {
  return isFolder(item.type) || opensJobResult(item, target);
}

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
 * The path a row stands for in the selection; a job result the picker opens
 * stands for its hidden folder (`/a/J` -> `/a/.J`).
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
 * Where the picker opens: the view of the current value and the chain of
 * folders from its first column down to the value. Home's first column is a
 * directory (`/owner/home`); every other view starts with a workspace listing,
 * so its first column already holds `/owner/workspace`.
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
 * Shared and Public both come from the `/` listing; a folder destination must
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
 * Rows to show: folders plus files of the requested types ("Show all" lifts the
 * filter), folder-like items first.
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
    return nameCollator.compare(a.name, b.name);
  });
}

/**
 * Whether the picker leaves a row out for being hidden (a dot name). Picking
 * files inside a job's hidden folder is the exception, since hidden folders
 * hold outputs too (e.g. `.annotation`), unless a job result listed beside it
 * already opens it, which would list it twice.
 */
export function isHiddenPickerItem({
  item,
  location,
  items,
  target,
}: {
  item: WorkspaceItem;
  location: PickerLocation;
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
 * Where the picker opens; picking files, the value is a file, so open its
 * folder (a job result's hidden folder included) with the file selected.
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
  if (segments.length < 3) return { view: "home", chain: [], file: null };
  const { view, chain } = initialColumnChain(
    `/${segments.slice(0, -1).join("/")}`,
    username,
  );
  return { view, chain, file: `/${segments.join("/")}` };
}

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

export function pickerTypeLabel(type: string): string {
  const known = uploadTypeLabels[type]?.label;
  if (known) return known;
  const words = type.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function pickerTypeList(types: readonly string[]): string {
  return typeListFormat.format(pickerTypeLabels(types));
}

export function pickerTypeLabels(types: readonly string[]): string[] {
  return [...new Set(types.map(pickerTypeLabel))];
}

/**
 * The most types a picker names in a sentence; a longer list (the Copilot's
 * "any file") would bury the instructions, so the dialog offers it behind a
 * button.
 */
export const maxListedPickerTypes = 4;

export function isLongPickerTypeList(types: readonly string[]): boolean {
  return pickerTypeLabels(types).length > maxListedPickerTypes;
}

const groupKindByType: Record<string, string | undefined> = {
  genome_group: "genome",
  feature_group: "feature",
};

/**
 * The kinds of group ("genome", "feature") when every type is a group type,
 * else null; a group is picked as a unit.
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

export function pickerTitleFor(target: PickerTarget): string {
  if (target.kind === "folder") return "Select a Folder";
  const kinds = groupKinds(target.types);
  if (!kinds) return "Select a File";
  const names = kinds.map((kind) => kind.charAt(0).toUpperCase() + kind.slice(1));
  return `Select a ${typeListFormat.format(names)} Group`;
}

export function pickerTypePhrase(types: readonly string[]): string {
  const kinds = groupKinds(types);
  return kinds
    ? `${typeListFormat.format(kinds)} groups`
    : `${pickerTypeList(types)} files`;
}

function workspaceRootOf(path: string): string | null {
  const [owner, workspace] = pathSegments(path);
  return owner && workspace ? `/${owner}/${workspace}` : null;
}

export function stubsNeedWorkspaces(
  paths: readonly string[],
  username: string,
): boolean {
  return paths.some((path) => !isOwnPath(path, username));
}

/**
 * Rows for path-only listings (favorites, recent). A bare path carries no
 * permission, so each row takes its workspace's permissions from `workspaces`
 * (the `/` listing); no match stays unknown, which `canWriteTo` reads as no.
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
 * Whether the user can write into `path`: own paths always; otherwise the
 * item's permission, then a sibling's, since permissions are per workspace;
 * with no evidence, no.
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
          : isLongPickerTypeList(target.types)
            ? "Pick a file."
            : `Pick a file: ${pickerTypeList(target.types)}.`,
      };
    }
    if (!matchesTargetType(item, target)) {
      return {
        canCommit: false,
        reason: isLongPickerTypeList(target.types)
          ? `${pickerTypeLabel(normalizeWorkspaceObjectType(item.type))} files can't be used here.`
          : `Only ${pickerTypePhrase(target.types)} can be used here.`,
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
 * type, otherwise objects of those types.
 */
export function pickerTargetFor(types: readonly string[]): PickerTarget {
  return types.length > 0 && types.every((type) => isFolder(type))
    ? { kind: "folder" }
    : { kind: "object", types };
}

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
 * Why a new folder's name won't do, or null; hidden (dot) folders are never
 * listed, so one created here could not be seen or chosen.
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
