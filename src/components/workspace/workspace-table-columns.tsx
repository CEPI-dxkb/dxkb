"use client";

import { useMemo, useCallback } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { WorkspaceItemIcon, type FolderIconVariant } from "./workspace-item-icon";
import type {
  WorkspaceBrowserItem,
  SortField,
  WorkspaceBrowserSort,
} from "@/types/workspace-browser";
import { formatFileSize, formatDate, formatOwner } from "@/lib/services/workspace/helpers";
import { isFolderType } from "@/lib/services/workspace/utils";

/** Responsive hide classes for each column — shared with special rows (LeadingRow, ParentRow). */
export const columnClassMap: Record<string, string> = {
  name: "",
  size: "",
  owner_id: "hidden md:table-cell",
  creation_time: "hidden sm:table-cell",
  members: "",
  type: "hidden lg:table-cell",
};

export function formatMemberCount(count: number): string {
  if (count <= 0) return "\u2014";
  if (count === 1) return "Only me";
  return `${count} members`;
}

const emptyFavorites: string[] = [];

export function useWorkspaceColumns(
  sort: WorkspaceBrowserSort,
  onSortChange: (sort: WorkspaceBrowserSort) => void,
  memberCountByPath: Record<string, number> | undefined,
  favoritePaths: string[] = emptyFavorites,
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
    const favoriteSet = new Set(favoritePaths);
    return [
      {
        id: "name",
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => {
          const item = row.original;
          const isNavigable = isFolderType(item.type);
          let variant: FolderIconVariant = "default";
          if (isNavigable) {
            if (item.global_permission === "r") variant = "public";
            else if (favoriteSet.has(item.path)) variant = "favorite";
            else if ((memberCountByPath?.[item.path] ?? 0) > 1) variant = "shared";
          }
          return (
            <div className="flex min-w-0 items-center gap-2 overflow-hidden">
              <WorkspaceItemIcon type={item.type} variant={variant} className="shrink-0" />
              <span
                className={`truncate ${isNavigable ? "font-medium hover:underline" : ""}`}
                title={item.name}
              >
                {item.name}
              </span>
            </div>
          );
        },
        meta: { className: columnClassMap.name, sortField: "name" as SortField },
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
        meta: { className: columnClassMap.size, sortField: "size" as SortField },
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
        meta: { className: columnClassMap.owner_id, sortField: "owner_id" as SortField },
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
        meta: { className: columnClassMap.creation_time, sortField: "creation_time" as SortField },
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
        meta: { className: columnClassMap.members },
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
        meta: { className: columnClassMap.type, sortField: "type" as SortField },
        size: 60,
        enableResizing: true,
      },
    ];
  }, [memberCountByPath, favoritePaths]);

  return { columns, handleSort };
}
