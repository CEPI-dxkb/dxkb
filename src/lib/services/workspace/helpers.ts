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
export function getJobResultDotPath(resolved: ResolvedPathObject): string {
  const fullPath = resolved.path.replace(/\/+$/, "");
  const parent = fullPath.slice(0, Math.max(0, fullPath.length - resolved.name.length)).replace(/\/+$/, "");
  return parent ? `${parent}/.${resolved.name}` : `.${resolved.name}`;
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