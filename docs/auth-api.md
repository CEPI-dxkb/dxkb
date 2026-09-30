# Auth API Contract

This document defines the wire contract for all `/api/auth/*` routes. Every new auth endpoint must follow these rules. Consolidated under [DXKBCORE-153].

---

## Error envelope

Every `/api/auth/*` route returns exactly one error shape:

```json
{ "error": "<message>", "code": "<ApiErrorCode>" }
```

HTTP status is canonical. `code` is a machine-readable category. This matches the project-wide `{error, code, details?}` shape used by `errorResponse` on non-auth routes. Auth routes omit `details` because `Result.error` has no upstream data field.

---

## Success envelopes

Auth routes have two success envelope families:

| Family               | Success body      | Routes                                                                                        |
| -------------------- | ----------------- | --------------------------------------------------------------------------------------------- |
| **Session mutation** | `{user, session}` | sign-in, sign-up, su-login, su-exit                                                           |
| **Ack**              | `{success: true}` | forget-password, send-verification-email, verify-email-token, change-password, profile (POST) |

Session mutation responses redact the token as `session.token: ""` and expose the exact cookie expiry as the ISO `session.expiresAt` field. Browser `AuthUser` objects never contain a token.

Current identity is not an HTTP endpoint. Server Components call `getCurrentUser()` from `src/lib/auth/server/actions.ts`; protected route handlers use `withAuth()` or `readAuthSession()` from `src/lib/auth/server/route.ts`. Sign-out submits to the redirecting `signOutAndRedirect` Server Action, which clears cookies before redirecting.

