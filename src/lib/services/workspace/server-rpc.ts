/**
 * Server-side `WorkspaceRpcPort` for use from route handlers and the auth
 * server module. Hits `WORKSPACE_API_URL` directly with a bearer token rather
 * than going through the `/api/services/workspace` proxy (which only resolves
 * inside a request context with cookies).
 *
 * Mirrors the JSON-RPC envelope in `src/app/api/services/workspace/route.ts`
 * so error messages and headers stay consistent with the client transport.
 */

import { isUpstreamOutage } from "@/lib/api/query-retry";
import {
  describeUpstreamFailure,
  describeUpstreamResponse,
  fetchUpstream,
  hostOf,
  UpstreamError,
  upstreamServices,
  upstreamTimeoutMs,
} from "@/lib/api/upstream-failure";
import { getRequiredEnv } from "@/lib/env";
import type { WorkspaceRpcPort } from "./setup";

interface JsonRpcEnvelope {
  result?: unknown;
  error?: { message?: string; code?: number };
}

export function createServerWorkspaceRpc(token: string): WorkspaceRpcPort {
  return {
    async call<T>(method: string, params: unknown[]): Promise<T> {
      const response = await fetchUpstream(
        getRequiredEnv("WORKSPACE_API_URL"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/jsonrpc+json",
            Authorization: token,
          },
          body: JSON.stringify({ id: 1, method, params, jsonrpc: "2.0" }),
        },
        {
          service: upstreamServices.workspace,
          timeoutMs: upstreamTimeoutMs.workspace,
        },
      );

      // `fetchUpstream`'s budget also bounds the body, and a budget spent (or
      // a socket dropped) mid-body rejects the read: that is an outage too,
      // so setup.ts stops writing and the route answers 504/502.
      const bodyFailure = (error: unknown): never => {
        const failure = describeUpstreamFailure(
          error,
          upstreamServices.workspace,
          {
            timeoutMs: upstreamTimeoutMs.workspace,
            host: hostOf(response.url),
          },
        );
        throw failure ? new UpstreamError(failure, { cause: error }) : error;
      };

      if (!response.ok) {
        const text = await response.text().catch(bodyFailure);
        let upstreamMessage: string | null = null;
        try {
          const parsed = text ? (JSON.parse(text) as JsonRpcEnvelope) : null;
          upstreamMessage = parsed?.error?.message ?? null;
        } catch {
          // Non-JSON upstream body (HTML error page, stack trace, etc.).
          // Logged here in full; the thrown message below carries only the
          // status and `summarizeUpstreamBody`'s condensed summary (an HTML
          // page's title/heading, a JSON error/message, or at most 200
          // characters of text).
          console.error("Workspace API non-JSON error body:", text);
        }
        // The Workspace's own JSON-RPC message ("User lacks permission")
        // stays a plain Error: setup.ts reads it to tell a missing home from
        // an outage. A 502/503/504 is an outage whatever its body says; the
        // summary below still carries that message.
        if (upstreamMessage && !isUpstreamOutage(response)) {
          throw new Error(upstreamMessage);
        }
        // A maintenance page or empty body: its status and page title, so
        // ensure-workspace answers 503 with the real cause, never the HTML.
        throw new UpstreamError(
          describeUpstreamResponse(response, text, upstreamServices.workspace, {
            host: response.url ? hostOf(response.url) : undefined,
          }),
        );
      }

      const payload = (await response
        .json()
        .catch(bodyFailure)) as JsonRpcEnvelope;
      if (payload.error) {
        throw new Error(payload.error.message ?? "Workspace API error");
      }
      return payload.result as T;
    },
  };
}
