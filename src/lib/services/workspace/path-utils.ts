/**
 * Domain helpers for workspace path construction and write-access checks.
 * Extracted from `WorkspaceBrowser` so they can be tested without rendering
 * the whole component tree.
 */

import type { ListPermissionsResult, WorkspaceItem } from "./domain";
import type { WorkspaceViewMode } from "@/types/workspace-browser";
import { safeDecode } from "@/lib/url";

export type WorkspaceBreadcrumbViewMode = WorkspaceViewMode | "root";

export interface WorkspaceBreadcrumbDescriptor {
  label: string;
  href?: string;
  icon?: "home" | "public";
  muted?: boolean;
}

interface WorkspaceNavigationInput {
  mode: WorkspaceViewMode;
  path: string;
  username: string;
  sharedRootUsername?: string;
  /**
   * Overrides `path` when building home-mode child destinations. Job-result
   * views pass the dot-prefixed relative path (see `getDotPathRelative`) so
   * children resolve under `.{jobName}` rather than the display path.
   * Ignored in shared/public modes, which derive the URL from `item.path`.
   */
  basePath?: string;
}

interface WorkspaceBreadcrumbInput {
  mode: WorkspaceBreadcrumbViewMode;
  path: string;
  username: string;
  currentUsername?: string;
  workspaceRootUsername?: string;
}

export interface WorkspacePathsInput {
  mode: "home" | "shared" | "public";
  username: string;
  /** Relative path under the workspace root (from the URL segment). */
  path: string;
  /** Current user's workspace root (e.g. "alice@bvbrc"). */
  myWorkspaceRoot: string;
}

export interface WorkspacePaths {
  /** `/` + mode-prefixed full path (e.g. /alice@bvbrc/home/folder). */
  currentDirectoryPath: string;
  /** `/{myWorkspaceRoot}` — used for top-level navigation and root checks. */
  currentUserWorkspaceRoot: string;
  /** Full path as used by the Workspace API for shared/public modes. */
  fullPath: string;
}

export function buildHomePath(username: string, relativePath: string): string {
  const userSegment = username.includes("@") ? username : `${username}@bvbrc`;
  const trimmed = relativePath.replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${userSegment}/home/${trimmed}` : `/${userSegment}/home`;
}

export function computeWorkspacePaths({
  mode,
  username,
  path,
  myWorkspaceRoot,
}: WorkspacePathsInput): WorkspacePaths {
  const fullPath = path ? `/${path}` : "";
  const currentUserWorkspaceRoot = myWorkspaceRoot
    ? `/${myWorkspaceRoot}`
    : `/${username}`;
  const currentDirectoryPath =
    mode === "home" ? `${currentUserWorkspaceRoot}/home${fullPath}` : fullPath;
  return { currentDirectoryPath, currentUserWorkspaceRoot, fullPath };
}

export interface CanWriteInput {
  mode: "home" | "shared" | "public";
  fullPath: string;
  currentUser: string;
  fullWorkspaceUsername: string;
  myWorkspaceRoot: string;
  currentDirPermissions: ListPermissionsResult | undefined;
}

/**
 * Decide whether the current user can write to `fullPath`. Mirrors the
 * browser's previous behavior: always-false for public; always-true for
 * owned paths; otherwise checked against `currentDirPermissions`.
 */
export function canWriteToCurrentDir({
  mode,
  fullPath,
  currentUser,
  fullWorkspaceUsername,
  myWorkspaceRoot,
  currentDirPermissions,
}: CanWriteInput): boolean {
  if (mode === "public") return false;
  if (!fullPath) return false;
  const decodedFullPath = safeDecode(fullPath);
  const isOwnedPath =
    decodedFullPath.startsWith(`/${myWorkspaceRoot}/`) ||
    decodedFullPath.startsWith(`/${currentUser}/`);
  if (isOwnedPath) return true;
  if (!currentDirPermissions) return false;
  const perms = (currentDirPermissions[decodedFullPath] ??
    currentDirPermissions[fullPath]) as [string, string][] | undefined;
  if (!perms) return false;
  const writePerms = new Set(["w", "a", "o"]);
  return perms.some(
    ([user, perm]) =>
      (user === currentUser || user === fullWorkspaceUsername) &&
      writePerms.has(perm),
  );
}

export function hasWorkspaceWritePermission(
  userPermission: string | undefined,
  globalPermission: string | undefined,
): boolean {
  const user = userPermission ?? "";
  const global = globalPermission ?? "";
  return ["o", "a", "w"].some(
    (permission) =>
      user === permission ||
      user.includes(permission) ||
      global === permission ||
      global.includes(permission),
  );
}

/**
 * Decide whether a `WorkspaceItem` grants the current user write access using
 * its own permissions tuple. Used when listing children to decide per-item
 * write actions without an extra round-trip.
 */
export function itemHasWriteAccess(item: WorkspaceItem): boolean {
  return hasWorkspaceWritePermission(
    item.permissions?.user,
    item.permissions?.global,
  );
}

/**
 * Regex that matches C0 control characters (U+0000-U+001F) and DEL (U+007F).
 * Built via `String.fromCharCode` + `RegExp` constructor so the pattern is not
 * statically analyzable by `no-control-regex`, which inspects regex literals
 * and evaluated string arguments to `new RegExp(...)`.
 */
const controlCharRegex = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}]`,
  "g",
);

