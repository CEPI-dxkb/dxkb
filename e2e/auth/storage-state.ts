/**
 * Config-scoped Playwright auth storage-state paths.
 *
 * `playwright.config.ts` and `playwright.a11y.config.ts` both used to point at
 * `e2e/.auth/user.json`, so a `pnpm e2e` and a `pnpm a11y` started at the same
 * time raced on one file: one config's setup project rewrote it while the other
 * config's browser projects were reading it. Each config now owns its own pair
 * of files, so the only ordering these files depend on is the one Playwright
 * already guarantees *within* a config — a project listed in `dependencies`
 * runs to completion before the projects that declare it, regardless of
 * `fullyParallel`. (Running the heavy suites sequentially is still the
 * operational rule on the dev machine, for resource contention, not for this.)
 *
 * The setup specs are shared between the two configs (both `testMatch` them),
 * so the destination is resolved from the running project's name rather than
 * hard-coded: one setup spec, two destinations.
 */

export const e2eSignedInStatePath = "e2e/.auth/e2e-signed-in.json";
export const e2ePublicStatePath = "e2e/.auth/e2e-public.json";
export const a11ySignedInStatePath = "e2e/.auth/a11y-signed-in.json";
export const a11yPublicStatePath = "e2e/.auth/a11y-public.json";

/** Setup project name → the signed-in state file that project writes. */
const signedInStateByProject: Record<string, string> = {
  "setup-signed-in": e2eSignedInStatePath,
  "a11y-setup-signed-in": a11ySignedInStatePath,
};

/** Setup project name → the empty/public state file that project writes. */
const publicStateByProject: Record<string, string> = {
  "setup-public": e2ePublicStatePath,
  "a11y-setup-public": a11yPublicStatePath,
};

function resolveStatePath(
  byProject: Record<string, string>,
  mapName: string,
  projectName: string,
): string {
  const statePath = byProject[projectName];
  if (statePath) return statePath;
  throw new Error(
    `No storage-state path is registered for Playwright project "${projectName}". ` +
      `Add it to ${mapName} in e2e/auth/storage-state.ts and point the consuming ` +
      `projects' \`storageState\` at the same exported constant.`,
  );
}

/** Where the signed-in setup spec writes state when run under `projectName`. */
export function resolveSignedInStatePath(projectName: string): string {
  return resolveStatePath(
    signedInStateByProject,
    "signedInStateByProject",
    projectName,
  );
}

/** Where the public setup spec writes state when run under `projectName`. */
export function resolvePublicStatePath(projectName: string): string {
  return resolveStatePath(
    publicStateByProject,
    "publicStateByProject",
    projectName,
  );
}
