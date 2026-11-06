import { jobsPanelIds } from "@/constants/jobs-panels";
import { workspacePanelIds } from "@/constants/workspace-panels";
import type { CompareRegionDensity } from "@/lib/compare-region/density-options";
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
 *
 * It also imports no zod: the provider reaches every route's first-load JS through the
 * root layout. The schemas and the cookie parsers live in `./schemas`, used only by
 * the server read in `./server`.
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
  /** Compare Region Viewer figure density on the feature page. */
  compareRegionDensity: CompareRegionDensity;
  /** Where the navbar's Copilot button opens the chat. */
  copilotSurface: CopilotSurface;
  /** The floating Copilot window's last position and size, in CSS pixels. */
  copilotFloatingRect: CopilotFloatingRect;
}

export const copilotSurfaces = ["sheet", "floating"] as const;
export type CopilotSurface = (typeof copilotSurfaces)[number];

export interface CopilotFloatingRect {
  /** Distance from the viewport's right edge. */
  right: number;
  /** Distance from the viewport's bottom edge. */
  bottom: number;
  width: number;
  height: number;
}

export type UiPreferenceKey = keyof UiPreferences;

interface UiPreferenceDefinition<T> {
  cookieName: string;
  defaultValue: T;
}

export const uiPreferenceDefinitions: {
  [K in UiPreferenceKey]: UiPreferenceDefinition<UiPreferences[K]>;
} = {
  viewNavCollapsed: {
    cookieName: "dxkb-view-nav-collapsed",
    defaultValue: false,
  },
  workspacePanelLayout: {
    cookieName: "dxkb-workspace-panel-layout",
    defaultValue: {
      [workspacePanelIds.main]: 60,
      [workspacePanelIds.details]: 40,
    },
  },
  jobsPanelLayout: {
    cookieName: "dxkb-jobs-panel-layout",
    // The shell used to pass defaultSize 75% and 20%, which the library normalized to
    // this split. Keeping the normalized numbers keeps the default pixel-identical.
    defaultValue: {
      [jobsPanelIds.main]: 78.947,
      [jobsPanelIds.details]: 21.053,
    },
  },
  resourceDetailPanelSize: {
    cookieName: "dxkb-resource-detail-panel-size",
    defaultValue: 15,
  },
  workspaceShowHiddenFiles: {
    cookieName: "dxkb-workspace-show-hidden",
    defaultValue: false,
  },
  workspaceSort: {
    cookieName: "dxkb-workspace-sort",
    defaultValue: { field: "name", direction: "asc" },
  },
  compareRegionDensity: {
    cookieName: "dxkb-compare-region-density",
    defaultValue: "comfortable",
  },
  copilotSurface: {
    cookieName: "dxkb-copilot-surface",
    defaultValue: "sheet",
  },
  copilotFloatingRect: {
    cookieName: "dxkb-copilot-floating-rect",
    defaultValue: { right: 24, bottom: 24, width: 420, height: 640 },
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
