import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { statusToErrorCode } from "@/lib/api/types";
import {
  declaresOversizedBody,
  oversizedBodyResponse,
  readCappedBody,
} from "@/lib/data-api/route-guards";
import {
  CopilotConfigurationError,
  CopilotRejectedError,
} from "@/lib/copilot/server";
import type { CopilotErrorBody } from "@/lib/copilot/types";

/**
 * The answer for the Copilot errors a route owns, or null for any other error,
 * which the route rethrows for `withAuth` to answer (upstream failures become
 * their 502/503/504 there).
 *
 * - A missing `COPILOT_API_URL`: the variable's name goes to the server log,
 *   the client gets the user-facing reason.
 * - A gateway rejection: its status and message, with its own code as
 *   `copilotCode` for the client to act on.
 */
export function copilotErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof CopilotConfigurationError) {
    console.error(error.message);
    return NextResponse.json<CopilotErrorBody>(
      { error: error.userMessage, code: "unknown" },
      { status: 500 },
    );
  }
  if (error instanceof CopilotRejectedError) {
    return NextResponse.json<CopilotErrorBody>(
      {
        error: error.message,
        code: statusToErrorCode(error.status),
        ...(error.copilotCode ? { copilotCode: error.copilotCode } : {}),
      },
      { status: error.status },
    );
  }
  return null;
}

/** 400 for a malformed request, in the routes' `{error, code}` shape. */
export function copilotBadRequest(message: string): NextResponse {
  return NextResponse.json<CopilotErrorBody>(
    { error: message, code: "validation" },
    { status: 400 },
  );
}

/**
 * The request's JSON body, read up to `maxBytes`, or the error response to
 * return: the 413 for an oversized body (declared or streamed), a 400
 * "Malformed JSON" for one that does not parse.
 */
export async function readCopilotJsonBody(
  request: NextRequest,
  maxBytes: number,
): Promise<{ value: unknown } | { error: NextResponse }> {
  if (declaresOversizedBody(request, maxBytes)) {
    return { error: oversizedBodyResponse() };
  }
  const text = await readCappedBody(request, maxBytes);
  if (text === null) return { error: oversizedBodyResponse() };
  try {
    return { value: JSON.parse(text) as unknown };
  } catch {
    return { error: copilotBadRequest("Malformed JSON") };
  }
}

export const copilotNoStore = { "Cache-Control": "private, no-store" } as const;

/**
 * Runs a route body, answering the Copilot errors it owns
 * (`copilotErrorResponse`) and rethrowing the rest for `withAuth`.
 */
export async function answerCopilot(
  run: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await run();
  } catch (error) {
    const response = copilotErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
