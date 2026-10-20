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

/** The proxy's error answer as the workspace adapter would throw it. */
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

/** `result[0]` holds what was found per requested path; empty means nothing. */
function foundNothing(body: unknown): boolean {
  const result = property(body, "result");
  const found: unknown = Array.isArray(result) ? result[0] : undefined;
  return (
    Array.isArray(found) &&
    found.every((entry) => Array.isArray(entry) && entry.length === 0)
  );
}

/**
 * Check if a workspace object exists at the given path using Workspace.get.
 * - Found: true (the name is taken).
 * - The Workspace answers that the object is not there (its "Object not
 *   found" JSON-RPC error, which arrives as an HTTP 500, or an empty
 *   result): false (the name is available).
 * - Anything else rejects, so the caller says the name could not be checked
 *   rather than calling it available: an outage (502/503/504), another
 *   Workspace error, or a network failure.
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
