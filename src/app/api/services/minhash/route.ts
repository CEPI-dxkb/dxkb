import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/server/route";
import {
  describeUpstreamResponse,
  fetchUpstream,
  upstreamServices,
  upstreamTimeoutMs,
} from "@/lib/api/upstream-failure";

const minhashServiceUrl = process.env.MINHASH_SERVICE_URL;

export const POST = withAuth(async (request: NextRequest, { token }) => {
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

  const response = await fetchUpstream(
    minhashServiceUrl,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: token },
      body: JSON.stringify(body),
    },
    { service: upstreamServices.minhash, timeoutMs: upstreamTimeoutMs.minhash },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      // An HTML error page: described from its status and title below.
    }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const data = parsed as { error?: string } & Record<string, unknown>;
      return NextResponse.json(
        { error: data.error ?? "Minhash service error", ...data },
        { status: response.status },
      );
    }
    return NextResponse.json(
      {
        error: describeUpstreamResponse(response, text, upstreamServices.minhash)
          .message,
      },
      { status: response.status },
    );
  }

  const data = (await response.json()) as Record<string, unknown>;
  return NextResponse.json(data);
});
