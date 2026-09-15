import "server-only";

import { readSession } from "@/lib/auth/server/session";
import { DataApiError, ServerDataRepository } from "./repository";

/**
 * Seconds a public (anonymous, non-E2E) lookup is cached for. Paired 1:1 with
 * `cache: "force-cache"` below — never used with `"no-store"`.
 */
const anonymousCacheRevalidateSeconds = 300;

/**
 * Builds the `ServerDataRepository` shared by every entity-view server module
 * (`src/lib/*-view/server.ts`). This factory owns session lookup,
 * `DATA_API_URL`/`NEXT_PUBLIC_DATA_API` resolution, and cache policy only —
 * entity lookup, alternate IDs, compound resolution, parsing, and error
 * semantics stay in the calling module.
 *
 * Cache policy: an authenticated session or an E2E mock run bypasses caching
 * (`cache: "no-store"`, no revalidation, so per-user/per-run responses never
 * leak across requests); an anonymous, non-E2E request is cached for
 * `anonymousCacheRevalidateSeconds` (`cache: "force-cache"`).
 *
 * Deliberately not wrapped in React `cache()` here — memoizing this factory
 * would memoize the repository across every caller in a single render pass,
 * which the plan this factory implements explicitly forbids. Callers that
 * want request-level memoization of their own lookup (most `*-view/server.ts`
 * modules do) wrap their own exported function in `cache()`, keyed on their
 * own arguments. `protein-structure-view/server.ts` takes an array of
 * accessions and does not memoize at all — memoizing on an array identity
 * would not mean the same thing as memoizing on a scalar ID, so it calls this
 * factory once per `getProteinStructures` invocation instead.
 *
 * Throws `DataApiError("DATA_API_URL is not configured.", 500,
 * "not_configured")` when neither env var is set — the same status/code the
 * Phase 1 gateway route uses for the identical condition
 * (`src/app/api/data/[resource]/route.ts`), so callers can discriminate this
 * specific failure from anything else (a `readSession()`/`cookies()` failure,
 * for instance) with `error instanceof DataApiError && error.code ===
 * "not_configured"` instead of catching every error indiscriminately. Callers
 * decide how to surface that: the six member-lookup modules let it propagate
 * (Next redacts the message from the response in production while still
 * logging it server-side); `protein-structure-view` narrows on that specific
 * error, maps it to its own per-accession `error` field with a message that
 * does not name the environment variable, logs the original detail via
 * `console.error`, and rethrows anything else.
 *
 * The `baseUrl` check runs before `readSession()` so a genuine configuration
 * failure never depends on a session lookup succeeding first.
 *
 * `overrides.fetch` exists solely so tests can inject a fetch spy the same
 * way `ServerDataRepository`'s own tests do — it is never set in production
 * call sites.
 */
export async function createServerDataRepository(overrides: {
  fetch?: typeof fetch;
} = {}): Promise<ServerDataRepository> {
  const baseUrl = process.env.DATA_API_URL ?? process.env.NEXT_PUBLIC_DATA_API;
  if (!baseUrl)
    throw new DataApiError(
      "DATA_API_URL is not configured.",
      500,
      "not_configured",
    );
  const session = await readSession();
  const bypassCache = Boolean(session) || process.env.E2E_MOCK_ENABLED === "1";
  return new ServerDataRepository({
    baseUrl,
    token: session?.token,
    cache: bypassCache ? "no-store" : "force-cache",
    revalidate: bypassCache ? undefined : anonymousCacheRevalidateSeconds,
    ...overrides,
  });
}
