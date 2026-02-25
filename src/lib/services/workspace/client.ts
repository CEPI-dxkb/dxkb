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
   * Make a generic JSON-RPC request to the Workspace API
   */
  async makeRequest<T = unknown>(
    method: WorkspaceMethod,
    params: unknown[],
  ): Promise<T> {
    try {
      console.log(`Making workspace API call: ${method}`, params);

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
      console.log(`Workspace API response for ${method}:`, result);

      // Handle JSON-RPC response format
      if (result.error) {
        const rpcError = result.error as { message?: string };
        const err = new Error(rpcError.message || "API error") as Error & {
          apiResponse?: unknown;
        };
        err.apiResponse = result.error;
        throw err;
      }

      console.log("RESULT", result);

      // Workspace.list_permissions returns a map path -> [user, perm][]
      if (method === "Workspace.list_permissions") {
        if (!result.result || !result.result[0]) {
          return {} as T;
        }
        return result.result[0] as T;
      }

      // Workspace.get returns nested array of object metadata
      if (method === "Workspace.get") {
        return (result.result ?? []) as T;
      }

      // Workspace.get_download_url returns array of URL arrays: [[url], [url], ...]
      if (method === "Workspace.get_download_url") {
        return (result.result ?? []) as T;
      }

      // Workspace.copy returns result array (path-based copy)
      if (method === "Workspace.copy") {
        return (result.result ?? []) as T;
      }

      // Workspace.update_metadata returns result array of updated object metadata
      if (method === "Workspace.update_metadata") {
        return (result.result ?? []) as T;
      }

      // Workspace.create returns result array (nested array of created object metadata)
      if (method === "Workspace.create") {
        return (result.result ?? []) as T;
      }

      // Workspace.update_auto_meta returns result array (updated object metadata)
      if (method === "Workspace.update_auto_meta") {
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
      console.log("PROCESSED RESULTS!!!", res);
      return res as T;
    } catch (error) {
      console.error(`Failed to call ${method}:`, error);
      console.error("Error details:", {
        message: error instanceof Error ? error.message : String(error),
        status: (error as { status?: number })?.status,
        response: (error as { response?: unknown })?.response,
      });
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
