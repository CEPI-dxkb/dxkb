import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { SessionIdentity } from "@/lib/auth/types";
import { encodeQueryComponent } from "@/lib/url";
import { errorResponse } from "./errors";
import { readSession } from "./session";

export type AuthRouteHandler<TCtx = object> = (
  request: NextRequest,
  context: TCtx & SessionIdentity,
) => Promise<NextResponse>;

function sessionExpiredResponse(): NextResponse {
  return NextResponse.json(
    { error: "Authentication required", code: "session_expired" },
    { status: 401 },
  );
}

export async function readAuthSession(): Promise<SessionIdentity | null> {
  return readSession();
}

export async function requireAuthSession(): Promise<SessionIdentity> {
  const session = await readSession();
  if (!session) throw new Error("Authentication required");
  return session;
}

export async function requireAuthSessionOrRedirect(
  redirectTo: string,
): Promise<SessionIdentity> {
  const session = await readSession();
  if (!session) redirect(`/sign-in?redirect=${encodeQueryComponent(redirectTo)}`);
  return session;
}

export function withAuth<TCtx = object>(
  handler: AuthRouteHandler<TCtx>,
): (request: NextRequest, context: TCtx) => Promise<NextResponse> {
  return async (request, context) => {
    const session = await readSession();
    if (!session) return sessionExpiredResponse();
    try {
      return await handler(request, { ...context, ...session });
    } catch (error) {
      if (error instanceof Response) return error as NextResponse;
      console.error("Route handler error:", error);
      return errorResponse(error);
    }
  };
}
