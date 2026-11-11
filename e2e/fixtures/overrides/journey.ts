import type { JsonOverride } from "../../mocks/backends";
import { authSessionOverrides } from "./auth-session";
import { workspaceOverrides } from "./workspace";
import { jobsOverrides } from "./jobs";

/**
 * Session, workspace and jobs mocks for journey specs, deliberately omitting
 * resource bundles and broad aggregates so new backend traffic fails strict
 * mode. View specs import their named bundles, the a11y sweep uses
 * `a11yBackendOverrides`, and HAR canaries use endpoint-specific overrides
 * plus `harOverridesFor(...)` instead of this.
 */
export const journeyOverrides: JsonOverride[] = [
  ...authSessionOverrides,
  ...workspaceOverrides,
  ...jobsOverrides,
];
