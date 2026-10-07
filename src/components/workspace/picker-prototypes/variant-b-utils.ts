/** PROTOTYPE — variant B helpers shared by the column, preview and dialog. */

import {
  Clock,
  Globe,
  HardDrive,
  House,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { WorkspaceItem } from "@/lib/services/workspace/domain";
import { normalizePath } from "@/lib/services/workspace/mini-browser-items";
import {
  buildPickerItems,
  filterListing,
  pickerViewOptions,
  type PickerLocation,
  type PickerTarget,
  type PickerView,
} from "@/lib/services/workspace/picker-views";

export const folderTarget: PickerTarget = { kind: "folder" };

export const placeIcons: Record<PickerView, LucideIcon> = {
  home: House,
  myWorkspaces: HardDrive,
  shared: Users,
  public: Globe,
  favorites: Star,
  recent: Clock,
};

export const placeGroups: readonly {
  label: string;
  views: readonly PickerView[];
}[] = [
  { label: "Workspaces", views: ["home", "myWorkspaces"] },
  { label: "Shared with me", views: ["shared", "public"] },
  { label: "Quick access", views: ["favorites", "recent"] },
];

export function placeLabel(view: PickerView): string {
  return pickerViewOptions.find((option) => option.value === view)?.label ?? "";
}

export function pathSegments(path: string): string[] {
  return normalizePath(path).split("/").filter(Boolean);
}

export function lastSegment(path: string): string {
  return pathSegments(path).pop() ?? "";
}

/**
 * Rows a column shows: the picker's filter and sort rules for a folder target.
 * "Show files" adds the folder's files; hidden (dot) items stay hidden.
 */
export function visibleRows(
  location: PickerLocation,
  items: WorkspaceItem[],
  showFiles: boolean,
): WorkspaceItem[] {
  const rows = buildPickerItems({
    items: filterListing({ location, items, target: folderTarget }),
    target: folderTarget,
    showAll: showFiles,
    keepOrder: location.kind === "list" && location.view === "recent",
  });
  return showFiles ? rows.filter((item) => !item.name.startsWith(".")) : rows;
}

/** Column and preview widths in px; the dialog keeps them between opens. */
export const columnWidthLimits = { min: 144, max: 480, initial: 180 };
export const previewWidthLimits = { min: 256, max: 560, initial: 320 };
/** The upload form needs more room than the folder info. */
export const uploadPaneMinWidth = 384;

/** The one row in the strip that takes Tab (roving focus). */
export const tabStopSelector = '[data-picker-row][tabindex="0"]';

export function rowSelector(column: number, path: string): string {
  return `[data-picker-col="${String(column)}"][data-picker-path="${CSS.escape(path)}"]`;
}

/** The inline new-folder input marks itself so Esc there does not close the dialog. */
export const inlineEditAttribute = "data-picker-inline-edit";

export function isInlineEditTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(`[${inlineEditAttribute}]`) !== null
  );
}
