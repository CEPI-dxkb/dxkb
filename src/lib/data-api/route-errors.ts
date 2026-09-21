import { NextResponse } from "next/server";
import { DataApiError } from "./repository";
import { DataApiValidationError } from "./resources";

/**
 * Client-facing text for a deployment with no Data API base URL. Stable and
 * distinct from the catch-all's "The data service request failed." so the two
 * failures stay tellable apart, without echoing a server env var name to
 * unauthenticated callers. Shared by every Data API route so that one
 * misconfiguration reads the same to a client no matter which route it hit;
 * the operator-facing `console.error` stays per-route, because only the route
 * knows which of them is unconfigured.
 */
export const dataApiNotConfiguredMessage =
  "The data service is not configured for this deployment.";

/**
 * Maps a thrown Data API failure onto the `{error, code}` response contract
 * every Data API route answers with. Shared by `/api/data/[resource]` and
 * `/api/taxonomy-tree/[operation]` so the two cannot drift on status or code
 * for the same failure.
 *
 * A validation error keeps its own status (400 by default) and message; a
 * `DataApiError` keeps the status and `code` it was constructed with, so a
 * specific upstream or malformed-response detail reaches the caller instead of
 * being replaced by a generic string. Only a genuinely unexpected throw —
 * which carries no vetted client-facing message — falls through to the
 * generic 500.
 */
export function dataApiErrorResponse(error: unknown): NextResponse {
  if (error instanceof DataApiValidationError) {
    return NextResponse.json(
      { error: error.message, code: "invalid_request" },
      { status: error.status },
    );
  }
  if (error instanceof DataApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  // Matched on `name` rather than `instanceof DOMException`: the runtime's
  // fetch does not always raise an instance of the *same* `DOMException`
  // constructor the caller can see (under jsdom, Node's and jsdom's are two
  // different globals), which left this branch unreachable in tests. Widening
  // it only reclassifies a genuine abort that previously fell through to the
  // generic 500 below.
  if (error instanceof Error && error.name === "AbortError") {
    return NextResponse.json(
      { error: "Data request was aborted.", code: "aborted" },
      { status: 499 },
    );
  }
  console.error("Data API route failed:", error);
  return NextResponse.json(
    { error: "The data service request failed.", code: "internal_error" },
    { status: 500 },
  );
}
