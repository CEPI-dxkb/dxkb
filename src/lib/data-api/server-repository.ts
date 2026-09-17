import "server-only";

import type { ServerDataRepository } from "./repository";
import {
  resolveServerDataRepository,
  type DataApiReadScope,
} from "./server-policy";

/**
 * Builds the `ServerDataRepository` used by every entity-view server module
 * (`src/lib/*-view/server.ts`).
 *
 * Auth, `DATA_API_URL`/`NEXT_PUBLIC_DATA_API` resolution, and cache policy all
 * live in `resolveServerDataRepository` (`./server-policy.ts`), shared with the
 * Data API gateway and the Taxa Tree route so the three cannot disagree. This
 * factory adds exactly one thing: the client-facing wording for a missing base
 * URL. Entity lookup, alternate IDs, compound resolution, parsing, and error
 * semantics stay in the calling module.
 *
 * `readScope` is required rather than defaulted because the two scopes now get
 * different cache treatment and the difference is invisible at the call site:
 * a member lookup (`genome`, `feature`, `epitope`, `experiment`,
 * `protein-structure`) is cacheable while anonymous, and a `collection`-backed
 * compound lookup (`surveillance`, `serology`) is not. A default would have let
 * a future collection caller silently inherit the member cache.
 *
 * Throws `DataApiError("DATA_API_URL is not configured.", 500,
 * "not_configured")` when neither env var is set. The message names the env var
 * on purpose — unlike the sanitized text the same-origin routes answer with,
 * nothing returns this string to an arbitrary caller. The five member modules
 * let it propagate (Next redacts the message in production while still logging
 * it server-side); `protein-structure-view/server.ts` narrows on
 * `error instanceof DataApiError && error.code === "not_configured"`, maps it to
 * a per-accession message that does not name the variable, logs the original
 * detail, and rethrows anything else.
 *
 * Deliberately not wrapped in React `cache()` — memoizing this factory would
 * memoize the repository across every caller in one render pass, which the plan
 * it implements forbids. Callers that want request-level memoization of their
 * own lookup (most `*-view/server.ts` modules do) wrap their own exported
 * function in `cache()`, keyed on their own arguments.
 * `protein-structure-view/server.ts` takes an array of accessions and does not
 * memoize at all, since memoizing on an array identity would not mean what
 * memoizing on a scalar ID means.
 *
 * `fetch` exists solely so tests can inject a fetch spy the same way
 * `ServerDataRepository`'s own tests do — it is never set in production.
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
