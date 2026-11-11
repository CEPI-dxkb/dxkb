import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/server/route";
import {
  summarizeUpstreamBody,
  upstreamServices,
} from "@/lib/api/upstream-failure";
import { upstreamFailureResponse } from "@/lib/api/upstream-route";
import { getRequiredEnv } from "@/lib/env";

/** Shock's API path on a BV-BRC host; an origin-only `SHOCK_ORIGINS` entry serves nodes under it, an entry with its own path uses that. */
const defaultShockApiPath = "/services/shock_api";

const shockNodeId = /^[A-Za-z0-9-]+$/;

interface ShockBase {
  origin: string;
  nodePath: string;
}

function parseShockBases(config: string): ShockBase[] {
  return config.split(",").flatMap((entry) => {
    const trimmed = entry.trim();
    if (!trimmed) return [];
    try {
      const url = new URL(trimmed);
      // Only a web origin: other schemes have none, and the PUT goes over HTTP.
      if (url.protocol !== "http:" && url.protocol !== "https:") return [];
      const apiPath = url.pathname.replace(/\/+$/, "") || defaultShockApiPath;
      return [{ origin: url.origin, nodePath: `${apiPath}/node/` }];
    } catch {
      return [];
    }
  });
}

/** Whether the URL is a node of an allowed Shock API itself, so the user's token cannot be aimed at another host or endpoint. */
function isAllowedShockNodeUrl(urlString: string, bases: ShockBase[]): boolean {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return false;
  }
  if (url.username || url.password || url.search || url.hash) return false;
  return bases.some(
    (base) =>
      url.origin === base.origin &&
      url.pathname.startsWith(base.nodePath) &&
      shockNodeId.test(url.pathname.slice(base.nodePath.length)),
  );
}

/**
 * Streams the multipart body to the Shock node in `X-Shock-Node-Url`, keeping the token server-side.
 * The body is forwarded verbatim, so extra Shock node fields are accepted: Shock authorizes them against the user's own token.
 */
export const POST = withAuth(async (request: NextRequest, { token }) => {
  try {
    let shockOrigins: string;
    try {
      shockOrigins = getRequiredEnv("SHOCK_ORIGINS");
    } catch {
      return NextResponse.json(
        { error: "Server configuration error: SHOCK_ORIGINS not set" },
        { status: 503 },
      );
    }

    const shockUrl = request.headers.get("x-shock-node-url")?.trim();
    if (!shockUrl) {
      return NextResponse.json(
        { error: "Missing or invalid 'X-Shock-Node-Url' header (Shock node URL)" },
        { status: 400 },
      );
    }

    if (!isAllowedShockNodeUrl(shockUrl, parseShockBases(shockOrigins))) {
      return NextResponse.json(
        { error: "URL is not an allowed Shock endpoint" },
        { status: 400 },
      );
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (
      !contentType.toLowerCase().startsWith("multipart/form-data") ||
      !/;\s*boundary=/i.test(contentType)
    ) {
      return NextResponse.json(
        { error: "Expected a multipart/form-data body with an 'upload' file field" },
        { status: 400 },
      );
    }

    if (request.body === null) {
      return NextResponse.json(
        { error: "Missing or invalid 'upload' file" },
        { status: 400 },
      );
    }

    const shockAuth = token.startsWith("OAuth ") ? token : `OAuth ${token}`;
    const headers: Record<string, string> = {
      Authorization: shockAuth,
      "Content-Type": contentType,
    };
    // Some proxies in front of Shock refuse a chunked upload, so forward the length.
    const contentLength = request.headers.get("content-length");
    if (contentLength !== null && /^\d+$/.test(contentLength)) {
      headers["Content-Length"] = contentLength;
    }

    // No budget of our own: a large file legitimately outlasts any fixed one;
    // undici bounds the connect and the wait for an answer.
    const init: RequestInit & { duplex: "half" } = {
      method: "PUT",
      headers,
      body: request.body,
      // Node's fetch requires this for a stream body.
      duplex: "half",
      // Never follow a redirect: it would leave the allowlist. "manual" returns
      // the 3xx for refusal below, where "error" would misreport it as unreachable.
      redirect: "manual",
      signal: request.signal,
    };
    const response = await fetch(shockUrl, init);

    if (response.status >= 300 && response.status < 400) {
      // Not awaited: cancel resolves only once every reader of a tee'd body
      // cancels, and an instrumented fetch may hold the other branch.
      response.body?.cancel().catch(() => undefined);
      return NextResponse.json(
        {
          error: `Shock upload failed: ${String(response.status)} ${response.statusText} (Shock redirected the upload, and redirects are not followed)`,
          code: "upstream",
        },
        { status: 502 },
      );
    }

    if (!response.ok) {
      const text = await response.text();
      let body: unknown;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
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
    // The browser cancelled the upload; not worth logging.
    if (request.signal.aborted) return new NextResponse(null, { status: 499 });
    console.error("Workspace upload proxy error:", error);
    return upstreamFailureResponse(error, upstreamServices.fileStorage);
  }
});
