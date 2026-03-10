import { WorkspaceMethod } from "./types";
import { metaListToObj } from "./helpers";

/**
 * Base client for making JSON-RPC requests to the Workspace API
 */
export class WorkspaceApiClient {
  private baseUrl: string;

  constructor(_authToken?: string) {
    // Use our internal API endpoint that handles authentication via cookies
    this.baseUrl = "/api/services/workspace";
  }

  /**
   * Make a generic JSON-RPC request to the Workspace API.
   * @param options.silent - When true, do not log errors (e.g. when caller handles missing/expected failures).
   */
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
        credentials: "include", // Include auth cookies
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          method,
          params,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const err = new Error(
          (errorData as { error?: string }).error ||
            `HTTP error! status: ${response.status}`,
        ) as Error & { apiResponse?: unknown };
        err.apiResponse = (errorData as { apiResponse?: unknown }).apiResponse ?? errorData;
        throw err;
      }

      const result = await response.json();
      if (!silent) console.log(`Workspace API response for ${method}:`, result);

      // Handle JSON-RPC response format
      if (result.error) {
        const rpcError = result.error as { message?: string };
        const err = new Error(rpcError.message || "API error") as Error & {
          apiResponse?: unknown;
        };
        err.apiResponse = result.error;
        throw err;
      }

      if (!silent) console.log("RESULT", result);

      // Workspace.list_permissions returns a map path -> [user, perm][]
      if (method === "Workspace.list_permissions") {
        if (!result.result || !result.result[0]) {
          return {} as T;
        }
        return result.result[0] as T;
      }

      // Methods that return result.result as-is (array or nested array).
      // Must include any method called via makeRequest that does not return
      // Workspace.ls-style path-keyed listing; otherwise they fall through to
      // the ls path and get incorrectly processed with metaListToObj.
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

      // Replicate the original logic for processing results (Workspace.ls)
      if (!result.result || !result.result[0]) {
        return [] as T;
      }

      // For Workspace.ls, we need to find the specific path that was requested
      // The original code uses the exact path from the request
      let targetPath: string | null = null;
      let res: unknown[] = [];

      if (method === "Workspace.ls" && (params[0] as { paths?: string[] })?.paths) {
        // Find the path that was requested in the parameters
        const requestedPath = (params[0] as { paths: string[] }).paths[0];
        if (result.result[0][requestedPath]) {
          targetPath = requestedPath;
          res = result.result[0][requestedPath];
        }
      } else {
        // For other methods, use the first available path
        targetPath = Object.keys(result.result[0])[0];
        if (targetPath) {
          res = result.result[0][targetPath];
        }
      }

      if (!targetPath || !res) {
        return [] as T;
      }

      // Map results using metaListToObj (same as original)
      res = res.map((r: unknown) => {
        return metaListToObj(r as unknown[]);
      });

      // Hidden files/folders (names starting with .) are not filtered here;
      // the workspace browser UI filters them by default and shows them when
      // the user toggles "Show hidden".
      if (!silent) console.log("PROCESSED RESULTS!!!", res);
      return res as T;
    } catch (error) {
      if (!silent) {
        console.error(`Failed to call ${method}:`, error);
        console.error("Error details:", {
          message: error instanceof Error ? error.message : String(error),
          status: (error as { status?: number })?.status,
          response: (error as { response?: unknown })?.response,
        });
      }
      throw error;
    }
  }

  /**
   * Update authentication token (not needed when using cookies)
   */
  updateAuthToken(_token: string): void {
    // No-op: authentication is handled via cookies
    console.warn(
      "updateAuthToken called but authentication is handled via cookies",
    );
  }

  /**
   * Remove authentication token (not needed when using cookies)
   */
  removeAuthToken(): void {
    // No-op: authentication is handled via cookies
    console.warn(
      "removeAuthToken called but authentication is handled via cookies",
    );
  }
}

// Factory function for creating workspace API client
export function createWorkspaceApiClient(
  authToken?: string,
): WorkspaceApiClient {
  return new WorkspaceApiClient(authToken);
}

// Default client instance (can be configured with auth token later)
export const workspaceApi = createWorkspaceApiClient();
