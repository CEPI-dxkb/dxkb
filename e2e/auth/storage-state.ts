/**
 * Config-scoped storage-state paths, so concurrent `pnpm e2e` and `pnpm a11y`
 * runs do not race on one file. The setup specs are shared, so the
 * destination comes from the running project's name. `a11ySummaryPath` and
 * the CI-only `results.json` are still shared single files between concurrent
 * a11y sweeps.
 */

export const e2eSignedInStatePath = "e2e/.auth/e2e-signed-in.json";
export const e2ePublicStatePath = "e2e/.auth/e2e-public.json";
export const a11ySignedInStatePath = "e2e/.auth/a11y-signed-in.json";
export const a11yPublicStatePath = "e2e/.auth/a11y-public.json";

const signedInStateByProject: Record<string, string> = {
  "setup-signed-in": e2eSignedInStatePath,
  "a11y-setup-signed-in": a11ySignedInStatePath,
};

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

export function resolveSignedInStatePath(projectName: string): string {
  return resolveStatePath(
    signedInStateByProject,
    "signedInStateByProject",
    projectName,
  );
}

export function resolvePublicStatePath(projectName: string): string {
  return resolveStatePath(
    publicStateByProject,
    "publicStateByProject",
    projectName,
  );
}
