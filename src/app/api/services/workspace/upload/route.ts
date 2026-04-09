import { NextRequest, NextResponse } from "next/server";
import { requireAuthToken } from "@/lib/auth/session";
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
export async function POST(request: NextRequest) {
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

    const authToken = await requireAuthToken();
    if (authToken instanceof NextResponse) return authToken;

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

    // Shock expects "OAuth <token>" (legacy UploadManager uses Authorization: 'OAuth ' + token)
    const shockAuth =
      authToken.startsWith("OAuth ") ? authToken : `OAuth ${authToken}`;

    const response = await fetch(urlRaw.trim(), {
      method: "PUT",
      headers: {
        Authorization: shockAuth,
      },
      body: uploadFormData,
    });

    if (!response.ok) {
      const text = await response.text();
      let body: unknown = text;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        // leave as text
      }
      return NextResponse.json(
        { error: `Shock upload failed: ${response.status} ${response.statusText}`, details: body },
        { status: response.status },
      );
    }

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data);
  } catch (error) {
    console.error("Workspace upload proxy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
