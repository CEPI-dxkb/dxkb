import { NextRequest, NextResponse } from "next/server";
import { getServerAuthToken } from "@/lib/auth";

/**
 * Workspace API proxy route
 * Forwards JSON-RPC requests to https://p3.theseed.org/services/Workspace
 */
export async function POST(request: NextRequest) {
  try {
    // Get the auth token from cookies
    const authToken = await getServerAuthToken();

    if (!authToken) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // Get the request body
    const body = await request.json();
    const { method, params } = body;

    // Validate required fields
    if (!method) {
      return NextResponse.json(
        { error: "method is required" },
        { status: 400 },
      );
    }

    // Make the request to BV-BRC Workspace API
    const response = await fetch("https://p3.theseed.org/services/Workspace", {
      method: "POST",
      headers: {
        "Content-Type": "application/jsonrpc+json",
        "Authorization": authToken,
      },
      body: JSON.stringify({
        id: 1,
        method,
        params,
        jsonrpc: "2.0",
      }),
    });

    if (!response.ok) {
      console.error("BV-BRC API error:", response.status, response.statusText);
      return NextResponse.json(
        { error: `BV-BRC API error: ${response.status} ${response.statusText}` },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Workspace API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

