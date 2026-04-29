import type { JsonOverride } from "../../mocks/backends";
import { authSessionOverrides } from "./auth-session";
import { workspaceOverrides } from "./workspace";
import { jobsOverrides } from "./jobs";

/**
 * Explicit override bundle for end-to-end journey specs. Contains the same
 * authoritative session, workspace, and jobs mocks that journey tests need —
 * but intentionally OMITS `permissiveBackendOverrides`. New backend traffic
 * surfaced by a code change must show up as a strict-mode failure here so
 * the spec can declare it explicitly, not be silently swallowed by a
 * `{}`/`{result: [[]]}` catch-all.
 *
 * Use:
 *   - smoke / a11y / visual specs        → keep `permissiveBackendOverrides`
 *   - journey specs (auth, workspace,
 *     jobs, services deep-submit)        → use `journeyOverrides`
 */
export const journeyOverrides: JsonOverride[] = [
  ...authSessionOverrides,
  ...workspaceOverrides,
  ...jobsOverrides,
];
