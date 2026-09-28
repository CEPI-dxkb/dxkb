"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  WorkspaceItemIcon,
  type FolderIconVariant,
} from "./workspace-item-icon";
import type { SortField, WorkspaceSortConfig } from "@/types/workspace-browser";
import type { WorkspaceItem } from "@/lib/services/workspace/domain";
import type { FileTableFeatures } from "@/components/shared/file-table";
import {
  formatFileSize,
  formatDate,
  formatOwner,
} from "@/lib/services/workspace/helpers";
import { isFolderType } from "@/lib/services/workspace/utils";

/** Responsive hide classes for each column — shared with special rows (LeadingRow, ParentRow). */
export const columnClassMap: Record<string, string> = {
  name: "",
  size: "",
  ownerId: "hidden md:table-cell",
  createdAt: "hidden sm:table-cell",
  members: "",
  type: "hidden lg:table-cell",
};

export function formatMemberCount(count: number): string {
  if (count <= 0) return "—";
  if (count === 1) return "Only me";
  return `${String(count)} members`;
}

const emptyFavorites: string[] = [];

export function useWorkspaceColumns(
  sort: WorkspaceSortConfig,
  onSortChange: (sort: WorkspaceSortConfig) => void,
  memberCountByPath: Record<string, number> | undefined,
  favoritePaths: string[] = emptyFavorites,
) {
  const handleSort = (field: string) => {
    const sortField = field as SortField;
    if (sort.field === sortField) {
      onSortChange({
        field: sortField,
        direction: sort.direction === "asc" ? "desc" : "asc",
      });
    } else {
      onSortChange({ field: sortField, direction: "asc" });
    }
  };

  // Explicit memo, not left to the React Compiler: this hook calls no other
  // hook, so the compiler's "infer" mode skips it. FlexRender renders each
  // `cell` as a component type, so rebuilding the columns remounts every cell
  // on each render — which detaches the node under the cursor after a row
  // click and stops the browser from firing `dblclick`.
  const columns = useMemo<ColumnDef<FileTableFeatures, WorkspaceItem>[]>(() => {
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
            if (item.permissions?.global === "r") variant = "public";
            else if (favoriteSet.has(item.path)) variant = "favorite";
            else if ((memberCountByPath?.[item.path] ?? 0) > 1)
              variant = "shared";
          }
          return (
            <div className="flex min-w-0 items-center gap-2 overflow-hidden">
              <WorkspaceItemIcon
                type={item.type}
                variant={variant}
                className="shrink-0"
              />
              <span
                className={`truncate ${isNavigable ? "font-medium hover:underline" : ""}`}
                title={item.name}
              >
                {item.name}
              </span>
            </div>
          );
        },
        meta: {
          className: columnClassMap.name,
          sortField: "name",
        },
        size: 220,
        enableResizing: true,
      },
      {
        id: "size",
        accessorKey: "size",
        header: "Size",
        cell: ({ getValue }) => (
          <span className="block truncate text-muted-foreground">
            {formatFileSize(Number(getValue()) || 0)}
          </span>
        ),
        meta: {
          className: columnClassMap.size,
          sortField: "size",
        },
        size: 50,
        enableResizing: true,
      },
      {
        id: "ownerId",
        accessorKey: "ownerId",
        header: "Owner",
        cell: ({ getValue }) => (
          <span className="block truncate text-muted-foreground">
            {formatOwner((getValue() as string | undefined) ?? "")}
          </span>
        ),
        meta: {
          className: columnClassMap.ownerId,
          sortField: "ownerId",
        },
        size: 70,
        enableResizing: true,
      },
      {
        id: "createdAt",
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ getValue }) => (
          <span className="block truncate text-muted-foreground">
            {formatDate((getValue() as string | undefined) ?? "")}
          </span>
        ),
        meta: {
          className: columnClassMap.createdAt,
          sortField: "createdAt",
        },
        size: 80,
        enableResizing: true,
      },
      {
        id: "members",
        header: "Members",
        cell: ({ row }) => {
          const count = memberCountByPath?.[row.original.path];
          return (
            <span className="block truncate text-muted-foreground">
              {count != null ? formatMemberCount(count) : "—"}
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
          <span className="block truncate text-muted-foreground">
            {(getValue() as string | undefined) ?? ""}
          </span>
        ),
        meta: {
          className: columnClassMap.type,
          sortField: "type",
        },
        size: 60,
        enableResizing: true,
      },
    ];
  }, [favoritePaths, memberCountByPath]);

  return { columns, handleSort };
}
