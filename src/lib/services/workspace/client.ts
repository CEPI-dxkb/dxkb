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
        const errorData = await response.json();
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`,
        );
      }

      const result = await response.json();
      console.log(`Workspace API response for ${method}:`, result);

      // Handle JSON-RPC response format
      if (result.error) {
        throw new Error(result.error.message || "API error");
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

      // Filter out hidden folders and apply type filtering (same as original)
      res = res.filter((r: unknown) => {
        const obj = r as Record<string, unknown>;
        if (obj.type === "folder") {
          if (String(obj.path).split("/").some((p: string) => {
            return p.charAt(0) === '.';
          })) {
            return false;
          }
        }
        return true; // We'll handle type filtering in the specific methods
      });

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
