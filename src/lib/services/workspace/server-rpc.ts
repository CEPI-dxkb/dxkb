/**
 * Server-side `WorkspaceRpcPort` for use from route handlers and the auth
 * server module. Hits `WORKSPACE_API_URL` directly with a bearer token rather
 * than going through the `/api/services/workspace` proxy (which only resolves
 * inside a request context with cookies).
 *
 * Mirrors the JSON-RPC envelope in `src/app/api/services/workspace/route.ts`
 * so error messages and headers stay consistent with the client transport.
 */

import { getRequiredEnv } from "@/lib/env";
import type { WorkspaceRpcPort } from "./setup";

interface JsonRpcEnvelope {
  result?: unknown;
  error?: { message?: string; code?: number };
}

export function createServerWorkspaceRpc(token: string): WorkspaceRpcPort {
  return {
    async call<T>(method: string, params: unknown[]): Promise<T> {
      const response = await fetch(getRequiredEnv("WORKSPACE_API_URL"), {
        method: "POST",
        headers: {
          "Content-Type": "application/jsonrpc+json",
          Authorization: token,
        },
        body: JSON.stringify({ id: 1, method, params, jsonrpc: "2.0" }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        let upstreamMessage: string | null = null;
        try {
          const parsed = text ? (JSON.parse(text) as JsonRpcEnvelope) : null;
          upstreamMessage = parsed?.error?.message ?? null;
        } catch {
          // Non-JSON upstream body (HTML error page, stack trace, etc.).
          // Log server-side for diagnostics but never propagate it — the
          // thrown message is surfaced through the ensure-workspace API.
          console.error("Workspace API non-JSON error body:", text);
        }
        throw new Error(
          upstreamMessage ||
            `Workspace API HTTP ${response.status} ${response.statusText}`,
        );
      }

      const payload = (await response.json()) as JsonRpcEnvelope;
      if (payload.error) {
        throw new Error(payload.error.message ?? "Workspace API error");
      }
      return payload.result as T;
    },
  };
}
