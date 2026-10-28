import { sanitizePathSegment } from "./path-utils";
import {
  ValidWorkspaceObjectTypes,
  knownUploadTypes,
  otherWorkspaceObjectTypes,
  viewableTypes,
} from "./types";
import type {
  WorkspaceGetRawResult,
  ResolvedPathObject,
  JobResultTaskData,
} from "./types";
import { isFolder, isFolderType } from "./utils";
import type { WorkspaceItem } from "./domain";
import type { WorkspaceSortConfig } from "@/types/workspace-browser";
import { hasWorkspaceWritePermission } from "./path-utils";

/**
 * Parse raw Workspace.get result for a single path into ResolvedPathObject.
 * Raw shape: result[0][pathIndex][0] = [name, type, path (parent), creation_time, id, owner_id, size, userMeta, sysMeta, ...].
 */
export function parseWorkspaceGetSingle(
  raw: WorkspaceGetRawResult,
  pathIndex = 0,
): ResolvedPathObject | null {
  const pathResults: unknown = raw[0];
  if (!Array.isArray(pathResults)) return null;
  const objectsAtPath: unknown = pathResults[pathIndex];
  if (!Array.isArray(objectsAtPath) || objectsAtPath.length === 0) return null;
  const list = objectsAtPath[0] as unknown[];
  if (!Array.isArray(list)) return null;

  const parent = (list[2] as string | undefined) ?? "";
  const name = (list[0] as string | undefined) ?? "";
  const fullPath = (parent + name).replace(/\/+/g, "/");
  const userMeta = (list[7] as Record<string, unknown> | undefined) ?? {};
  const sysMeta = (list[8] as Record<string, unknown> | undefined) ?? {};

  const resolved: ResolvedPathObject = {
    name,
    type: (list[1] as string | undefined) ?? "",
    path: fullPath,
    creation_time: (list[3] as string | undefined) ?? "",
    id: (list[4] as string | undefined) ?? "",
    owner_id: (list[5] as string | undefined) ?? "",
    size: Number(list[6]) || 0,
    userMeta,
    sysMeta,
  };

  if (resolved.type === "job_result") {
    resolved.taskData = userMeta.task_data as JobResultTaskData | undefined;
    resolved.jobSysMeta = sysMeta;
  }

  return resolved;
}

/**
 * Compute the dot-folder path for a job_result (hidden folder containing output files).
 * e.g. /user/home/folder/jobname -> /user/home/folder/.jobname
 */
export function getJobResultDotPath(
  resolved: Pick<ResolvedPathObject, "path" | "name">,
): string {
  const fullPath = resolved.path.replace(/\/+$/, "");
  const name = resolved.name.replace(/^\/+|\/+$/g, "");

  const fallbackName = fullPath.split("/").filter(Boolean).pop() ?? "";
  const dotName = name || fallbackName;

  let parent = "";
  if (dotName) {
    const suffix = `/${dotName}`;
    const nameAlreadyInPath = fullPath === dotName || fullPath.endsWith(suffix);
    if (nameAlreadyInPath) {
      parent = fullPath
        .slice(0, Math.max(0, fullPath.length - dotName.length))
        .replace(/\/+$/, "");
    } else {
      const lastSlash = fullPath.lastIndexOf("/");
      parent = lastSlash > 0 ? fullPath.slice(0, lastSlash) : "";
    }
  }

  return parent ? `${parent}/.${dotName}` : `.${dotName}`;
}

export function isValidWorkspaceObjectType(
  type: string,
): type is ValidWorkspaceObjectTypes {
  const validTypes = getValidWorkspaceObjectTypes();
  return validTypes.includes(type as ValidWorkspaceObjectTypes);
}

export function getValidWorkspaceObjectTypes(): ValidWorkspaceObjectTypes[] {
  return [
    ...Object.keys(knownUploadTypes),
    ...otherWorkspaceObjectTypes,
    ...viewableTypes,
  ] as ValidWorkspaceObjectTypes[];
}

export function validateWorkspaceObjectTypes(types: string[]): {
  valid: ValidWorkspaceObjectTypes[];
  invalid: string[];
} {
  const valid: ValidWorkspaceObjectTypes[] = [];
  const invalid: string[] = [];

  types.forEach((type) => {
    if (isValidWorkspaceObjectType(type)) {
      valid.push(type);
    } else {
      invalid.push(type);
    }
  });

  return { valid, invalid };
}

