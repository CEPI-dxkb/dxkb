import { NextRequest, NextResponse } from "next/server";
import {
  maintenancePageHtml,
  outageRecordShape,
  outageServiceFor,
  parseOutageDirective,
  type OutageService,
  type OutageShape,
} from "@/lib/e2e-fixtures/outages";

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

// Longer than any production budget so the caller's budget always ends a hang first.
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
