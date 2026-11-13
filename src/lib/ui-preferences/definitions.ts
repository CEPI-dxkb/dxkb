import { jobsPanelIds } from "@/constants/jobs-panels";
import { workspacePanelIds } from "@/constants/workspace-panels";
import type { CompareRegionDensity } from "@/lib/compare-region/density-options";
import type { WorkspaceSortConfig } from "@/types/workspace-browser";

/** Device-local UI preferences, one cookie each; no "use client" or zod here, as server code needs real constants and the provider ships on every route. */

type WorkspacePanelId = (typeof workspacePanelIds)[keyof typeof workspacePanelIds];
type JobsPanelId = (typeof jobsPanelIds)[keyof typeof jobsPanelIds];

export interface UiPreferences {
  viewNavCollapsed: boolean;
  /** Workspace browser split, in percent. Saved only while the details panel is open. */
  workspacePanelLayout: Record<WorkspacePanelId, number>;
  /** Jobs page split, in percent. Saved only while the details panel is open. */
  jobsPanelLayout: Record<JobsPanelId, number>;
  /** Resource-collection detail panel width, in percent, side-by-side layout only. */
  resourceDetailPanelSize: number;
  workspaceShowHiddenFiles: boolean;
  workspaceSort: WorkspaceSortConfig;
  compareRegionDensity: CompareRegionDensity;
  copilotSurface: CopilotSurface;
  copilotFloatingRect: CopilotFloatingRect;
  copilotTab: CopilotTabPlacement;
}

export const copilotSurfaces = ["sheet", "floating"] as const;
export type CopilotSurface = (typeof copilotSurfaces)[number];

export interface CopilotFloatingRect {
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export const copilotTabSides = ["left", "right"] as const;
export type CopilotTabSide = (typeof copilotTabSides)[number];

/** Where the minimized chat's edge tab sits: which window edge, and how far down the window (0 to 1). The side panel and the floating window open on the same side. */
export interface CopilotTabPlacement {
  side: CopilotTabSide;
  top: number;
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
    defaultValue: {
      [jobsPanelIds.main]: 78.947,
      [jobsPanelIds.details]: 21.053,
    },
  },
  resourceDetailPanelSize: {
    cookieName: "dxkb-resource-detail-panel-size",
    defaultValue: 30,
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
    // Anchored to the bottom-right so a smaller window still shows; the component clamps into the viewport.
    defaultValue: { right: 24, bottom: 24, width: 420, height: 640 },
  },
  copilotTab: {
    cookieName: "dxkb-copilot-tab",
    defaultValue: { side: "right", top: 0.75 },
  },
};

export const uiPreferenceKeys = Object.keys(
  uiPreferenceDefinitions,
) as UiPreferenceKey[];

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

/** Legacy cookies the provider expires. */
export const legacyUiPreferenceCookies = [
  { name: "workspace-panel-layout", path: "/workspace" },
] as const;
