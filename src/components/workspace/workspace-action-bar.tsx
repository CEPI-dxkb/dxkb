"use client";

import {
  Download,
  Trash2,
  Pencil,
  Copy,
  Move,
  Share2,
  Star,
  BookOpen,
  Type,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  { id: "share", label: "SHARE", icon: Share2, validTypes: "*", requireWrite: true },
  { id: "favorite", label: "FAVORITE", icon: Star, validTypes: "*" },
];

function isActionValidForSelection(
  action: ActionConfig,
  selection: WorkspaceBrowserItem[],
): boolean {
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
  currentPath?: string;
  onAction?: (actionId: string, selection: WorkspaceBrowserItem[]) => void;
}

export function WorkspaceActionBar({
  selection,
  onAction,
}: WorkspaceActionBarProps) {
  const visibleActions = actionConfig.filter((action) =>
    isActionValidForSelection(action, selection),
  );

  return (
    <div className="flex flex-col gap-1">
      {visibleActions.map((action) => {
        const Icon = action.icon;
        return (
          <Button
            key={action.id}
            variant="secondary"
            size="sm"
            className="h-[60px] w-full flex-col gap-0.5 py-1.5 font-normal"
            onClick={() => onAction?.(action.id, selection)}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="text-[10px] leading-tight">{action.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
