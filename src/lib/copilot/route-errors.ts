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

/** Null for any other error, which the route rethrows for `withAuth` to answer. */
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

export function copilotBadRequest(message: string): NextResponse {
  return NextResponse.json<CopilotErrorBody>(
    { error: message, code: "validation" },
    { status: 400 },
  );
}

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
