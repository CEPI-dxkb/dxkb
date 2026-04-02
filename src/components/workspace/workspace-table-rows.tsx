"use client";

import React from "react";
import type { Row } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import { FolderUp, Users } from "lucide-react";
import clsx from "clsx";
import { TableCell, TableRow } from "@/components/ui/table";
import type { WorkspaceBrowserItem } from "@/types/workspace-browser";
import { isFolderType } from "@/lib/services/workspace/utils";
import { columnClassMap } from "./workspace-table-columns";

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
      className={
        (useSelectionMode
          ? "border-l-2 " +
            (isFocused ? "border-l-primary" : "border-l-transparent") +
            " cursor-pointer pl-6 "
          : "cursor-pointer pl-6 ") +
        (isFocused ? " bg-muted" : "")
      }
      onClick={onClick}
      aria-selected={useSelectionMode && isFocused ? true : undefined}
    >
      {cells.map((cell) => {
        const className = clsx(
          cell.id === "name" ? "pl-6" : "pl-2",
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
                <Icon className="h-4 w-4 shrink-0 text-amber-500" />
                <span className="text-muted-foreground font-medium italic">
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
  props: Omit<SpecialRowProps, "icon"> & { label?: string },
) {
  return <SpecialRow {...props} icon={Users} label={props.label ?? "View Shared Folders"} />;
}

export function ParentRow(
  props: Omit<SpecialRowProps, "icon">,
) {
  return <SpecialRow {...props} icon={FolderUp} />;
}

interface DataRowProps {
  row: Row<WorkspaceBrowserItem>;
  useSelectionMode: boolean;
  isSelected: boolean;
  onSelect?: (
    item: WorkspaceBrowserItem,
    modifiers?: { ctrlOrMeta: boolean; shift: boolean },
  ) => void;
  onItemClick: (item: WorkspaceBrowserItem) => void;
  onItemDoubleClick?: (item: WorkspaceBrowserItem) => void;
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
      className={
        (useSelectionMode
          ? "border-l-2 " +
            (isSelected ? "border-l-primary" : "border-l-transparent")
          : "") +
        (useSelectionMode || isNavigable
          ? " cursor-pointer pl-6"
          : " pl-6") +
        (isSelected ? " bg-muted" : "")
      }
      onMouseDown={handleRowMouseDown}
      onClick={handleRowClick}
      onDoubleClick={handleRowDoubleClick}
      aria-selected={useSelectionMode ? isSelected : undefined}
    >
      {row.getVisibleCells().map((cell) => {
        const meta = cell.column.columnDef.meta as
          | { className?: string }
          | undefined;
        const className = clsx(
          cell.column.id === "name" ? "pl-6" : "pl-2",
          "overflow-hidden",
          meta?.className ?? "",
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
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
    <TableRow className="pl-6">
      <TableCell
        colSpan={colSpan}
        className="text-muted-foreground py-12 pl-6 text-center"
      >
        This folder is empty
      </TableCell>
    </TableRow>
  );
}
