import "server-only";

import { readSession } from "@/lib/auth/server/session";
import { DataApiError, ServerDataRepository } from "./repository";
import type { DataApiRequest } from "./types";

/**
 * One constant so the upstream `next.revalidate` window and the gateway's
 * `s-maxage` cannot drift apart.
 */
export const anonymousMemberRevalidateSeconds = 300;

/**
 * `member` is one row by one identifier (high hit rate, cacheable); `query` is
 * everything else, whose near-unique URLs would only fill the data cache, so it
 * is never cached.
 */
export type DataApiReadScope = "member" | "query";

export function readScopeForOperation(
  operation: DataApiRequest["operation"],
): DataApiReadScope {
  return operation === "member" ? "member" : "query";
}

/**
 * `message` is client-facing, so same-origin routes must not name a server env
 * var in it; `log` is operator-facing and optional.
 */
export interface DataApiNotConfiguredPolicy {
  message: string;
  log?: string;
}

export interface ResolveServerDataRepositoryOptions {
  readScope: DataApiReadScope;
  notConfigured: DataApiNotConfiguredPolicy;
  /** Test seam only: lets a test spy on the `cache`/`next.revalidate` init. */
  fetch?: typeof fetch;
}

export interface ResolvedServerDataRepository {
  repository: ServerDataRepository;
  /**
   * A flag rather than a header string: `Cache-Control` and `Vary` are the
   * route's contract with its clients.
   */
  sharedCache: boolean;
}

/**
 * Single place for Data API auth, configuration and cache policy: members only,
 * never in an E2E run, with the base-URL check before `readSession()`.
 * The `DataApiError(…, 500, "not_configured")` code is a contract:
 * `protein-structure-view/server.ts` narrows on it.
 * Deliberately not wrapped in React `cache()`, which would share one repository
 * across callers in a render pass.
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
  // Authenticated responses are per-user, E2E ones per-run, and `query` reads
  // near-unique, so none may be shared.
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