export function hasWriteAccess(item: WorkspaceItem): boolean {
  return hasWorkspaceWritePermission(
    item.permissions?.user,
    item.permissions?.global,
  );
}

export function sortItems(
  items: WorkspaceItem[],
  sort: WorkspaceSortConfig,
): WorkspaceItem[] {
  return [...items].sort((a, b) => {
    const aIsFolder = isFolderType(a.type);
    const bIsFolder = isFolderType(b.type);

    if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;

    let comparison = 0;
    switch (sort.field) {
      case "name": {
        // Text-starting names sort before digit-starting names, matching BV-BRC's
        // default workspace sort (e.g. "Bacillus anthracis" before "1386.5504").
        const aDigit = /^\d/.test(a.name);
        const bDigit = /^\d/.test(b.name);
        if (aDigit !== bDigit) {
          comparison = aDigit ? 1 : -1;
        } else {
          // Primary: case-insensitive alphabetical + natural numeric order.
          // Tiebreaker: uppercase before lowercase (e.g. "Alpha" before "alpha").
          comparison =
            a.name.localeCompare(b.name, undefined, {
              sensitivity: "base",
              numeric: true,
            }) ||
            a.name.localeCompare(b.name, undefined, {
              caseFirst: "upper",
              numeric: true,
            });
        }
        break;
      }
      case "size":
        comparison = a.size - b.size;
        break;
      case "ownerId":
        comparison = (a.ownerId ?? "").localeCompare(b.ownerId ?? "");
        break;
      case "createdAt":
        comparison = (a.timestamp ?? 0) - (b.timestamp ?? 0);
        break;
      case "type":
        comparison = a.type.localeCompare(b.type);
        break;
      default:
        comparison = 0;
    }

    return sort.direction === "asc" ? comparison : -comparison;
  });
}

export function formatOwner(ownerId: string): string {
  if (!ownerId) return "—";
  return ownerId.replace(/@bvbrc$/, "");
}

