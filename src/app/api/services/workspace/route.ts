import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/server/route";
import {
  fetchUpstream,
  upstreamServices,
  upstreamTimeoutMs,
} from "@/lib/api/upstream-failure";
import { upstreamFailureResponse } from "@/lib/api/upstream-route";
import { workspaceErrorReply } from "@/lib/api/workspace-proxy-error";
import { getRequiredEnv } from "@/lib/env";

/**
 * Workspace API proxy route
 * Forwards JSON-RPC requests to WORKSPACE_API_URL
 */
export const POST = withAuth(async (request: NextRequest, { token }) => {
  try {
    const body = (await request.json()) as { method?: unknown; params?: unknown };
    const { method, params } = body;

    if (!method) {
      return NextResponse.json(
        { error: "method is required" },
        { status: 400 },
      );
    }

    const response = await fetchUpstream(
      getRequiredEnv("WORKSPACE_API_URL"),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/jsonrpc+json",
          Authorization: token,
        },
        body: JSON.stringify({
          id: 1,
          method,
          params,
          jsonrpc: "2.0",
        }),
      },
      {
        service: upstreamServices.workspace,
        timeoutMs: upstreamTimeoutMs.workspace,
      },
    );

    if (!response.ok) {
      const firstParam: unknown = Array.isArray(params) ? params[0] : undefined;
      const isPreferencesGet =
        method === "Workspace.get" &&
        typeof firstParam === "object" &&
        firstParam !== null &&
        (firstParam as { objects?: unknown[] }).objects?.some((path: unknown) => {
          if (typeof path !== "string") return false;
          return (
            path.endsWith("/home/.preferences/favorites.json") ||
            path.endsWith("/home/.preferences")
          );
        });
      if (isPreferencesGet && response.status === 404) {
        return NextResponse.json({
          id: 1,
          result: [],
          jsonrpc: "2.0",
        });
      }

      return await workspaceErrorReply(response, "BV-BRC API error");
    }

    const data: unknown = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Workspace API error:", error);
    return upstreamFailureResponse(error, upstreamServices.workspace);
  }
});
