import { NextRequest, NextResponse } from "next/server";
import { readAuthSession } from "@/lib/auth/server/route";
import {
  fetchUpstream,
  upstreamServices,
  upstreamTimeoutMs,
} from "@/lib/api/upstream-failure";
import { upstreamFailureResponse } from "@/lib/api/upstream-route";
import { workspaceErrorReply } from "@/lib/api/workspace-proxy-error";
import { getRequiredEnv } from "@/lib/env";

const allowedMethods = new Set(["Workspace.ls", "Workspace.get"]);

/**
 * Public workspace API proxy route.
 * - Does NOT require authentication (no 401 on missing token).
 * - Only allows read-only methods (Workspace.ls, Workspace.get).
 * - Optionally forwards auth token if user happens to be logged in.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { method?: unknown; params?: unknown };
    const { method, params } = body;

    if (typeof method !== "string" || !method) {
      return NextResponse.json(
        { error: "method is required" },
        { status: 400 },
      );
    }

    if (!allowedMethods.has(method)) {
      return NextResponse.json(
        { error: "Method not allowed for public access" },
        { status: 403 },
      );
    }

    const authToken = (await readAuthSession())?.token;

    const headers: Record<string, string> = {
      "Content-Type": "application/jsonrpc+json",
    };
    if (authToken) {
      headers["Authorization"] = authToken;
    }

    const response = await fetchUpstream(
      getRequiredEnv("WORKSPACE_API_URL"),
      {
        method: "POST",
        headers,
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
      return await workspaceErrorReply(response, "Public workspace API error");
    }

    const data: unknown = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Public workspace API error:", error);
    return upstreamFailureResponse(error, upstreamServices.workspace);
  }
}
