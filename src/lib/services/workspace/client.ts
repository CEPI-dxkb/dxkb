import { WorkspaceMethod } from "./types";
import { parseTupleToRawObject } from "./adapters/parsers";

export class WorkspaceApiClient {
  protected baseUrl: string;

  constructor(_authToken?: string) {
    this.baseUrl = "/api/services/workspace";
  }

  async makeRequest<T = unknown>(
    method: WorkspaceMethod,
    params: unknown[],
    options?: { silent?: boolean },
  ): Promise<T> {
    const silent = options?.silent ?? false;
    try {
      if (!silent) console.log(`Making workspace API call: ${method}`, params);

      const response = await fetch(this.baseUrl, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: 1,
          method,
          params,
          jsonrpc: "2.0",
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as { error?: string; apiResponse?: unknown };
        const err = new Error(
          errorData.error ||
            `HTTP error! status: ${String(response.status)}`,
        ) as Error & { apiResponse?: unknown; status?: number };
        err.apiResponse = errorData.apiResponse ?? errorData;
        err.status = response.status;
        throw err;
      }

      const result = (await response.json()) as {
        error?: { message?: string };
        result?: unknown[];
      };
      if (!silent) console.log(`Workspace API response for ${method}:`, result);

      if (result.error) {
        const rpcError = result.error;
        const err = new Error(rpcError.message || "API error") as Error & {
          apiResponse?: unknown;
        };
        err.apiResponse = result.error;
        throw err;
      }

      if (!silent) console.log("RESULT", result);

      if (method === "Workspace.list_permissions") {
        const permResult = result.result;
        if (!permResult || !permResult[0]) {
          return {} as T;
        }
        return permResult[0] as T;
      }

      // Methods that return result.result as-is. Any method called via
      // makeRequest that is not Workspace.ls-style must be listed, or it is
      // wrongly processed with metaListToObj.
      const rawResultMethods = new Set<WorkspaceMethod>([
        "Workspace.get",
        "Workspace.get_download_url",
        "Workspace.get_archive_url",
        "Workspace.copy",
        "Workspace.update_metadata",
        "Workspace.create",
        "Workspace.update_auto_meta",
        "Workspace.delete",
        "Workspace.move",
        "Workspace.rename",
        "Workspace.save",
        "Workspace.get_permissions",
        "Workspace.du",
      ]);
      if (rawResultMethods.has(method)) {
        return (result.result ?? []) as T;
      }

      const lsResult = result.result;
      if (!lsResult || !lsResult[0]) {
        return [] as T;
      }

      let targetPath: string | null = null;
      let res: unknown[] = [];

      const lsMap = lsResult[0] as Record<string, unknown[] | undefined>;
      if (method === "Workspace.ls" && (params[0] as { paths?: string[] }).paths) {
        const requestedPath = (params[0] as { paths: string[] }).paths[0];
        if (lsMap[requestedPath]) {
          targetPath = requestedPath;
          res = lsMap[requestedPath];
        }
      } else {
        targetPath = Object.keys(lsMap)[0] ?? null;
        if (targetPath) {
          res = lsMap[targetPath] ?? [];
        }
      }

      if (!targetPath) {
        return [] as T;
      }

      res = res.map((r: unknown) => {
        return parseTupleToRawObject(r as unknown[]);
      });

      // Hidden files/folders are not filtered here; the browser UI filters them
      // unless "Show hidden" is on.
      if (!silent) console.log("PROCESSED RESULTS!!!", res);
      return res as T;
    } catch (error) {
      if (!silent) {
        console.error(`Failed to call ${method}:`, error);
        console.error("Error details:", {
          message: error instanceof Error ? error.message : String(error),
          status: (error as { status?: number }).status,
          response: (error as { response?: unknown }).response,
        });
      }
      throw error;
    }
  }

  // No-op overrides: this client authenticates via cookies, not header tokens.
  updateAuthToken(_token: string): void { return; }
  removeAuthToken(): void { return; }
}

export function createWorkspaceApiClient(
  authToken?: string,
): WorkspaceApiClient {
  return new WorkspaceApiClient(authToken);
}

export const workspaceApi = createWorkspaceApiClient();
