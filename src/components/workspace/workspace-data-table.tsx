"use client";

import React, {
  useCallback,
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { useRouter } from "next/navigation";
import type { Row } from "@tanstack/react-table";
import type {
  WorkspaceBrowserItem,
  WorkspaceBrowserSort,
  WorkspaceViewMode,
} from "@/types/workspace-browser";
import { encodeWorkspaceSegment, sanitizePathSegment } from "@/lib/utils";
import { normalizePath } from "@/lib/workspace/table-selection";
import { isFolderType } from "@/lib/services/workspace/utils";
import { useTableKeyboardNavigation } from "@/hooks/use-table-keyboard-navigation";
import {
  useWorkspaceColumns,
} from "./workspace-table-columns";
import { LeadingRow, ParentRow, DataRow, EmptyRow } from "./workspace-table-rows";
import {
  DataTable,
  type DataTableHandle,
} from "@/components/shared/data-table";

/** Stable empty array for table data fallback (avoids infinite re-renders per TanStack Data guide). */
const EMPTY_ITEMS: WorkspaceBrowserItem[] = [];

const DEFAULT_COLUMN_ORDER = [
  "name",
  "size",
  "owner_id",
  "creation_time",
  "members",
  "type",
];

interface WorkspaceDataTableProps {
  items: WorkspaceBrowserItem[];
  isLoading: boolean;
  path: string;
  sort: WorkspaceBrowserSort;
  onSortChange: (sort: WorkspaceBrowserSort) => void;
  showViewSharedRow?: boolean;
  viewMode?: WorkspaceViewMode;
  memberCountByPath?: Record<string, number>;
  username?: string;
  sharedRootUsername?: string;
  selectedPaths?: string[];
  onSelect?: (
    item: WorkspaceBrowserItem,
    modifiers?: { ctrlOrMeta: boolean; shift: boolean },
  ) => void;
  onItemDoubleClick?: (item: WorkspaceBrowserItem) => void;
  onOpenFileRequested?: (item: WorkspaceBrowserItem) => void;
  onClearSelection?: () => void;
}

export interface WorkspaceDataTableHandle {
  focus: () => void;
}

export const WorkspaceDataTable = forwardRef<
  WorkspaceDataTableHandle,
  WorkspaceDataTableProps
>(function WorkspaceDataTable(
  {
    items,
    isLoading,
    path,
    sort,
    onSortChange,
    showViewSharedRow = false,
    viewMode = "home",
    memberCountByPath,
    username = "",
    sharedRootUsername,
    selectedPaths = [],
    onSelect,
    onItemDoubleClick,
    onOpenFileRequested,
    onClearSelection,
  },
  ref,
) {
  const useSelectionMode = onSelect != null;
  const router = useRouter();
  const dataTableRef = useRef<DataTableHandle>(null);
  const isAtRoot = !path || path === "" || path === "/";

  useImperativeHandle(ref, () => ({
    focus: () => dataTableRef.current?.focus(),
  }));

  const pathSegments = useMemo(
    () =>
      path ? path.split("/").map(sanitizePathSegment).filter(Boolean) : [],
    [path],
  );
  const selectedPathSet = useMemo(
    () => new Set((selectedPaths ?? []).map(normalizePath)),
    [selectedPaths],
  );
  const safeUsername = sanitizePathSegment(username);
  const homeBase = safeUsername
    ? `/workspace/${encodeWorkspaceSegment(safeUsername)}/home`
    : "/workspace/home";
  const sharedBase = safeUsername
    ? `/workspace/${encodeWorkspaceSegment(safeUsername)}`
    : "/workspace/shared";
  const sharedRootHref =
    sharedRootUsername != null
      ? `/workspace/${encodeWorkspaceSegment(sanitizePathSegment(sharedRootUsername))}`
      : sharedBase;

  function handleItemClick(item: WorkspaceBrowserItem) {
    if (!isFolderType(item.type)) return;
    if (viewMode === "shared") {
      const segments = item.path
        .replace(/^\//, "")
        .split("/")
        .map(sanitizePathSegment)
        .filter(Boolean);
      const encoded = segments.map(encodeWorkspaceSegment).join("/");
      router.push(`/workspace/${encoded}`);
    } else {
      const segments = path
        ? path.split("/").map(sanitizePathSegment).filter(Boolean)
        : [];
      segments.push(sanitizePathSegment(item.name));
      const encoded = segments.map(encodeWorkspaceSegment).join("/");
      router.push(`${homeBase}/${encoded}`);
    }
  }

  const handleParentClick = useCallback(() => {
    if (viewMode === "shared") {
      if (pathSegments.length <= 1) {
        router.push(sharedRootHref);
      } else {
        const parentSegments = pathSegments.slice(0, -1);
        const encoded = parentSegments.map(encodeWorkspaceSegment).join("/");
        if (encoded) router.push(`/workspace/${encoded}`);
      }
    } else {
      const segments = path.split("/").map(sanitizePathSegment).filter(Boolean);
      segments.pop();
      const parentPath = segments.map(encodeWorkspaceSegment).join("/");
      router.push(`${homeBase}${parentPath ? `/${parentPath}` : ""}`);
    }
  }, [viewMode, pathSegments, path, sharedRootHref, homeBase, router]);

  const showParentRow =
    viewMode === "shared" ? pathSegments.length >= 1 : !isAtRoot;
  const parentRowLabel =
    viewMode === "shared"
      ? pathSegments.length <= 2
        ? "Back to my workspaces"
        : "Parent folder"
      : "Parent folder";
  const showLeadingRow = showViewSharedRow && viewMode === "home" && isAtRoot;

  const leadingOffset = showLeadingRow ? 1 : 0;
  const parentOffset = showParentRow ? 1 : 0;

  const getFocusedIndex = useCallback(() => {
    const paths = selectedPaths ?? [];
    if (paths.length === 0) return -1;
    const normalizedFocus = normalizePath(paths[paths.length - 1]);
    return items.findIndex((i) => normalizePath(i.path) === normalizedFocus);
  }, [selectedPaths, items]);

  const handleEnter = useCallback(
    (item: WorkspaceBrowserItem) => {
      if (!isFolderType(item.type)) {
        onOpenFileRequested?.(item);
      } else {
        onItemDoubleClick?.(item);
      }
    },
    [onOpenFileRequested, onItemDoubleClick],
  );

  const { focusedSpecialRow, handleKeyDown } = useTableKeyboardNavigation<WorkspaceBrowserItem>({
    items,
    getFocusedIndex,
    onSelect: onSelect ?? (() => {}),
    onEnter: handleEnter,
    enabled: useSelectionMode,
    leadingOffset,
    parentOffset,
    onLeadingEnter: () => router.push(sharedBase),
    onParentEnter: handleParentClick,
    onClearSelection,
  });

  const { columns, handleSort } = useWorkspaceColumns(
    sort,
    onSortChange,
    memberCountByPath,
  );

  // Render workspace-specific leading rows
  const renderLeadingRows = useCallback((columnOrder: string[]) => {
    return (
      <>
        {showLeadingRow && (
          <LeadingRow
            columns={[] as never[]}
            useSelectionMode={useSelectionMode}
            isFocused={focusedSpecialRow === "leading"}
            onClick={() => router.push(sharedBase)}
            _useDataTable
            columnOrder={columnOrder}
          />
        )}
        {showParentRow && (
          <ParentRow
            columns={[] as never[]}
            useSelectionMode={useSelectionMode}
            isFocused={focusedSpecialRow === "parent"}
            onClick={handleParentClick}
            label={parentRowLabel}
            _useDataTable
            columnOrder={columnOrder}
          />
        )}
      </>
    );
  }, [
    showLeadingRow,
    showParentRow,
    useSelectionMode,
    focusedSpecialRow,
    router,
    sharedBase,
    handleParentClick,
    parentRowLabel,
  ]);

  const renderRows = useCallback(
    (rows: Row<WorkspaceBrowserItem>[]) => (
      <>
        {rows.map((row) => (
          <DataRow
            key={row.id}
            row={row}
            useSelectionMode={useSelectionMode}
            isSelected={selectedPathSet.has(
              normalizePath(row.original.path),
            )}
            onSelect={onSelect}
            onItemClick={handleItemClick}
            onItemDoubleClick={onItemDoubleClick}
            onOpenFileRequested={onOpenFileRequested}
          />
        ))}
      </>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleItemClick changes every render (uses path)
    [useSelectionMode, selectedPathSet, onSelect, onItemDoubleClick, onOpenFileRequested, path, viewMode, homeBase],
  );

  const renderEmptyState = useCallback(
    (colSpan: number) => <EmptyRow colSpan={colSpan} />,
    [],
  );

  return (
    <DataTable<WorkspaceBrowserItem>
      ref={dataTableRef}
      data={items ?? EMPTY_ITEMS}
      columns={columns}
      defaultColumnOrder={DEFAULT_COLUMN_ORDER}
      isLoading={isLoading}
      getRowId={(row) => row.id}
      sort={{ field: sort.field, direction: sort.direction }}
      onSort={handleSort}
      dndId="workspace-table-dnd"
      renderLeadingRows={renderLeadingRows}
      renderRows={renderRows}
      renderEmptyState={renderEmptyState}
      onKeyDown={handleKeyDown}
      ariaLabel="Workspace items"
      tabIndex={useSelectionMode ? 0 : undefined}
    />
  );
});
