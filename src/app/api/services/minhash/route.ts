import { requireAuthToken } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";

const minhashServiceUrl = process.env.MINHASH_SERVICE_URL;

/**
 * Proxy to Minhash service (Similar Genome Finder).
 * POST /api/services/minhash
 * Body: JSON-RPC payload { method, params, version, id }
 */
export async function POST(request: NextRequest) {
  try {
    if (!minhashServiceUrl) {
      return NextResponse.json(
        { error: "Minhash service URL is not configured (MINHASH_SERVICE_URL)" },
        { status: 500 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Request body must be a JSON object" },
        { status: 400 },
      );
    }

    const authToken = await requireAuthToken();
    if (authToken instanceof NextResponse) return authToken;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": authToken,
    };

    const response = await fetch(minhashServiceUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error ?? "Minhash service error", ...data },
        { status: response.status },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Minhash proxy error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
