"use client";

import { useMemo, useCallback } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { WorkspaceItemIcon } from "./workspace-item-icon";
import type {
  WorkspaceBrowserItem,
  SortField,
  WorkspaceBrowserSort,
} from "@/types/workspace-browser";
import { formatFileSize, formatDate } from "@/lib/services/workspace/helpers";
import { isFolderType } from "@/lib/services/workspace/utils";

/** Responsive hide classes for each column — shared with special rows (LeadingRow, ParentRow). */
export const COLUMN_CLASS_MAP: Record<string, string> = {
  name: "",
  size: "",
  owner_id: "hidden md:table-cell",
  creation_time: "hidden sm:table-cell",
  members: "",
  type: "hidden lg:table-cell",
};

export function formatOwner(ownerId: string): string {
  if (!ownerId) return "";
  return ownerId.replace(/@bvbrc$/, "");
}

export function formatMemberCount(count: number): string {
  if (count <= 0) return "\u2014";
  if (count === 1) return "Only me";
  return `${count} members`;
}

export function useWorkspaceColumns(
  sort: WorkspaceBrowserSort,
  onSortChange: (sort: WorkspaceBrowserSort) => void,
  memberCountByPath: Record<string, number> | undefined,
) {
  const handleSort = useCallback(
    (field: string) => {
      const sortField = field as SortField;
      if (sort.field === sortField) {
        onSortChange({
          field: sortField,
          direction: sort.direction === "asc" ? "desc" : "asc",
        });
      } else {
        onSortChange({ field: sortField, direction: "asc" });
      }
    },
    [sort.field, sort.direction, onSortChange],
  );

  const columns = useMemo<ColumnDef<WorkspaceBrowserItem>[]>(() => {
    return [
      {
        id: "name",
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => {
          const item = row.original;
          const isNavigable = isFolderType(item.type);
          return (
            <div className="flex min-w-0 items-center gap-2 overflow-hidden">
              <WorkspaceItemIcon type={item.type} className="shrink-0" />
              <span
                className={`truncate ${isNavigable ? "font-medium hover:underline" : ""}`}
                title={item.name}
              >
                {item.name}
              </span>
            </div>
          );
        },
        meta: { className: COLUMN_CLASS_MAP.name, sortField: "name" as SortField },
        size: 220,
        enableResizing: true,
      },
      {
        id: "size",
        accessorKey: "size",
        header: "Size",
        cell: ({ getValue }) => (
          <span className="text-muted-foreground block truncate">
            {formatFileSize(Number(getValue()) || 0)}
          </span>
        ),
        meta: { className: COLUMN_CLASS_MAP.size, sortField: "size" as SortField },
        size: 50,
        enableResizing: true,
      },
      {
        id: "owner_id",
        accessorKey: "owner_id",
        header: "Owner",
        cell: ({ getValue }) => (
          <span className="text-muted-foreground block truncate">
            {formatOwner(String(getValue() ?? ""))}
          </span>
        ),
        meta: { className: COLUMN_CLASS_MAP.owner_id, sortField: "owner_id" as SortField },
        size: 70,
        enableResizing: true,
      },
      {
        id: "creation_time",
        accessorKey: "creation_time",
        header: "Created",
        cell: ({ getValue }) => (
          <span className="text-muted-foreground block truncate">
            {formatDate(String(getValue() ?? ""))}
          </span>
        ),
        meta: { className: COLUMN_CLASS_MAP.creation_time, sortField: "creation_time" as SortField },
        size: 80,
        enableResizing: true,
      },
      {
        id: "members",
        header: "Members",
        cell: ({ row }) => {
          const count = memberCountByPath?.[row.original.path];
          return (
            <span className="text-muted-foreground block truncate">
              {count != null ? formatMemberCount(count) : "\u2014"}
            </span>
          );
        },
        meta: { className: COLUMN_CLASS_MAP.members },
        size: 55,
        enableResizing: true,
      },
      {
        id: "type",
        accessorKey: "type",
        header: "Type",
        cell: ({ getValue }) => (
          <span className="text-muted-foreground block truncate">
            {String(getValue() ?? "")}
          </span>
        ),
        meta: { className: COLUMN_CLASS_MAP.type, sortField: "type" as SortField },
        size: 60,
        enableResizing: true,
      },
    ];
  }, [memberCountByPath]);

  return { columns, handleSort };
}
