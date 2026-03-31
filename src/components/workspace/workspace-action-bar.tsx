"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {TooltipProvider, Tooltip, TooltipTrigger, TooltipContent} from "@/components/ui/tooltip";
import { Download, Trash2, Pencil, Copy, Move, Star, BookOpen, Type, type LucideIcon } from "lucide-react";

import type { WorkspaceBrowserItem } from "@/types/workspace-browser";

const writePermissions = new Set(["o", "a", "w"]);

export type WorkspaceActionId = "guide" | "download" | "delete" | "rename" | "copy" | "move" | "editType" | "favorite";

interface ActionConfig {
  id: WorkspaceActionId;
  label: string;
  icon: LucideIcon;
  /** "*" or list of item types this action applies to */
  validTypes: string[] | "*";
  /** If true, hide when user has only read permission */
  requireWrite?: boolean;
  /** If set, button is always disabled and this string is shown as hover title */
  disabledWithTooltip?: string;
}

// TODO: Add "View" buttons to FASTA/PDB files once the viewer/datagrid is implemented fully.
const actionConfig: ActionConfig[] = [
  { id: "guide", label: "GUIDE", icon: BookOpen, validTypes: "*" },
  { id: "download", label: "DWNLD", icon: Download, validTypes: "*" },
  { id: "delete", label: "DELETE", icon: Trash2, validTypes: "*", requireWrite: true },
  {
    id: "rename",
    label: "RENAME",
    icon: Pencil,
    validTypes: "*",
    requireWrite: true,
    disabledWithTooltip: "Rename has been temporarily disabled while we address a technical issue.",
  },
  { id: "copy", label: "COPY", icon: Copy, validTypes: "*" },
  { id: "move", label: "MOVE", icon: Move, validTypes: "*", requireWrite: true },
  { id: "editType", label: "EDIT TYPE", icon: Type, validTypes: "*", requireWrite: true },
  { id: "favorite", label: "FAVORITE", icon: Star, validTypes: ["folder"] },
];

function getSelectionDisabledTooltip(
  action: ActionConfig,
  selection: WorkspaceBrowserItem[],
): string | undefined {
  if (action.id === "editType" && selection.some((s) => s.type === "job_result")) {
    return 'Cannot change "job_result" type';
  }
  return undefined;
}

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
  disabledActionIds?: WorkspaceActionId[];
  /** Action IDs currently loading (show spinner instead of icon). */
  loadingActionIds?: WorkspaceActionId[];
  /** When true, the Favorite action shows a filled star (selected folder is favorited). */
  isCurrentSelectionFavorite?: boolean;
  /** When true, only show read-only actions (guide + download). Used for public workspace browsing. */
  readOnly?: boolean;
  onAction?: (actionId: WorkspaceActionId, selection: WorkspaceBrowserItem[]) => void;
}

const readOnlyAllowedActions = new Set(["guide", "download"]);

export function WorkspaceActionBar({
  selection,
  workspaceGuideUrl,
  disabledActionIds,
  loadingActionIds,
  isCurrentSelectionFavorite = false,
  readOnly = false,
  onAction,
}: WorkspaceActionBarProps) {
  const visibleActions = actionConfig.filter((action) => {
    if (readOnly && !readOnlyAllowedActions.has(action.id)) return false;
    return isActionValidForSelection(action, selection);
  });
  const isDisabled = (actionId: WorkspaceActionId) =>
    disabledActionIds?.includes(actionId) ?? false;
  const isLoading = (actionId: WorkspaceActionId) =>
    loadingActionIds?.includes(actionId) ?? false;
  const isPermanentlyDisabled = (action: ActionConfig) =>
    !!action.disabledWithTooltip;

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-1">
        {visibleActions.map((action) => {
          const Icon = action.icon;
          const showSpinner = isLoading(action.id);
          const isFavoriteAction = action.id === "favorite";
          const showFilledStar =
            isFavoriteAction && isCurrentSelectionFavorite && !showSpinner;
          const dynamicTooltip = getSelectionDisabledTooltip(action, selection);
          const tooltipText = action.disabledWithTooltip ?? dynamicTooltip;
          const disabled =
            isDisabled(action.id) || isPermanentlyDisabled(action) || !!dynamicTooltip;
          const buttonEl = (
            <Button
              key={action.id}
              variant="secondary"
              className="h-[60px] w-full flex-col gap-1 font-normal"
              disabled={disabled}
              onClick={() =>
                action.id === "guide"
                  ? window.open(workspaceGuideUrl, "_blank", "noopener,noreferrer")
                  : onAction?.(action.id, selection)
              }
            >
              {showSpinner ? (
                <Spinner className="h-4 w-4 shrink-0" />
              ) : showFilledStar ? (
                <Star className="h-4 w-4 shrink-0 fill-current" />
              ) : (
                <Icon className="h-4 w-4 shrink-0" />
              )}
              <span className="text-[11px] font-medium leading-tight">{action.label}</span>
            </Button>
          );
          return tooltipText && disabled ? (
            <Tooltip key={action.id}>
              <TooltipTrigger
                render={
                  <span className="inline-flex w-full cursor-not-allowed">
                    {buttonEl}
                  </span>
                }
              />
              <TooltipContent side="left">
                <p>{tooltipText}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            buttonEl
          );
        })}
      </div>
    </TooltipProvider>
  );
}
