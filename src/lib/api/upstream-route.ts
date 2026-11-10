import { NextResponse } from "next/server";

import { statusToErrorCode } from "./types";
import { describeUpstreamFailure } from "./upstream-failure";

/** The `{error, code}` answer for a proxy route's catch-all. An upstream failure keeps its 502/503/504 with the cause; anything else keeps a generic 500 because its message can carry server configuration. */
export function upstreamFailureResponse(
  error: unknown,
  service: string,
): NextResponse {
  const failure = describeUpstreamFailure(error, service);
  if (failure) {
    return NextResponse.json(
      { error: failure.message, code: statusToErrorCode(failure.status) },
      { status: failure.status },
    );
  }
  return NextResponse.json(
    { error: "Internal server error", code: "unknown" },
    { status: 500 },
  );
}
