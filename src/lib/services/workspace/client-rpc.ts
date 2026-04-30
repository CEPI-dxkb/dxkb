/**
 * Client-side `WorkspaceRpcPort` that delegates to the existing `rpc()` helper
 * (which posts to `/api/services/workspace` with cookie credentials).
 *
 * Currently unused by Path C — the workspace browser hits a server endpoint
 * that runs `ensureUserWorkspace` with a server-bound RPC. Kept for symmetry
 * so the shared logic can run client-side if ever needed (e.g. tests).
 */

import { rpc } from "./adapters/rpc";
import type { WorkspaceRpcPort } from "./setup";

export function createClientWorkspaceRpc(): WorkspaceRpcPort {
  return {
    call<T>(method: string, params: unknown[]): Promise<T> {
      return rpc<T>({ method, params, silent: true });
    },
  };
}
