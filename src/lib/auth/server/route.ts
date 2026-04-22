import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import type { AuthUser, UserProfile } from "@/lib/auth/types";
import { getRequestScope, withRequestScope } from "./request-scope";
import { errorResponse } from "./errors";
import { hasSession as hasSessionFromRequest } from "./middleware";
import type {
  IdentityProviderPort,
  SessionIdentity,
  SessionStoragePort,
} from "./ports";

export interface Session {
  token: string;
  userId: string;
  realm?: string;
}

export type AuthRouteHandler<TCtx = object> = (
  req: NextRequest,
  ctx: TCtx & Session,
) => Promise<NextResponse>;

export interface AuthHelpers {
  route<TCtx = object>(
    handler: AuthRouteHandler<TCtx>,
  ): (req: NextRequest, ctx: TCtx) => Promise<NextResponse>;

  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;

  hasSession(req: NextRequest): boolean;

  requireSession(): Promise<Session>;

  currentUser(): Promise<AuthUser | null>;

  requireUser(redirectTo?: string): Promise<AuthUser>;
}

export interface CreateAuthHelpersOptions {
  identity: IdentityProviderPort;
  session: SessionStoragePort;
}

function unauthenticatedResponse(): NextResponse {
  return NextResponse.json(
    { error: "Authentication required", code: "unauthenticated" },
    { status: 401 },
  );
}

function hydrateUser(
  session: SessionIdentity,
  profile: UserProfile,
  backupUserId: string | undefined,
): AuthUser {
  return {
    id: profile.id || session.userId,
    username: session.userId,
    email: profile.email || "",
    first_name: profile.first_name || "",
    last_name: profile.last_name || "",
    email_verified: profile.email_verified || false,
    realm: session.realm,
    roles: profile.roles,
    token: "",
    ...(backupUserId
      ? { isImpersonating: true, originalUsername: backupUserId }
      : {}),
  };
}

export function createAuthHelpers(
  options: CreateAuthHelpersOptions,
): AuthHelpers {
  const { identity, session: sessionPort } = options;

  function readSessionCached(): Promise<SessionIdentity | null> {
    const scope = getRequestScope();
    if (scope?.sessionPromise) return scope.sessionPromise;
    const promise = sessionPort.read();
    if (scope) scope.sessionPromise = promise;
    return promise;
  }

  function readUserCached(): Promise<AuthUser | null> {
    const scope = getRequestScope();
    if (scope?.userPromise) return scope.userPromise;

    const promise = (async (): Promise<AuthUser | null> => {
      const session = await readSessionCached();
      if (!session) return null;
      const validation = await identity.validateToken(
        session.userId,
        session.token,
      );
      if (validation.error) return null;
      const backup = await sessionPort.readBackup();
      return hydrateUser(session, validation.data, backup?.userId);
    })();

    if (scope) scope.userPromise = promise;
    return promise;
  }

  async function requireSessionInner(): Promise<SessionIdentity> {
    const session = await readSessionCached();
    if (!session) {
      throw unauthenticatedResponse();
    }
    return session;
  }

  async function requireSession(): Promise<Session> {
    return withRequestScope(async () => {
      const session = await requireSessionInner();
      return {
        token: session.token,
        userId: session.userId,
        realm: session.realm,
      };
    });
  }

  async function fetchAuthed(
    input: RequestInfo | URL,
    init: RequestInit = {},
  ): Promise<Response> {
    const runFetch = async () => {
      const session = await requireSessionInner();
      const headers = new Headers(init.headers);
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      headers.set("Authorization", session.token);
      const response = await fetch(input, { ...init, headers });
      if (response.status === 401) {
        await sessionPort.clear();
      }
      return response;
    };

    if (getRequestScope()) return runFetch();
    return withRequestScope(runFetch);
  }

  function hasSession(req: NextRequest): boolean {
    return hasSessionFromRequest(req);
  }

  function route<TCtx = object>(
    handler: AuthRouteHandler<TCtx>,
  ): (req: NextRequest, ctx: TCtx) => Promise<NextResponse> {
    return (req: NextRequest, ctx: TCtx) =>
      withRequestScope(async (scope) => {
        try {
          const session = await readSessionCached();
          if (!session) return unauthenticatedResponse();
          scope.sessionPromise = Promise.resolve(session);
          return await handler(req, {
            ...ctx,
            token: session.token,
            userId: session.userId,
            realm: session.realm,
          });
        } catch (error) {
          if (error instanceof Response) return error as NextResponse;
          console.error("Route handler error:", error);
          return errorResponse(error);
        }
      });
  }

  async function currentUser(): Promise<AuthUser | null> {
    if (getRequestScope()) return readUserCached();
    return withRequestScope(() => readUserCached());
  }

  async function requireUser(redirectTo?: string): Promise<AuthUser> {
    const user = await currentUser();
    if (!user) redirect(redirectTo ?? "/sign-in");
    return user;
  }

  return {
    route,
    fetch: fetchAuthed,
    hasSession,
    requireSession,
    currentUser,
    requireUser,
  };
}