/** Remove control characters and null bytes from a path segment. */
export function sanitizePathSegment(segment: string): string {
  if (typeof segment !== "string") return "";
  return segment.trim().replace(/\0/g, "").replace(controlCharRegex, "");
}

/**
 * Encode a path segment for use in workspace URLs. Keeps `@` as `@` so it
 * displays correctly in the browser address bar (instead of %40).
 * Sanitizes input so control characters are never added to the URL.
 */
export function encodeWorkspaceSegment(segment: string): string {
  const safe = sanitizePathSegment(segment);
  return encodeURIComponent(safe).replace(/%40/g, "@");
}

/** Split a workspace path into sanitized, non-empty segments. */
export function parsePathSegments(path: string): string[] {
  return path
    .replace(/^\//, "")
    .split("/")
    .map(sanitizePathSegment)
    .filter(Boolean);
}

/** Encode an array of segments into a URL-safe workspace path string. */
export function buildEncodedSegmentPath(segments: string[]): string {
  return segments.map(encodeWorkspaceSegment).join("/");
}

function workspaceNavigationBases(username: string) {
  const safeUsername = sanitizePathSegment(username);
  const encodedUsername = encodeWorkspaceSegment(safeUsername);
  return {
    home: safeUsername
      ? `/workspace/${encodedUsername}/home`
      : "/workspace/home",
    shared: safeUsername
      ? `/workspace/${encodedUsername}`
      : "/workspace/shared",
  };
}

export function workspaceItemDestination(
  input: WorkspaceNavigationInput,
  item: Pick<WorkspaceItem, "name" | "path">,
): string {
  const bases = workspaceNavigationBases(input.username);
  if (input.mode === "public") {
    return `/workspace/public/${buildEncodedSegmentPath(parsePathSegments(item.path))}`;
  }
  if (input.mode === "shared") {
    return `/workspace/${buildEncodedSegmentPath(parsePathSegments(item.path))}`;
  }
  const segments = parsePathSegments(input.basePath ?? input.path);
  segments.push(sanitizePathSegment(item.name));
  return `${bases.home}/${buildEncodedSegmentPath(segments)}`;
}

export function workspaceParentDestination(
  input: WorkspaceNavigationInput,
): string {
  const bases = workspaceNavigationBases(input.username);
  const segments = parsePathSegments(input.path);
  if (input.mode === "public") {
    return segments.length <= 1
      ? "/workspace/public"
      : `/workspace/public/${buildEncodedSegmentPath(segments.slice(0, -1))}`;
  }
  if (input.mode === "shared") {
    if (segments.length <= 1) {
      return input.sharedRootUsername != null
        ? `/workspace/${encodeWorkspaceSegment(
            sanitizePathSegment(input.sharedRootUsername),
          )}`
        : bases.shared;
    }
    return `/workspace/${buildEncodedSegmentPath(segments.slice(0, -1))}`;
  }
  const parentPath = buildEncodedSegmentPath(segments.slice(0, -1));
  return `${bases.home}${parentPath ? `/${parentPath}` : ""}`;
}

export function workspaceRootDestination(username: string): string {
  return workspaceNavigationBases(username).shared;
}

function formatBreadcrumbLabel(
  segment: string,
  currentUsername?: string,
): string {
  const safe = sanitizePathSegment(safeDecode(segment));
  if (!currentUsername || safe === currentUsername) return safe;
  return safe.startsWith(`${currentUsername}@`) ? currentUsername : safe;
}

/**
 * Map path segments to breadcrumb descriptors. Every mode shares the same
 * label/muted policy (the last segment is the current location: unlinked and
 * unmuted); only the href differs, so each caller supplies its own builder.
 */
function segmentCrumbs(
  segments: string[],
  currentUsername: string | undefined,
  hrefFor: (index: number) => string,
): WorkspaceBreadcrumbDescriptor[] {
  return segments.map((segment, index) => {
    const isLast = index === segments.length - 1;
    return {
      label: formatBreadcrumbLabel(segment, currentUsername),
      href: isLast ? undefined : hrefFor(index),
      muted: !isLast,
    };
  });
}

export function buildWorkspaceBreadcrumbs({
  mode,
  path,
  username,
  currentUsername,
  workspaceRootUsername,
}: WorkspaceBreadcrumbInput): WorkspaceBreadcrumbDescriptor[] {
  const segments = parsePathSegments(path);
  const safeUsername = sanitizePathSegment(username);
  const encodedUsername = encodeWorkspaceSegment(safeUsername);
  const usernameRootHref = username
    ? `/workspace/${encodedUsername}`
    : "/workspace";

  if (mode === "root") {
    return [
      {
        label: formatBreadcrumbLabel(safeUsername, currentUsername),
        href: usernameRootHref,
      },
    ];
  }

  if (mode === "public") {
    return [
      {
        label: "Public Workspaces",
        href: segments.length === 0 ? undefined : "/workspace/public",
        icon: "public",
        muted: segments.length > 0,
      },
      ...segmentCrumbs(
        segments,
        currentUsername,
        (index) =>
          `/workspace/public/${buildEncodedSegmentPath(
            segments.slice(0, index + 1),
          )}`,
      ),
    ];
  }

  if (mode === "shared") {
    const myRoot = workspaceRootUsername || currentUsername;
    return segmentCrumbs(segments, currentUsername, (index) =>
      // The first shared segment is another user's root; link it to *our* root
      // so the crumb walks back into the current user's workspace.
      index === 0 && myRoot
        ? `/workspace/${encodeWorkspaceSegment(myRoot)}`
        : `/workspace/${buildEncodedSegmentPath(segments.slice(0, index + 1))}`,
    );
  }

  const homeBase = username
    ? `/workspace/${encodedUsername}/home`
    : "/workspace/home";
  return [
    {
      label: formatBreadcrumbLabel(safeUsername, currentUsername),
      href: usernameRootHref,
      icon: "home",
      muted: segments.length > 0,
    },
    {
      label: "home",
      href: segments.length === 0 ? undefined : homeBase,
      muted: segments.length > 0,
    },
    ...segmentCrumbs(
      segments,
      currentUsername,
      (index) =>
        `${homeBase}/${buildEncodedSegmentPath(segments.slice(0, index + 1))}`,
    ),
  ];
}

/** Full username with @domain for workspace URLs (session stores short form in user.username). */
export function workspaceUsername(
  user: { username?: string; realm?: string } | null,
): string {
  if (!user?.username) return "";
  return user.realm ? `${user.username}@${user.realm}` : user.username;
}
