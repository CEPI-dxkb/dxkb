import { NextResponse } from "next/server";

import { statusToErrorCode } from "./types";
import { describeUpstreamFailure } from "./upstream-failure";

/**
 * The `{error, code}` answer for a proxy route's catch-all. An upstream
 * network failure or spent budget (`UpstreamError` from `fetchUpstream`, or a
 * raw undici error) answers its 502/503/504 with the cause, so the client can
 * say which service is down and skip its automatic retry. Anything else is
 * not an upstream failure and keeps the route's generic 500: its message can
 * carry server configuration (a missing env var name) that a client must not
 * see.
 */
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