export function formatDate(dateString: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatFileSize(
  bytes: number,
  { showZero = false }: { showZero?: boolean } = {},
): string {
  if (!bytes || bytes === 0) return showZero ? "0 B" : "";
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes < 1024 * 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  return `${(bytes / (1024 * 1024 * 1024 * 1024)).toFixed(2)} TB`;
}

export function normalizeWsPath(p: string | null | undefined): string {
  const trimmed = (p ?? "").trim(); // runtime guard: API can return null for path fields
  if (!trimmed) return "";
  const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeading.replace(/\/+$/, "").replace(/\/+/g, "/");
}

export function dedupeKeepOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const n = normalizeWsPath(v);
    if (!n) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

/**
 * Returns normalized paths for items that are folders (type folder/directory/modelfolder).
 * Used to know which paths to check for "non-empty" when confirming delete.
 */
export function getFolderPathsFromItems(items: WorkspaceItem[]): string[] {
  const paths: string[] = [];
  for (const item of items) {
    if (!item.path || !isFolder(item.type)) continue;
    const normalized = normalizeWsPath(item.path);
    if (normalized) paths.push(normalized);
  }
  return paths;
}

/**
 * Given folder paths and a function that lists a folder's contents, returns which paths
 * are non-empty (have at least one child). Uses optional AbortSignal to cancel when dialog closes.
 */
export async function getNonEmptyFolderPaths(
  folderPaths: string[],
  listFolder: (path: string) => Promise<WorkspaceItem[]>,
  options?: { signal?: AbortSignal },
): Promise<string[]> {
  if (options?.signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  const results = await Promise.all(
    folderPaths.map(async (folderPath) => {
      try {
        const listing = await listFolder(folderPath);
        if (options?.signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        return listing.length > 0 ? folderPath : null;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") throw err;
        return null;
      }
    }),
  );

  return results.filter((p): p is string => p !== null);
}

/**
 * Given a dot-folder path (e.g. /user/home/.jobname) and the current items list,
 * returns the path of the sibling job_result item if present.
 */
export function getSiblingJobResultPathForDotFolder(
  dotFolderPath: string,
  items: WorkspaceItem[],
): string | null {
  const normalized = normalizeWsPath(dotFolderPath);
  if (!normalized) return null;

  const segments = normalized.split("/").filter(Boolean);
  const last = segments[segments.length - 1] ?? "";
  if (!last.startsWith(".") || last.length < 2) return null;

  const siblingLast = last.slice(1);
  const siblingPath = `/${[...segments.slice(0, -1), siblingLast].join("/")}`;
  const siblingNormalized = normalizeWsPath(siblingPath);
  const sibling = items.find(
    (it) =>
      normalizeWsPath(it.path) === siblingNormalized &&
      it.type.toLowerCase() === "job_result",
  );
  return sibling ? siblingNormalized : null;
}

/**
 * Expands a selection of downloadable items into the full list of paths to download,
 * handling job_result dot-folders and sibling job_result paths. Returns deduplicated paths.
 */
export function expandDownloadPaths(
  downloadableItems: WorkspaceItem[],
  items: WorkspaceItem[],
): string[] {
  const expandedPaths = downloadableItems.flatMap((item) => {
    const p = normalizeWsPath(item.path);
    if (!p) return [];

    const type = item.type.toLowerCase();
    if (type === "job_result") {
      const name =
        item.name.trim() ||
        p.split("/").filter(Boolean).pop() ||
        "";
      const dotPath = normalizeWsPath(getJobResultDotPath({ path: p, name }));
      return [dotPath, p].filter(Boolean);
    }

    const siblingJobResultPath = getSiblingJobResultPathForDotFolder(p, items);
    if (siblingJobResultPath) return [p, siblingJobResultPath];

    return [p];
  });
  return dedupeKeepOrder(expandedPaths);
}

export interface EnsureDestinationWriteAccessResult {
  ok: boolean;
  errorMessage?: string;
}

/**
 * Verifies that the current user has write access to the given destination path
 * (or its parent, if the destination is a new name). Uses the provided listFolder
 * to fetch the parent listing. Returns { ok: true } or { ok: false, errorMessage }.
 */
export async function ensureDestinationWriteAccess(
  destinationPath: string,
  listFolder: (path: string) => Promise<WorkspaceItem[]>,
): Promise<EnsureDestinationWriteAccessResult> {
  const normalized = normalizeWsPath(destinationPath);
  const lastSlash = normalized.lastIndexOf("/");
  const parentPath =
    lastSlash > 0 ? normalized.slice(0, lastSlash) || "/" : "/";

  try {
    const listing = await listFolder(parentPath);

    const target = listing.find(
      (item) => normalizeWsPath(item.path) === normalized,
    );

    if (target) {
      if (!hasWriteAccess(target)) {
        return {
          ok: false,
          errorMessage: `Access denied, you do not have write access to ${normalized || "/"}`,
        };
      }
      return { ok: true };
    }

    if (parentPath === "/" || !parentPath) {
      return {
        ok: false,
        errorMessage: `Access denied, you do not have write access to ${normalized || "/"}`,
      };
    }
    const grandparentPath =
      parentPath.slice(0, parentPath.lastIndexOf("/")) || "/";
    const parentListing = await listFolder(grandparentPath);
    const parentItem = parentListing.find(
      (item) =>
        normalizeWsPath(item.path) === normalizeWsPath(parentPath),
    );
    if (!parentItem || !hasWriteAccess(parentItem)) {
      return {
        ok: false,
        errorMessage: `Access denied, you do not have write access to ${normalized || "/"}`,
      };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      errorMessage: `Access denied, you do not have write access to ${normalized || "/"}`,
    };
  }
}

/** Dot path relative to workspace for URL (e.g. "ProteinMPNN_tests/.1e08_dwnld_d10010111"). */
export function getDotPathRelative(path: string, jobName: string): string {
  const segments = path.split("/").map(sanitizePathSegment).filter(Boolean);
  const withoutLast = segments.slice(0, -1);
  const base = withoutLast.length > 0 ? withoutLast.join("/") : "";
  const safeJobName = sanitizePathSegment(jobName);
  return base ? `${base}/.${safeJobName}` : `.${safeJobName}`;
}

/**
 * Success-toast text for an action on a named workspace object, in the one
 * format every such confirmation uses: `Created Genome Group: "My Group"`.
 */
export function namedObjectConfirmation(
  action: "Created" | "Updated",
  objectKind: string,
  name: string,
): string {
  return `${action} ${objectKind}: "${name}"`;
}
