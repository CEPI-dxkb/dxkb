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
 * Not wrapped in React `cache()`, which would share one repository across
 * callers in a render pass.
 */
export async function createServerDataRepository(options: {
  readScope: DataApiReadScope;
  fetch?: typeof fetch;
}): Promise<ServerDataRepository> {
  const { repository } = await resolveServerDataRepository({
    readScope: options.readScope,
    notConfigured: { message: "DATA_API_URL is not configured." },
    fetch: options.fetch,
  });
  return repository;
}
