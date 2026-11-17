import {
  Clock,
  Globe,
  HardDrive,
  House,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";
import type {
  PickerTarget,
  PickerView,
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

const columnWidthLimits = { min: 144, max: 480, initial: 180 };
/** The first column lists a place's top level, where names run longest, so it starts wider. */
const rootColumnWidthLimits = { ...columnWidthLimits, initial: 240 };

export function columnWidthLimitsFor(index: number) {
  return index === 0 ? rootColumnWidthLimits : columnWidthLimits;
}
export const previewWidthLimits = { min: 256, max: 560, initial: 320 };
export const uploadPaneMinWidth = 384;

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

/**
 * Why the picker toolbar's New folder and Upload are off, or null when both can be
 * used. The toolbar disables on, and explains with, this one value.
 */
export function toolbarUnavailableReason({
  isUploading,
  folderPath,
  hasListingError,
  canChange,
}: {
  isUploading: boolean;
  folderPath: string | null;
  hasListingError: boolean;
  canChange: boolean;
}): string | null {
  if (isUploading) return "An upload is running.";
  if (folderPath === null) return "Open a folder first.";
  if (hasListingError) return "Couldn't check this folder's write access.";
  if (!canChange) return "You don't have write access to this folder.";
  return null;
}
