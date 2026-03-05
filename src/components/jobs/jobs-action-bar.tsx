"use client";

import { Eye, FolderOpen, StopCircle, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { JobListItem } from "@/types/workspace";

interface ActionConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  isVisible: (jobs: JobListItem[]) => boolean;
  isDisabled?: (jobs: JobListItem[]) => boolean;
}

const actionConfig: ActionConfig[] = [
  {
    id: "view",
    label: "VIEW",
    icon: Eye,
    isVisible: (jobs) => jobs.length === 1,
  },
  {
    id: "show",
    label: "SHOW",
    icon: FolderOpen,
    isVisible: (jobs) =>
      jobs.length === 1 && !!jobs[0].output_path,
  },
  {
    id: "kill",
    label: "KILL",
    icon: StopCircle,
    isVisible: (jobs) =>
      jobs.length >= 1 &&
      jobs.every(
        (j) =>
          j.status === "running" ||
          j.status === "in-progress" ||
          j.status === "queued",
      ),
  },
];

interface JobsActionBarProps {
  selection: JobListItem[];
  loadingActionIds?: string[];
  onAction: (actionId: string, selection: JobListItem[]) => void;
}

export function JobsActionBar({
  selection,
  loadingActionIds,
  onAction,
}: JobsActionBarProps) {
  const visibleActions = actionConfig.filter((action) =>
    action.isVisible(selection),
  );
  const isLoading = (id: string) => loadingActionIds?.includes(id) ?? false;

  return (
    <div className="flex flex-col gap-1">
      {visibleActions.map((action) => {
        const Icon = action.icon;
        const loading = isLoading(action.id);
        const disabled =
          loading || (action.isDisabled?.(selection) ?? false);
        return (
          <Button
            key={action.id}
            variant="secondary"
            className="h-[60px] w-full flex-col gap-1 font-normal"
            disabled={disabled}
            onClick={() => onAction(action.id, selection)}
          >
            {loading ? (
              <Spinner className="h-4 w-4 shrink-0" />
            ) : (
              <Icon className="h-4 w-4 shrink-0" />
            )}
            <span className="text-[11px] font-medium leading-tight">
              {action.label}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
