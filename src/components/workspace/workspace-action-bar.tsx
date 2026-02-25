"use client";

import {
  Download,
  Trash2,
  Pencil,
  Copy,
  Move,
  Star,
  BookOpen,
  Type,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { WorkspaceBrowserItem } from "@/types/workspace-browser";

const writePermissions = new Set(["o", "a", "w"]);

interface ActionConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  /** "*" or list of item types this action applies to */
  validTypes: string[] | "*";
  /** If true, hide when user has only read permission */
  requireWrite?: boolean;
}

const actionConfig: ActionConfig[] = [
  { id: "guide", label: "GUIDE", icon: BookOpen, validTypes: "*" },
  { id: "download", label: "DWNLD", icon: Download, validTypes: "*" },
  { id: "delete", label: "DELETE", icon: Trash2, validTypes: "*", requireWrite: true },
  { id: "rename", label: "RENAME", icon: Pencil, validTypes: "*", requireWrite: true },
  { id: "copy", label: "COPY", icon: Copy, validTypes: "*" },
  { id: "move", label: "MOVE", icon: Move, validTypes: "*", requireWrite: true },
  { id: "editType", label: "EDIT TYPE", icon: Type, validTypes: "*", requireWrite: true },
  { id: "favorite", label: "FAVORITE", icon: Star, validTypes: ["folder"] },
];

function isActionValidForSelection(
  action: ActionConfig,
  selection: WorkspaceBrowserItem[],
): boolean {
  if (action.id === "guide") return true;
  if (selection.length === 0) return false;

  const typesMatch =
    action.validTypes === "*" ||
    selection.every((s) =>
      (action.validTypes as string[]).includes(s.type ?? ""),
    );
  if (!typesMatch) return false;

  if (action.requireWrite) {
    const hasWrite = selection.every((s) =>
      writePermissions.has(s.user_permission ?? ""),
    );
    if (!hasWrite) return false;
  }

  return true;
}

export interface WorkspaceActionBarProps {
  selection: WorkspaceBrowserItem[];
  /** URL opened when the Guide button is clicked (from env WORKSPACE_GUIDE_URL). */
  workspaceGuideUrl: string;
  currentPath?: string;
  /** Action IDs to disable (e.g. "download" while fetching URL). */
  disabledActionIds?: string[];
  /** Action IDs currently loading (show spinner instead of icon). */
  loadingActionIds?: string[];
  /** When true, the Favorite action shows a filled star (selected folder is favorited). */
  isCurrentSelectionFavorite?: boolean;
  onAction?: (actionId: string, selection: WorkspaceBrowserItem[]) => void;
}

export function WorkspaceActionBar({
  selection,
  workspaceGuideUrl,
  disabledActionIds,
  loadingActionIds,
  isCurrentSelectionFavorite = false,
  onAction,
}: WorkspaceActionBarProps) {
  const visibleActions = actionConfig.filter((action) =>
    isActionValidForSelection(action, selection),
  );
  const isDisabled = (actionId: string) =>
    disabledActionIds?.includes(actionId) ?? false;
  const isLoading = (actionId: string) =>
    loadingActionIds?.includes(actionId) ?? false;

  return (
    <div className="flex flex-col gap-1">
      {visibleActions.map((action) => {
        const Icon = action.icon;
        const showSpinner = isLoading(action.id);
        const isFavoriteAction = action.id === "favorite";
        const showFilledStar =
          isFavoriteAction && isCurrentSelectionFavorite && !showSpinner;
        return (
          <Button
            key={action.id}
            variant="secondary"
            size="sm"
            className="h-[60px] w-full flex-col gap-0.5 py-1.5 font-normal"
            disabled={isDisabled(action.id)}
            onClick={() =>
              action.id === "guide"
                ? window.open(workspaceGuideUrl, "_blank", "noopener,noreferrer")
                : onAction?.(action.id, selection)
            }
          >
            {showSpinner ? (
              <Spinner className="h-3.5 w-3.5 shrink-0" />
            ) : showFilledStar ? (
              <Star className="h-3.5 w-3.5 shrink-0 fill-current" />
            ) : (
              <Icon className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="text-[10px] leading-tight">{action.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
