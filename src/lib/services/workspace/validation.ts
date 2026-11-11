import { WorkspaceApiError } from "./domain";
import { isWorkspaceObjectMissing } from "./workspace-errors";

const method = "Workspace.get";

function property(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null && key in value
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

function messageOf(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value;
  const message = property(value, "message");
  return typeof message === "string" && message.trim() ? message : undefined;
}

function proxyError(body: unknown, status: number): WorkspaceApiError {
  const errorValue = property(body, "error");
  const apiResponse = property(body, "apiResponse") ?? errorValue ?? body;
  return new WorkspaceApiError(
    messageOf(apiResponse) ??
      messageOf(errorValue) ??
      `HTTP error! status: ${String(status)}`,
    method,
    apiResponse,
    status,
  );
}

function foundNothing(body: unknown): boolean {
  const result = property(body, "result");
  const found: unknown = Array.isArray(result) ? result[0] : undefined;
  return (
    Array.isArray(found) &&
    found.every((entry) => Array.isArray(entry) && entry.length === 0)
  );
}

/**
 * Whether an object exists at the path, via Workspace.get: true when found;
 * false when the Workspace says it is not there (its "Object not found" error
 * arrives as HTTP 500, or an empty result). Anything else rejects, so a name is
 * never called available when it could not be checked.
 */
export async function checkWorkspaceObjectExists(
  fullPath: string,
  options?: { signal?: AbortSignal },
): Promise<boolean> {
  if (!fullPath.trim()) {
    return false;
  }

  const response = await fetch("/api/services/workspace", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      method,
      params: [
        {
          objects: [fullPath],
          metadata_only: true,
        },
      ],
    }),
    signal: options?.signal,
  });

  const body: unknown = await response.json().catch(() => null);
  const rpcError = response.ok ? property(body, "error") : undefined;
  if (response.ok && !rpcError) return !foundNothing(body);

  const error = response.ok
    ? new WorkspaceApiError(
        messageOf(rpcError) ?? "Workspace error",
        method,
        rpcError,
      )
    : proxyError(body, response.status);
  if (isWorkspaceObjectMissing(error)) return false;
  throw error;
}
