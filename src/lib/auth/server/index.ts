import { createAuth } from "./create";
import { bvbrcIdentity } from "./adapters/bvbrc-identity";
import { cookieSession } from "./adapters/cookie-session";

const authority = createAuth({
  identity: bvbrcIdentity(),
  session: cookieSession(),
});

export const auth = authority.auth;
export const authAdmin = authority.authAdmin;

/** Alias for `auth.route` — migrated from the legacy `@/lib/api/server.withAuth`. */
export const withAuth = authority.auth.route;

export { createAuth } from "./create";
export type { Authority, CreateAuthPorts } from "./create";
export type { AuthAdmin } from "./admin";
export type { AuthHelpers, AuthRouteHandler, Session } from "./route";

export { respondWithSession, respondWithAck } from "./respond";
export {
  AuthError,
  errorResponse,
  statusFor,
  toResponse,
  withErrorHandling,
} from "./errors";
export type { AuthErrorInit } from "./errors";
export { hasSession } from "./middleware";
export { buildEnvelope, sessionMaxAgeMs } from "./envelope";
export type { SessionEnvelope } from "./envelope";
export { extractRealmFromToken } from "./token";

export {
  sessionCookieNames,
  suBackupCookieNames,
  cookieSession,
} from "./adapters/cookie-session";
export { bvbrcIdentity } from "./adapters/bvbrc-identity";
export {
  inMemoryIdentity,
  inMemorySession,
} from "./adapters/memory";
export type {
  InMemoryAccount,
  InMemoryIdentityAdapter,
  InMemoryIdentityOptions,
  InMemorySessionAdapter,
  InMemorySessionOptions,
} from "./adapters/memory";

export type {
  IdentityProviderPort,
  SessionStoragePort,
  SessionIdentity,
} from "./ports";
export { getRequestScope, withRequestScope } from "./request-scope";
export type { RequestScope } from "./request-scope";
