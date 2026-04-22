import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/server";

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

  const response = await fetch(minhashServiceUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: token },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return NextResponse.json(
      { error: (data as { error?: string })?.error ?? "Minhash service error", ...data },
      { status: response.status },
    );
  }

  return NextResponse.json(data);
});
