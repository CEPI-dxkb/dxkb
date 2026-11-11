import "server-only";

import type { ServerDataRepository } from "./repository";
import {
  resolveServerDataRepository,
  type DataApiReadScope,
} from "./server-policy";

/**
 * `readScope` is required so a collection-backed caller cannot silently inherit
 * the member cache.
 * A missing base URL throws `DataApiError("DATA_API_URL is not configured.",
 * 500, "not_configured")`; the message names the env var because Next redacts
 * it in production.
 * `anonymous` builds a repository without the visitor's token, for a read
 * shared across visitors, and `bypassDataCache` skips Next's data cache for a
 * caller that caches the result itself; see `resolveServerDataRepository`.
 * Not wrapped in React `cache()`, which would share one repository across
 * callers in a render pass.
 */
export async function createServerDataRepository(options: {
  readScope: DataApiReadScope;
  anonymous?: true;
  bypassDataCache?: true;
  fetch?: typeof fetch;
}): Promise<ServerDataRepository> {
  const { repository } = await resolveServerDataRepository({
    readScope: options.readScope,
    notConfigured: { message: "DATA_API_URL is not configured." },
    anonymous: options.anonymous,
    bypassDataCache: options.bypassDataCache,
    fetch: options.fetch,
  });
  return repository;
}
