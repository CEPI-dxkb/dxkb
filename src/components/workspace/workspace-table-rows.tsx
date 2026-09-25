"use client";

import React from "react";
import { FlexRender, type Row } from "@tanstack/react-table";
import { FolderUp, Users } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import type { WorkspaceItem } from "@/lib/services/workspace/domain";
import { isFolderType } from "@/lib/services/workspace/utils";
import { columnClassMap } from "./workspace-table-columns";
import type { FileTableFeatures } from "@/components/shared/file-table";
import { clsx } from "cn";

interface SpecialRowProps {
  useSelectionMode: boolean;
  isFocused: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  columnOrder: string[];
}

function SpecialRow({
  useSelectionMode,
  isFocused,
  onClick,
  icon: Icon,
  label,
  columnOrder,
}: SpecialRowProps) {
  const cells = columnOrder.map((id) => ({
    id,
    metaClassName: columnClassMap[id] ?? "",
  }));

  return (
    <TableRow
      className="cursor-pointer"
      selectionIndicator={useSelectionMode}
      data-state={isFocused ? "selected" : undefined}
      onClick={onClick}
      aria-selected={useSelectionMode && isFocused ? true : undefined}
    >
      {cells.map((cell) => {
        const className = clsx(
          cell.id === "name" ? "pl-6" : "pl-2",
          // eslint-disable-next-line shadcn/require-static-classes -- column classes come from columnClassMap in workspace-table-columns.tsx, authored as static strings
          cell.metaClassName,
        );
        return (
          <TableCell
            key={cell.id}
            className={className}
            style={{
              width: `var(--col-${cell.id}-size)`,
              minWidth: `var(--col-${cell.id}-size)`,
              maxWidth: `var(--col-${cell.id}-size)`,
            }}
          >
            {cell.id === "name" ? (
              <div className="flex items-center gap-2">
                <Icon className="size-4 shrink-0 text-amber-500" />
                <span className="font-medium text-muted-foreground italic">
                  {label}
                </span>
              </div>
            ) : null}
          </TableCell>
        );
      })}
    </TableRow>
  );
}

export function LeadingRow(
  props: Omit<SpecialRowProps, "icon" | "label"> & { label?: string },
) {
  return <SpecialRow {...props} icon={Users} label={props.label ?? "View Shared Folders"} />;
}

export function ParentRow(
  props: Omit<SpecialRowProps, "icon">,
) {
  return <SpecialRow {...props} icon={FolderUp} />;
}

interface DataRowProps {
  row: Row<FileTableFeatures, WorkspaceItem>;
  useSelectionMode: boolean;
  isSelected: boolean;
  onSelect?: (
    item: WorkspaceItem,
    modifiers?: { ctrlOrMeta: boolean; shift: boolean },
  ) => void;
  onItemClick: (item: WorkspaceItem) => void;
  onItemDoubleClick?: (item: WorkspaceItem) => void;
}

export function DataRow({
  row,
  useSelectionMode,
  isSelected,
  onSelect,
  onItemClick,
  onItemDoubleClick,
}: DataRowProps) {
  const item = row.original;
  const isNavigable = isFolderType(item.type);

  function handleRowMouseDown(e: React.MouseEvent) {
    if (useSelectionMode && (e.shiftKey || e.ctrlKey || e.metaKey)) {
      e.preventDefault();
    }
  }

  function handleRowClick(e: React.MouseEvent) {
    if (useSelectionMode) {
      onSelect?.(item, {
        ctrlOrMeta: e.ctrlKey || e.metaKey,
        shift: e.shiftKey,
      });
    } else if (isNavigable) {
      onItemClick(item);
    }
  }

  function handleRowDoubleClick() {
    if (useSelectionMode && isNavigable) {
      onItemDoubleClick?.(item);
    }
  }

  return (
    <TableRow
      key={row.id}
      className={clsx((useSelectionMode || isNavigable) && "cursor-pointer")}
      selectionIndicator={useSelectionMode}
      data-state={isSelected ? "selected" : undefined}
      onMouseDown={handleRowMouseDown}
      onClick={handleRowClick}
      onDoubleClick={handleRowDoubleClick}
      aria-selected={useSelectionMode ? isSelected : undefined}
    >
      {row.getVisibleCells().map((cell) => {
        // eslint-disable-next-line shadcn/require-static-classes -- column classes come from TanStack column meta, authored as static strings in the column definitions
        const metaCls = cell.column.columnDef.meta?.className;
        const className = clsx(
          cell.column.id === "name" ? "pl-6" : "pl-2",
          "overflow-hidden",
          metaCls ?? "",
        );
        return (
          <TableCell
            key={cell.id}
            className={className}
            style={{
              width: `var(--col-${cell.column.id}-size)`,
              minWidth: `var(--col-${cell.column.id}-size)`,
              maxWidth: `var(--col-${cell.column.id}-size)`,
            }}
          >
            <FlexRender cell={cell} />
          </TableCell>
        );
      })}
    </TableRow>
  );
}

interface EmptyRowProps {
  colSpan: number;
}

export function EmptyRow({ colSpan }: EmptyRowProps) {
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        className="py-12 pl-6 text-center text-muted-foreground"
      >
        This folder is empty
      </TableCell>
    </TableRow>
  );
}
