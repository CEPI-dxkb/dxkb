import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/server/route";
import {
  summarizeUpstreamBody,
  upstreamServices,
} from "@/lib/api/upstream-failure";
import { upstreamFailureResponse } from "@/lib/api/upstream-route";
import { getRequiredEnv } from "@/lib/env";

function isAllowedShockUrl(urlString: string, allowedOrigins: string): boolean {
  try {
    const url = new URL(urlString);
    const origin = url.origin;
    return allowedOrigins.split(",").map((o) => o.trim()).includes(origin);
  } catch {
    return false;
  }
}

/**
 * Proxy route: accepts a file and Shock node URL, then PUTs the file to Shock with auth.
 * Keeps the BV-BRC token server-side and avoids CORS.
 */
export const POST = withAuth(async (request: NextRequest, { token }) => {
  try {
    let allowedShockOrigins: string;
    try {
      allowedShockOrigins = getRequiredEnv("SHOCK_ORIGINS");
    } catch {
      return NextResponse.json(
        { error: "Server configuration error: SHOCK_ORIGINS not set" },
        { status: 503 },
      );
    }

    const formData = await request.formData();
    const urlRaw = formData.get("url");
    const file = formData.get("file") ?? formData.get("upload");

    if (typeof urlRaw !== "string" || !urlRaw.trim()) {
      return NextResponse.json(
        { error: "Missing or invalid 'url' (Shock node URL)" },
        { status: 400 },
      );
    }
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing or invalid 'file' (upload)" },
        { status: 400 },
      );
    }

    if (!isAllowedShockUrl(urlRaw, allowedShockOrigins)) {
      return NextResponse.json(
        { error: "URL is not an allowed Shock endpoint" },
        { status: 400 },
      );
    }

    const uploadFormData = new FormData();
    uploadFormData.append("upload", file);

    const shockAuth = token.startsWith("OAuth ") ? token : `OAuth ${token}`;

    // No budget of our own: the file is sent before Shock can answer, and a
    // large one legitimately takes longer than any fixed budget. undici
    // bounds the connect (10 s) and, once the body is sent, the wait for an
    // answer (300 s).
    const response = await fetch(urlRaw.trim(), {
      method: "PUT",
      headers: {
        Authorization: shockAuth,
      },
      body: uploadFormData,
    });

    if (!response.ok) {
      const text = await response.text();
      let body: unknown;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        // Text, or an HTML error page: its readable part, never the markup.
        body = summarizeUpstreamBody(text, response.headers.get("content-type"));
      }
      return NextResponse.json(
        { error: `Shock upload failed: ${String(response.status)} ${response.statusText}`, details: body },
        { status: response.status },
      );
    }

    const data: unknown = await response.json().catch(() => ({}));
    return NextResponse.json(data);
  } catch (error) {
    console.error("Workspace upload proxy error:", error);
    return upstreamFailureResponse(error, upstreamServices.fileStorage);
  }
});
