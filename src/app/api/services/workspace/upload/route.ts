import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/server/route";
import {
  summarizeUpstreamBody,
  upstreamServices,
} from "@/lib/api/upstream-failure";
import { upstreamFailureResponse } from "@/lib/api/upstream-route";
import { getRequiredEnv } from "@/lib/env";

/**
 * Shock's API path on a BV-BRC host. A `SHOCK_ORIGINS` entry that names only
 * an origin (`https://p3.theseed.org`) serves its nodes under this path, as
 * the `link_reference` Workspace.create returns does
 * (`https://p3.theseed.org/services/shock_api/node/<id>`). An entry with a
 * path of its own (`https://host/shock`) uses that path instead.
 */
const defaultShockApiPath = "/services/shock_api";

const shockNodeId = /^[A-Za-z0-9-]+$/;

interface ShockBase {
  origin: string;
  /** The path a node URL starts with, ending in `/node/`. */
  nodePath: string;
}

/** The Shock APIs `SHOCK_ORIGINS` allows, one per comma-separated entry. */
function parseShockBases(config: string): ShockBase[] {
  return config.split(",").flatMap((entry) => {
    const trimmed = entry.trim();
    if (!trimmed) return [];
    try {
      const url = new URL(trimmed);
      // Only a web origin: any other scheme has none (or an opaque "null"
      // one), and the PUT goes over HTTP.
      if (url.protocol !== "http:" && url.protocol !== "https:") return [];
      const apiPath = url.pathname.replace(/\/+$/, "") || defaultShockApiPath;
      return [{ origin: url.origin, nodePath: `${apiPath}/node/` }];
    } catch {
      return [];
    }
  });
}

/**
 * Whether the URL names a node of an allowed Shock API itself
 * (`<origin><api path>/node/<id>`), so the user's token can be aimed neither
 * at another host nor at another endpoint on an allowed one (a node's ACL,
 * another service on the host, a query, credentials of its own).
 */
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
 * Proxy route: streams the browser's multipart body (field `upload`) to the
 * Shock node named in the `X-Shock-Node-Url` header, with auth, without
 * buffering it. The node URL must be a `/node/<id>` path under a Shock API
 * that `SHOCK_ORIGINS` allows. Keeps the BV-BRC token server-side and avoids
 * CORS.
 *
 * The body is forwarded verbatim, so a client can put other Shock node fields
 * (attributes, a different part) beside `upload`. That is accepted: Shock
 * authorizes them against the user's own token, which the user could send to
 * Shock directly anyway, and the server's network reach does not grow (the
 * PUT still only goes to an allowed node URL, and redirects are refused).
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

    // Forwarded verbatim: its boundary is the one the body's bytes use.
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
    // Some proxies in front of Shock refuse a chunked upload; the browser
    // sends a length for a FormData body, and undici keeps it on a stream.
    const contentLength = request.headers.get("content-length");
    if (contentLength !== null && /^\d+$/.test(contentLength)) {
      headers["Content-Length"] = contentLength;
    }

    // No budget of our own: the file is sent before Shock can answer, and a
    // large one legitimately takes longer than any fixed budget. undici
    // bounds the connect (10 s) and, once the body is sent, the wait for an
    // answer (300 s).
    const init: RequestInit & { duplex: "half" } = {
      method: "PUT",
      headers,
      body: request.body,
      // Node's fetch requires this for a stream body.
      duplex: "half",
      // Never follow a redirect: it would send the request somewhere the
      // allowlist never checked. Node answers "manual" with the 3xx itself,
      // which is refused below. ("error" would also refuse it, but reports
      // it as "Could not reach …", although Shock answered.)
      redirect: "manual",
      signal: request.signal,
    };
    const response = await fetch(shockUrl, init);

    if (response.status >= 300 && response.status < 400) {
      // Its body is never read: release the connection. Not awaited, because
      // a cancel resolves only once every reader of a tee'd body has
      // cancelled, and an instrumented fetch (MSW, a tracing wrapper) may
      // hold the other branch, so awaiting it could hang the answer.
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
    // The browser cancelled the upload: nobody is left to read an answer, and
    // it is not a failure worth logging.
    if (request.signal.aborted) return new NextResponse(null, { status: 499 });
    console.error("Workspace upload proxy error:", error);
    return upstreamFailureResponse(error, upstreamServices.fileStorage);
  }
});
