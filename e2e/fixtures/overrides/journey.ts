import type { JsonOverride } from "../../mocks/backends";
import { authSessionOverrides } from "./auth-session";
import { workspaceOverrides } from "./workspace";
import { jobsOverrides } from "./jobs";

/**
 * Explicit override bundle for end-to-end journey specs. Contains the same
 * authoritative session, workspace, and jobs mocks that journey tests need —
 * but intentionally OMITS any named resource scenario bundle or broad
 * aggregate. New backend traffic surfaced by a code change must show up as a
 * strict-mode failure here so the spec can declare it explicitly, not be
 * silently swallowed by a `{}`/`{result: [[]]}` catch-all.
 *
 * Use:
 *   - view/journey/smoke/visual specs    → import the specific named
 *     scenario bundle(s) the page under test exercises (e.g.
 *     `epitopeScenarioOverrides`), plus `emptyBackendFallbackOverrides` for
 *     everything else
 *   - accessibility sweep
 *     (e2e/tests/a11y/**)                → use `a11yBackendOverrides` (the
 *     one broad, unscoped aggregate — every other spec has been converted
 *     off it)
 *   - journey specs (auth, workspace,
 *     jobs, services deep-submit)        → use `journeyOverrides`
 */
export const journeyOverrides: JsonOverride[] = [
  ...authSessionOverrides,
  ...workspaceOverrides,
  ...jobsOverrides,
];
