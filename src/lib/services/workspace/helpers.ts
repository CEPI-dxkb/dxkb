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
  JobResultSysMeta,
} from "./types";
import { isFolderType } from "./utils";
import type {
  WorkspaceBrowserItem,
  WorkspaceBrowserSort,
} from "@/types/workspace-browser";

export function metaListToObj(list: unknown[]) {
  return {
    id: list[4],
    path: String(list[2] ?? "") + String(list[0] ?? ""),
    name: list[0],
    type: list[1],
    creation_time: list[3],
    link_reference: list[11],
    owner_id: list[5],
    size: list[6],
    userMeta: list[7],
    autoMeta: list[8],
    user_permission: list[9],
    global_permission: list[10],
    timestamp: Date.parse(String(list[3])),
  };
}

/**
 * Parse raw Workspace.get result for a single path into ResolvedPathObject.
 * Raw shape: result[0][pathIndex][0] = [name, type, path (parent), creation_time, id, owner_id, size, userMeta, sysMeta, ...].
 */
export function parseWorkspaceGetSingle(
  raw: WorkspaceGetRawResult,
  pathIndex = 0,
): ResolvedPathObject | null {
  const pathResults = raw[0];
  if (!Array.isArray(pathResults)) return null;
  const objectsAtPath = pathResults[pathIndex];
  if (!Array.isArray(objectsAtPath) || objectsAtPath.length === 0) return null;
  const list = objectsAtPath[0] as unknown[];
  if (!Array.isArray(list)) return null;

  const parent = String(list[2] ?? "");
  const name = String(list[0] ?? "");
  const fullPath = (parent + name).replace(/\/+/g, "/");
  const userMeta = (list[7] as Record<string, unknown>) ?? {};
  const sysMeta = (list[8] as Record<string, unknown>) ?? {};

  const resolved: ResolvedPathObject = {
    name,
    type: String(list[1] ?? ""),
    path: fullPath,
    creation_time: String(list[3] ?? ""),
    id: String(list[4] ?? ""),
    owner_id: String(list[5] ?? ""),
    size: Number(list[6]) || 0,
    userMeta,
    sysMeta,
  };

  if (resolved.type === "job_result") {
    resolved.taskData = userMeta.task_data as JobResultTaskData | undefined;
    resolved.jobSysMeta = sysMeta as JobResultSysMeta;
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
  const fullPath = String(resolved.path ?? "").replace(/\/+$/, "");
  const name = String(resolved.name ?? "").replace(/^\/+|\/+$/g, "");

  const fallbackName = fullPath.split("/").filter(Boolean).pop() ?? "";
  const dotName = name || fallbackName;

  let parent = "";
  if (dotName) {
    const suffix = `/${dotName}`;
    const nameAlreadyInPath =
      fullPath === dotName || fullPath.endsWith(suffix);
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

// Validator function to check if a type is a valid knownUploadType
export function isValidWorkspaceObjectType(type: string): type is ValidWorkspaceObjectTypes {
  const validTypes = getValidWorkspaceObjectTypes();
  return validTypes.includes(type as ValidWorkspaceObjectTypes);
}

// Get all valid upload type keys
export function getValidWorkspaceObjectTypes(): ValidWorkspaceObjectTypes[] {
  return [
    ...Object.keys(knownUploadTypes),
    ...otherWorkspaceObjectTypes,
    ...viewableTypes,
  ] as ValidWorkspaceObjectTypes[];
}

// Validate multiple types at once
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

export function hasWriteAccess(item: WorkspaceBrowserItem): boolean {
  const userPerm = String(item.user_permission ?? "");
  const globalPerm = String(item.global_permission ?? "");

  const hasUserWrite =
    userPerm === "o" ||
    userPerm === "a" ||
    userPerm.includes("w");
  const hasGlobalWrite =
    globalPerm === "o" ||
    globalPerm === "a" ||
    globalPerm.includes("w");

  return hasUserWrite || hasGlobalWrite;
}

export function sortItems(
  items: WorkspaceBrowserItem[],
  sort: WorkspaceBrowserSort,
): WorkspaceBrowserItem[] {
  return [...items].sort((a, b) => {
    const aIsFolder = isFolderType(a.type);
    const bIsFolder = isFolderType(b.type);
    if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;

    let comparison = 0;
    switch (sort.field) {
      case "name":
        comparison = (a.name ?? "").localeCompare(b.name ?? "", undefined, {
          sensitivity: "base",
        });
        break;
      case "size":
        comparison = (a.size ?? 0) - (b.size ?? 0);
        break;
      case "owner_id":
        comparison = (a.owner_id ?? "").localeCompare(b.owner_id ?? "");
        break;
      case "creation_time":
        comparison = (a.timestamp ?? 0) - (b.timestamp ?? 0);
        break;
      case "type":
        comparison = (a.type ?? "").localeCompare(b.type ?? "");
        break;
      default:
        comparison = 0;
    }

    return sort.direction === "asc" ? comparison : -comparison;
  });
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

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function normalizeWsPath(p: string): string {
  const trimmed = (p ?? "").trim();
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