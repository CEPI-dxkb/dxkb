import { z } from "zod";
import { jobsPanelIds } from "@/constants/jobs-panels";
import { workspacePanelIds } from "@/constants/workspace-panels";
import { workspaceSortFields } from "@/constants/workspace-sort";
import type { WorkspaceSortConfig } from "@/types/workspace-browser";

/**
 * Device-local UI preferences: one cookie per preference, read by the root layout
 * and written by `UiPreferencesProvider`.
 *
 * This module deliberately has no "use client" directive. The root layout (a Server
 * Component) and client components both import it. A constant exported from a
 * "use client" module reaches server code as a client reference rather than its
 * value — which is exactly how the old `workspace-panel-layout` cookie read came back
 * `undefined` on every request.
 */

type WorkspacePanelId = (typeof workspacePanelIds)[keyof typeof workspacePanelIds];
type JobsPanelId = (typeof jobsPanelIds)[keyof typeof jobsPanelIds];

export interface UiPreferences {
  /** Left view rail on organism landing pages and entity views. */
  viewNavCollapsed: boolean;
  /** Workspace browser split, in percent. Saved only while the details panel is open. */
  workspacePanelLayout: Record<WorkspacePanelId, number>;
  /** Jobs page split, in percent. Saved only while the details panel is open. */
  jobsPanelLayout: Record<JobsPanelId, number>;
  /** Resource-collection detail panel width, in percent, side-by-side layout only. */
  resourceDetailPanelSize: number;
  /** "Show hidden" in the workspace toolbar (dotfiles). */
  workspaceShowHiddenFiles: boolean;
  /** Workspace file list sort; applies in every folder. */
  workspaceSort: WorkspaceSortConfig;
  /** Left type rail on /search. Its own key: a different rail from the view rail. */
  searchNavCollapsed: boolean;
  /** Show/Hide Filters on every collection and search filter bar. */
  facetPanelOpen: boolean;
}

export type UiPreferenceKey = keyof UiPreferences;

interface UiPreferenceDefinition<T> {
  cookieName: string;
  schema: z.ZodType<T>;
  defaultValue: T;
}

// Strictly positive: the app never saves a share <= 0 (saves need details > 0, and main
// has a minSize). A hand-edited 0 would make Show a no-op (`resize("0%")`), and {0, 0}
// makes the library compute a NaN width.
const panelShare = z.number().gt(0).max(100);

export const uiPreferenceDefinitions: {
  [K in UiPreferenceKey]: UiPreferenceDefinition<UiPreferences[K]>;
} = {
  viewNavCollapsed: {
    cookieName: "dxkb-view-nav-collapsed",
    schema: z.boolean(),
    defaultValue: false,
  },
  workspacePanelLayout: {
    cookieName: "dxkb-workspace-panel-layout",
    schema: z.strictObject({
      [workspacePanelIds.main]: panelShare,
      [workspacePanelIds.details]: panelShare,
    }),
    defaultValue: {
      [workspacePanelIds.main]: 60,
      [workspacePanelIds.details]: 40,
    },
  },
  jobsPanelLayout: {
    cookieName: "dxkb-jobs-panel-layout",
    schema: z.strictObject({
      [jobsPanelIds.main]: panelShare,
      [jobsPanelIds.details]: panelShare,
    }),
    // The shell used to pass defaultSize 75% and 20%, which the library normalized to
    // this split. Keeping the normalized numbers keeps the default pixel-identical.
    defaultValue: {
      [jobsPanelIds.main]: 78.947,
      [jobsPanelIds.details]: 21.053,
    },
  },
  resourceDetailPanelSize: {
    cookieName: "dxkb-resource-detail-panel-size",
    // Same window as the side-by-side panel's minSize/maxSize in resource-workspace.tsx.
    schema: z.number().min(10).max(60),
    defaultValue: 15,
  },
  workspaceShowHiddenFiles: {
    cookieName: "dxkb-workspace-show-hidden",
    schema: z.boolean(),
    defaultValue: false,
  },
  workspaceSort: {
    cookieName: "dxkb-workspace-sort",
    schema: z.strictObject({
      field: z.enum(workspaceSortFields),
      direction: z.enum(["asc", "desc"]),
    }),
    defaultValue: { field: "name", direction: "asc" },
  },
  searchNavCollapsed: {
    cookieName: "dxkb-search-nav-collapsed",
    schema: z.boolean(),
    defaultValue: false,
  },
  facetPanelOpen: {
    cookieName: "dxkb-facet-panel-open",
    schema: z.boolean(),
    defaultValue: false,
  },
};

export const uiPreferenceKeys = Object.keys(
  uiPreferenceDefinitions,
) as UiPreferenceKey[];

/** Build a full `UiPreferences` record one key at a time. */
export function mapUiPreferences(
  pick: <K extends UiPreferenceKey>(key: K) => UiPreferences[K],
): UiPreferences {
  // Object.fromEntries cannot carry the per-key value types; `pick` enforces them.
  return Object.fromEntries(
    uiPreferenceKeys.map((key) => [key, pick(key)]),
  ) as unknown as UiPreferences;
}

export const defaultUiPreferences = mapUiPreferences(
  (key) => uiPreferenceDefinitions[key].defaultValue,
);

/** Cookies earlier builds wrote that nothing reads any more; the provider expires them. */
export const legacyUiPreferenceCookies = [
  { name: "workspace-panel-layout", path: "/workspace" },
] as const;
