"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DetailPanel } from "@/components/detail-panel";
import { WorkspaceItemIcon } from "@/components/workspace/workspace-item-icon";
import { formatDate, formatOwner } from "@/lib/services/workspace/helpers";
import { useWorkspaceRepository } from "@/contexts/workspace-repository-context";
import { workspaceQueryKeys } from "@/lib/services/workspace/workspace-query-keys";
import { editTypeOptions } from "@/lib/services/workspace/types";
import type { WorkspaceBrowserItem } from "@/types/workspace-browser";

interface WorkspaceItemDetailsProps {
  item: WorkspaceBrowserItem;
  defaultExpanded?: boolean;
  children?: React.ReactNode;
}

export function WorkspaceItemDetails({
  item,
  defaultExpanded = true,
  children,
}: WorkspaceItemDetailsProps) {
  const queryClient = useQueryClient();
  const repository = useWorkspaceRepository("authenticated");

  const typeOptions = useMemo(() => {
    const currentType = item.type ?? "";
    const set = new Set(editTypeOptions);
    if (currentType && !set.has(currentType)) {
      return [currentType, ...editTypeOptions].sort((a, b) => a.localeCompare(b));
    }
    return editTypeOptions;
  }, [item.type]);

  const editTypeMutation = useMutation({
    mutationFn: async (newType: string) => {
      await repository.updateObjectType(item.path, newType);
    },
    onSuccess: (_, newType) => {
      void queryClient.invalidateQueries({ queryKey: ["workspace-browser"] });
      void queryClient.invalidateQueries({ queryKey: ["workspace-list-path"] });
      void queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.all });
      toast.success("Object type updated", {
        description: `${item.name} is now type "${newType}".`,
      });
    },
    onError: () => {
      toast.error("Failed to update object type");
    },
  });

  const isJobResult = item.type === "job_result";

  const selectEl = (
    <Select
      value={(editTypeMutation.isPending ? editTypeMutation.variables : item.type) ?? ""}
      onValueChange={(value) => {
        if (value && value !== item.type) {
          editTypeMutation.mutate(value);
        }
      }}
      disabled={isJobResult || editTypeMutation.isPending}
    >
      <SelectTrigger size="sm" className="h-6 min-w-0 gap-1 text-xs">
        <SelectValue placeholder="Unspecified" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {typeOptions.map((typeId) => (
            <SelectItem key={typeId} value={typeId}>
              {typeId}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );

  return (
    <DetailPanel.CollapsibleSection label="Details" defaultExpanded={defaultExpanded}>
      <div className="space-y-3 px-3 py-3 text-xs border-b">
        <div className="flex items-center gap-2">
          <WorkspaceItemIcon type={item.type} className="h-5 w-5 shrink-0" />
          {isJobResult ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger render={<span className="min-w-0 cursor-not-allowed">{selectEl}</span>} />
                <TooltipContent side="right">
                  <p>Cannot change &quot;job_result&quot; type</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            selectEl
          )}
        </div>

        <dl className="grid gap-1.5">
          <div>
            <dt className="text-muted-foreground">Owner</dt>
            <dd className="break-all">{formatOwner(item.owner_id)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Created</dt>
            <dd>{formatDate(item.creation_time)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Path</dt>
            <dd className="break-all font-mono text-[11px]">{item.path}</dd>
          </div>
          {children}
        </dl>
      </div>
    </DetailPanel.CollapsibleSection>
  );
}
