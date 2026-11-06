import "server-only";
import { z } from "zod";
import { workspacePanelIds } from "@/constants/workspace-panels";
import { jobsPanelIds } from "@/constants/jobs-panels";
import { workspaceSortFields } from "@/constants/workspace-sort";
import { compareRegionDensities } from "@/lib/compare-region/density-options";
import {
  copilotSurfaces,
  mapUiPreferences,
  uiPreferenceDefinitions,
  type UiPreferenceKey,
  type UiPreferences,
} from "./definitions";

/**
 * Validation for the preference cookies. Server-only by use: zod stays out of the
 * client bundle, so `definitions.ts` and `cookie.ts` (which the provider imports)
 * import none of it.
 */

// Strictly positive: the app never saves a share <= 0 (saves need details > 0, and main
// has a minSize). A hand-edited 0 would make Show a no-op (`resize("0%")`), and {0, 0}
// makes the library compute a NaN width.
const panelShare = z.number().gt(0).max(100);

export const uiPreferenceSchemas: {
  [K in UiPreferenceKey]: z.ZodType<UiPreferences[K]>;
} = {
  viewNavCollapsed: z.boolean(),
  workspacePanelLayout: z.strictObject({
    [workspacePanelIds.main]: panelShare,
    [workspacePanelIds.details]: panelShare,
  }),
  jobsPanelLayout: z.strictObject({
    [jobsPanelIds.main]: panelShare,
    [jobsPanelIds.details]: panelShare,
  }),
  // Same window as the side-by-side panel's minSize/maxSize in resource-workspace.tsx.
  resourceDetailPanelSize: z.number().min(10).max(60),
  workspaceShowHiddenFiles: z.boolean(),
  workspaceSort: z.strictObject({
    field: z.enum(workspaceSortFields),
    direction: z.enum(["asc", "desc"]),
  }),
  compareRegionDensity: z.enum(compareRegionDensities),
  copilotSurface: z.enum(copilotSurfaces),
  // Anchored to the bottom-right corner, so a smaller window later still
  // shows the window; the component clamps it into the viewport. Width and
  // height only need to be sane: a cookie saved on a small viewport can hold
  // less than the 320x360 minimum, and the component restores the minimum.
  copilotFloatingRect: z.strictObject({
    right: z.number().min(0).max(10_000),
    bottom: z.number().min(0).max(10_000),
    width: z.number().min(0).max(10_000),
    height: z.number().min(0).max(10_000),
  }),
};

/** Parse one cookie value; anything absent, malformed or out of schema is the default. */
export function parseUiPreference<K extends UiPreferenceKey>(
  key: K,
  raw: string | undefined,
): UiPreferences[K] {
  const { defaultValue } = uiPreferenceDefinitions[key];
  if (raw === undefined) return defaultValue;
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return defaultValue;
  }
  const result = uiPreferenceSchemas[key].safeParse(decoded);
  return result.success ? result.data : defaultValue;
}

export function parseUiPreferences(
  readCookie: (name: string) => string | undefined,
): UiPreferences {
  return mapUiPreferences((key) =>
    parseUiPreference(key, readCookie(uiPreferenceDefinitions[key].cookieName)),
  );
}