Two routes are documented exceptions (see [Exceptions](#exceptions) below).

---

## Status-code mapping

All status mapping flows through `statusFor()` in `src/lib/auth/server/errors.ts`:

| Error code                            | HTTP status       |
| ------------------------------------- | ----------------- |
| `invalid_credentials`, `unauthorized` | 401               |
| `forbidden`                           | 403               |
| `not_found`                           | 404               |
| `conflict`                            | 409               |
| `rate_limited`                        | 429               |
| `validation`                          | 400               |
| `service_unavailable`                 | 503               |
| `network`                             | **502** (not 503) |
| anything else                         | 500               |

`code` in the error body is derived from the HTTP status via `statusToErrorCode()` in `src/lib/api/types.ts`:

| HTTP status | `code`            |
| ----------- | ----------------- |
| 401         | `unauthenticated` |
| 403         | `forbidden`       |
| 404         | `not_found`       |
| 4xx         | `validation`      |
| 5xx         | `upstream`        |

---

## Endpoint table

| Method | Path                                | Envelope    | Request body                     | Success body                         | Auth required |
| ------ | ----------------------------------- | ----------- | -------------------------------- | ------------------------------------ | ------------- |
| POST   | `/api/auth/sign-in/email`           | Session     | `{username, password}`           | `{user, session}`                    | No            |
| POST   | `/api/auth/sign-up/email`           | Session     | `SignupCredentials`              | `{user, session}`                    | No            |
| POST   | `/api/auth/forget-password`         | Ack         | `{usernameOrEmail}`              | `{success: true}`                    | No            |
| POST   | `/api/auth/send-verification-email` | Ack         | —                                | `{success: true}`                    | Yes (cookie)  |
| GET    | `/api/auth/verify-email-token`      | Ack         | `?token=&username=`              | `{success: true}`                    | No            |
| POST   | `/api/auth/change-password`         | Ack         | `{currentPassword, newPassword}` | `{success: true}`                    | Yes (cookie)  |
| GET    | `/api/auth/profile`                 | Passthrough | —                                | upstream profile JSON                | Yes (cookie)  |
| POST   | `/api/auth/profile`                 | Ack         | JSON Patch array                 | `{success: true}`                    | Yes (cookie)  |
| POST   | `/api/auth/su-login`                | Session     | `{targetUser, password}`         | `{user, session}`                    | Yes (cookie)  |
| POST   | `/api/auth/su-exit`                 | Session     | —                                | `{user, session}`                    | Yes (cookie)  |
| POST   | `/api/auth/ensure-workspace`        | Exception   | —                                | `{success: true, created, failures}` | Yes (cookie)  |

**`POST /api/auth/profile` notes:** A `/settings` patch never replaces the stored settings object: the route reads the profile first (returning that read's error unchanged if it fails) and, when the stored settings are an object, sends one `add /settings/<key>` per changed key, so the profile service applies the change to the copy it holds at write time and keys other clients store, or change after the read, are kept. The service cannot patch inside settings that are missing or not an object, so then the whole object is written (`add` when missing, `replace` otherwise); a settings object another client creates between the read and that first write is overwritten.

---

## Nine rules

1. **Every auth route calls a named operation from `src/lib/auth/server/actions.ts` or explicitly proxies an upstream response.**
   Orchestration belongs in the named server action, while route files stay thin and searchable.

2. **The four helpers in `src/lib/auth/server/respond.ts` are the only path to a response.**
   `respondWithSessionMutation` adapts session-changing action results, `respondWithSession` returns a user or empty session, and `respondWithAck` returns no payload. `respondWithUpstreamFailure` returns the error envelope for a failed upstream call a route makes with the session token itself instead of through a named action (the `/api/auth/profile` proxy); an `unauthorized` failure clears the session and sets `code: "session_expired"`. Adding another helper requires updating this document.

3. **Validation lives in the named server action, not the route.**
   Actions return a typed `Result` for invalid input. Routes use the shared JSON parser and do not re-check, re-message, or re-map action errors.

4. **All status-code mapping flows through `statusFor()`.**
   Routes do not map error codes to status codes themselves. New error codes go in `AuthErrorCode` + `statusFor()`.

5. **One error envelope on auth routes.**
   `{error, code}` with HTTP status from `statusFor()`. No route emits `{message}` as the error field.

6. **No route emits `success: false`. No route emits a non-empty success message string in the body.**
   HTTP status carries success/failure. The browser caller branches on `response.ok`.

7. **No route catches an error and re-throws it as a different error.**
   Either let the throw propagate (the wrapper formats it) or convert it to a `Result.error` in the named server action.

8. **Tests assert on `response.status` and the typed body shape, not on string contents of success messages.**

9. **Adding a new auth endpoint follows this checklist:**
   - Add a named operation to `src/lib/auth/server/actions.ts` and, when needed, a named BV-BRC protocol function in `server/adapters/bvbrc-identity.ts`.
   - Add the route file: parse input, call the named operation, and use the shared response helper.
   - Add focused action/protocol tests and a thin route test.
   - If browser-callable, add a concrete function to `src/lib/auth/client.ts` and expose it through `useAuthActions()` when UI consumers need it.
   - Update this document's endpoint table.

---

## Exceptions

Two routes don't fit the ack/session pattern cleanly, but both share the `{error, code}` error envelope:

- **`GET /api/auth/profile`** — Returns upstream profile JSON unchanged on success (not `{success: true}`). Useful because callers need the profile fields directly.
- **`POST /api/auth/ensure-workspace`** — Returns `{success: true, created, failures}` because the caller needs the failure list for logging. Uses `withAuth()` and lets the wrapper handle errors via `errorResponse`.

New exceptions require adding a row to this section.

---

## Adding a new endpoint

```ts
// src/lib/auth/server/actions.ts
export async function myAction(arg: string): Promise<Result<void>> {
  if (!arg) return fail("validation", "arg is required", 400);
  return runIdentityOperation(arg);
}

// src/app/api/auth/my-action/route.ts
import { myAction } from "@/lib/auth/server/actions";
import { respondWithAck } from "@/lib/auth/server/respond";
import { parseJsonBody, withErrorHandling } from "@/lib/auth/server/errors";

export const POST = withErrorHandling(async (request: NextRequest) => {
  const body = await parseJsonBody<{ arg?: string }>(request);
  return respondWithAck(await myAction(body.arg ?? ""));
});
```

---

## What this consolidation prevents

Before DXKBCORE-153, the auth surface had four different response envelope shapes and three different error shapes. Key problems:

1. **Unknowable contract**: Every auth route had its own implicit error shape. Shared error handling required reading each route's source.
2. **Status-code disagreements**: `forget-password` mapped `network` errors to 503; `errors.ts` mapped the same code to 502. One failure mode appeared as two different signals.
3. **Split error envelopes**: The `profile` route could emit either `{message}` (handler-controlled) or `{error, code, details}` (uncaught-throw path), forcing clients to check both fields.

After DXKBCORE-153: every `/api/auth/*` route emits `{error, code}` on failure — the same shape the rest of the project already uses.
