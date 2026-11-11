import { NextResponse } from "next/server";
import { DataApiError } from "./repository";
import { DataApiValidationError } from "./resources";

/**
 * Distinct from the catch-all's "The data service request failed.", and does
 * not echo a server env var name to unauthenticated callers.
 */
export const dataApiNotConfiguredMessage =
  "The data service is not configured for this deployment.";

/**
 * A validation error keeps its status and message and a `DataApiError` its
 * status and `code`; only a genuinely unexpected throw falls through to the
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
  // Matched on `name` because under jsdom the runtime's `DOMException` is not
  // the constructor the caller sees.
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
