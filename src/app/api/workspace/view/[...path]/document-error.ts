import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { encodePathSegment } from "@/lib/url";
import { formatUserFacingErrorMessage } from "@/lib/utils";

/** A request that asks for HTML ("Open in new tab", iframes) gets a readable page instead of raw JSON; `fetch` callers keep the JSON. */
export function wantsDocument(request: NextRequest): boolean {
  const destination = request.headers.get("sec-fetch-dest");
  if (destination === "document" || destination === "iframe") return true;
  return /\btext\/html\b/i.test(request.headers.get("accept") ?? "");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function folderHref(segments: string[]): string {
  const folder = segments.slice(0, -1);
  return folder.length > 0
    ? `/workspace/${folder.map(encodePathSegment).join("/")}`
    : "/workspace";
}

async function errorMessageOf(response: NextResponse): Promise<string> {
  const body = (await response
    .clone()
    .json()
    .catch(() => null)) as { error?: unknown } | null;
  const message = typeof body?.error === "string" ? body.error : "";
  return formatUserFacingErrorMessage(
    new Error(message),
    `The file could not be loaded (HTTP ${String(response.status)}).`,
  );
}

export async function documentErrorResponse(
  response: NextResponse,
  segments: string[],
): Promise<NextResponse> {
  const filename = segments.at(-1) ?? "this file";
  const title = `Couldn't open ${filename}`;
  const message = await errorMessageOf(response);
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>body{font-family:system-ui,sans-serif;line-height:1.5;max-width:40rem;margin:4rem auto;padding:0 1rem}</style>
</head>
<body>
<main>
<h1>${escapeHtml(title)}</h1>
<p role="alert">${escapeHtml(message)}</p>
<p>HTTP ${String(response.status)}</p>
<p><a href="${escapeHtml(folderHref(segments))}">Back to the folder</a></p>
</main>
</body>
</html>
`;
  return new NextResponse(html, {
    status: response.status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}
