import { NextRequest, NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth/session";
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
    const body = await request.json();
    const { method, params } = body;

    if (!method) {
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

    // Optionally include auth token if user is logged in
    const authToken = await getAuthToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/jsonrpc+json",
    };
    if (authToken) {
      headers["Authorization"] = authToken;
    }

    const response = await fetch(getRequiredEnv("WORKSPACE_API_URL"), {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: 1,
        method,
        params,
        jsonrpc: "2.0",
      }),
    });

    if (!response.ok) {
      const responseText = await response.text();
      let apiResponse: unknown = null;
      try {
        apiResponse = responseText ? JSON.parse(responseText) : null;
      } catch {
        apiResponse = responseText || null;
      }
      console.error("Public workspace API error:", response.status, response.statusText, apiResponse);
      return NextResponse.json(
        { error: `BV-BRC API error: ${response.status} ${response.statusText}` },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Public workspace API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
