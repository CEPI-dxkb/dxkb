import "server-only";

import { readSession } from "@/lib/auth/server/session";
import { DataApiError, ServerDataRepository } from "./repository";
import type { DataApiRequest } from "./types";

/**
 * Seconds an anonymous member response stays cacheable. One constant so the
 * upstream `next.revalidate` window and the Data API gateway's `s-maxage`
 * cannot drift apart — they described the same 300 seconds from two separate
 * literals before this module existed.
 */
export const anonymousMemberRevalidateSeconds = 300;

/**
 * Which key space a read draws from. Together with "is this caller
 * anonymous", this is the whole input to the cache decision.
 *
 * - `"member"` — one row addressed by one identifier. The key space is bounded
 *   by the number of entities that exist, so the hit rate is high and caching
 *   pays for itself.
 * - `"query"` — everything else: a collection (filters, sort, page, keyword),
 *   an explicit id list, an export window, or a ranged read. Those URLs are
 *   near-unique per caller, so `force-cache` would fill Next's data cache with
 *   entries nothing reads a second time. Never cached, for anyone.
 */
export type DataApiReadScope = "member" | "query";

/**
 * The read scope of a gateway operation. `member` is the only cacheable one;
 * `collection`, `selected`, and `export` all carry caller-specific predicates
 * and so share the uncacheable `"query"` scope.
 */
export function readScopeForOperation(
  operation: DataApiRequest["operation"],
): DataApiReadScope {
  return operation === "member" ? "member" : "query";
}

/**
 * How one caller wants a missing Data API base URL reported.
 *
 * The two shapes differ on purpose and both predate this module:
 *
 * - `message` is client-facing. The same-origin routes pass
 *   `dataApiNotConfiguredMessage`, which is readable by any caller, signed in
 *   or not, and so must not name a server environment variable.
 *   `createServerDataRepository` passes `"DATA_API_URL is not configured."`,
 *   because its callers either let Next redact the message in production or
 *   (as `protein-structure-view/server.ts` does) catch the error, log that
 *   detail, and substitute their own client-facing text.
 * - `log` is operator-facing and optional. Only a caller knows *which* of the
 *   several Data API entry points is unconfigured, so the wording stays with
 *   the caller; the factory omits it because its own callers do the logging.
 *
 * Passed as data rather than a callback so the sequence that actually matters
 * — log, then throw, both before any session lookup — lives in exactly one
 * place. That block used to be copied verbatim between the two routes, which
 * is where a drift in status or code would have started.
 */
export interface DataApiNotConfiguredPolicy {
  /** Client-facing message for the thrown `DataApiError`. */
  message: string;
  /** Operator-facing line logged before throwing. Omit to log nothing. */
  log?: string;
}

export interface ResolveServerDataRepositoryOptions {
  readScope: DataApiReadScope;
  notConfigured: DataApiNotConfiguredPolicy;
  /**
   * Test seam only, never set in production: lets a test inject a fetch spy
   * the way `ServerDataRepository`'s own tests do, which is the only way to
   * observe the `cache`/`next.revalidate` init this module decides.
   */
  fetch?: typeof fetch;
}

export interface ResolvedServerDataRepository {
  repository: ServerDataRepository;
  /**
   * Whether this request's response may be held in a shared cache. True only
   * for an anonymous, non-E2E `"member"` read. Callers that answer an HTTP
   * request turn this into their own `Cache-Control`; it is deliberately a
   * flag rather than a header string, because the header (and `Vary`) is the
   * route's contract with its clients, not this module's.
   */
  sharedCache: boolean;
}

/**
 * The one place the Data API's server-side auth, configuration, and cache
 * policy is decided. Shared by all three server entry points that need a
 * `ServerDataRepository`:
 *
 * - `createServerDataRepository` (`./server-repository.ts`), the factory every
 *   `src/lib/*-view/server.ts` entity lookup builds on;
 * - the Data API gateway, `src/app/api/data/[resource]/route.ts`;
 * - the Taxa Tree route, `src/app/api/taxonomy-tree/[operation]/route.ts`.
 *
 * Before this existed, the gateway reimplemented the factory's session lookup,
 * env resolution, missing-configuration handling, repository construction, and
 * cache policy — and the two disagreed on two axes. The factory cached
 * anonymous *collections* for 300s while the gateway cached only members, and
 * the factory bypassed cache for E2E runs while the gateway ignored
 * `E2E_MOCK_ENABLED` entirely. Both are settled here: **members only, and an
 * E2E run never caches.**
 *
 * What stays with the caller: its client-facing and operator-facing wording
 * for a missing base URL (see {@link DataApiNotConfiguredPolicy}), its
 * response headers, its sanitization, and every entity concern — lookup,
 * alternate IDs, compound resolution, parsing, and error semantics.
 *
 * The base-URL check runs before `readSession()` so a genuine configuration
 * failure never depends on a session lookup succeeding first.
 *
 * The thrown error is always `DataApiError(…, 500, "not_configured")`. That
 * status and code are a contract: `protein-structure-view/server.ts` narrows
 * on `error instanceof DataApiError && error.code === "not_configured"` to
 * tell a deployment problem apart from a `readSession()`/`cookies()` failure,
 * which must propagate untouched.
 *
 * Deliberately not wrapped in React `cache()`, and neither is
 * `createServerDataRepository`: memoizing repository construction would share
 * one repository across every caller in a single render pass. Callers that
 * want request-level memoization wrap their own exported lookup instead.
 */
export async function resolveServerDataRepository({
  readScope,
  notConfigured,
  fetch: fetchOverride,
}: ResolveServerDataRepositoryOptions): Promise<ResolvedServerDataRepository> {
  const baseUrl = [
    process.env.DATA_API_URL,
    process.env.NEXT_PUBLIC_DATA_API,
  ].find((value): value is string => Boolean(value?.trim()))?.trim();
  if (!baseUrl) {
    if (notConfigured.log) console.error(notConfigured.log);
    throw new DataApiError(notConfigured.message, 500, "not_configured");
  }
  const session = await readSession();
  // An authenticated response is per-user and an E2E response is per-run, so
  // neither may be shared. A `"query"` read is never shared regardless: its
  // key carries filters, sort, page, and keyword, so the entries would be
  // near-unique and the hit rate near zero.
  const sharedCache =
    readScope === "member" &&
    !session &&
    process.env.E2E_MOCK_ENABLED !== "1";
  return {
    repository: new ServerDataRepository({
      baseUrl,
      token: session?.token,
      cache: sharedCache ? "force-cache" : "no-store",
      revalidate: sharedCache ? anonymousMemberRevalidateSeconds : undefined,
      fetch: fetchOverride,
    }),
    sharedCache,
  };
}
