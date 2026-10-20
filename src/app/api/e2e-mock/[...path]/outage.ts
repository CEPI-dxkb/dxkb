import { NextRequest, NextResponse } from "next/server";
import {
  maintenancePageHtml,
  outageRecordShape,
  outageServiceFor,
  parseOutageDirective,
  type OutageService,
  type OutageShape,
} from "@/lib/e2e-fixtures/outages";

/**
 * The outage half of the loopback mock: whether a request asked for its
 * backend to be down, and the answer a down backend gives. How a spec asks is
 * documented in `src/lib/e2e-fixtures/outages.ts`.
 *
 * Like `identity.ts`'s 401/404s, these answers are MODELLED responses that
 * specs assert on, not fixture gaps, so they do not carry the
 * `e2e-mock: ` rejection prefix. A malformed request for an outage is a gap,
 * and `route.ts` answers it through its own rejection helper.
 */

export type OutageMatch =
  | { kind: "outage"; service: OutageService; shape: OutageShape }
  | { kind: "invalid"; reason: string };

function decoded(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/**
 * The outage `request` asks for, or `null` for a healthy answer. A session
 * outage (the token's `e2e-outage=` field) applies to the services it names;
 * a record outage applies to a data request that names an outage record in
 * its path, query or `body`.
 */
export function matchOutage(
  path: string,
  request: NextRequest,
  body = "",
): OutageMatch | null {
  const service = outageServiceFor(path);
  const directive = parseOutageDirective(request.headers.get("authorization"));
  if (directive.kind === "invalid") return directive;
  if (!service) return null;
  const sessionShape =
    directive.kind === "outages" ? directive.outages[service] : undefined;
  if (sessionShape) return { kind: "outage", service, shape: sessionShape };
  if (service !== "data") return null;
  const recordShape = outageRecordShape(
    `${decoded(path)} ${decoded(new URL(request.url).search)} ${body}`,
  );
  return recordShape ? { kind: "outage", service, shape: recordShape } : null;
}

/**
 * Longer than any production budget (`upstreamTimeoutMs.minhash` is 60 s), so
 * the caller's budget always ends a hang first. Only a client that never
 * gives up reaches it, and then the request still ends.
 */
const maxHangMs = 75_000;

function untilAborted(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, maxHangMs);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

/** What a backend in `match`'s outage answers `request` with. */
export async function outageResponse(
  match: Extract<OutageMatch, { kind: "outage" }>,
  path: string,
  request: NextRequest,
): Promise<NextResponse> {
  console.log(
    `[api/e2e-mock] outage ${match.shape} (${match.service}) /${path}`,
  );
  if (match.shape === "hang") {
    await untilAborted(request.signal);
    // Read only by a client that waited out maxHangMs.
    return new NextResponse(null, {
      status: 504,
      statusText: "Gateway Timeout",
    });
  }
  return new NextResponse(maintenancePageHtml, {
    status: 503,
    statusText: "Service Unavailable",
    headers: { "Content-Type": "text/html" },
  });
}
