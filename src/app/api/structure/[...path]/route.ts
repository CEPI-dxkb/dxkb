import { NextRequest, NextResponse } from "next/server";

const structureOrigin = "https://www.bv-brc.org";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const segments = (await params).path ?? [];
  if (
    segments.length === 0 ||
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        segment.includes("/") ||
        segment.includes("\\"),
    )
  ) {
    return NextResponse.json(
      { error: "Invalid structure path" },
      { status: 400 },
    );
  }

  const upstreamSegments = [...segments];
  const fileName = upstreamSegments.at(-1);
  if (fileName?.toLowerCase().endsWith(".gz")) {
    upstreamSegments[upstreamSegments.length - 1] = fileName.slice(0, -3);
  }
  const url = `${structureOrigin}/structure/${upstreamSegments
    .map(encodeURIComponent)
    .join("/")}`;
  try {
    const response = await fetch(url, {
      cache: "force-cache",
      // Cloudflare challenges Node's default Undici user agent for these files.
      headers: { "User-Agent": "curl/8.7.1" },
      next: { revalidate: 300 },
    });
    if (!response.ok) {
      return NextResponse.json(
        {
          error: `BV-BRC structure request failed: ${String(response.status)} ${response.statusText}`,
        },
        { status: response.status },
      );
    }
    const headers = new Headers();
    headers.set(
      "Content-Type",
      response.headers.get("Content-Type") ?? "application/octet-stream",
    );
    headers.set("Cache-Control", "public, max-age=300");
    // Fetch decodes Content-Encoding, so the upstream Content-Length no longer
    // matches the streamed body.
    return new NextResponse(response.body, { status: 200, headers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  }
}
