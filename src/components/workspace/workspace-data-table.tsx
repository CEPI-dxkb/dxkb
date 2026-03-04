"use client";

import React, {
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  getCoreRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  Table,
  TableBody,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  WorkspaceBrowserItem,
  SortField,
  WorkspaceBrowserSort,
  WorkspaceViewMode,
} from "@/types/workspace-browser";
import { encodeWorkspaceSegment, sanitizePathSegment } from "@/lib/utils";
import { normalizePath } from "@/lib/workspace/table-selection";
import { isFolderType } from "@/lib/services/workspace/utils";
import { useTableKeyboardNavigation } from "@/hooks/workspace/use-table-keyboard-navigation";
import {
  DraggableTableHeader,
  TableSkeleton,
  useWorkspaceColumns,
} from "./workspace-table-columns";
import { LeadingRow, ParentRow, DataRow, EmptyRow } from "./workspace-table-rows";

/** Stable empty array for table data fallback (avoids infinite re-renders per TanStack Data guide). */
const EMPTY_ITEMS: WorkspaceBrowserItem[] = [];

interface WorkspaceDataTableProps {
  items: WorkspaceBrowserItem[];
  isLoading: boolean;
  path: string;
  sort: WorkspaceBrowserSort;
  onSortChange: (sort: WorkspaceBrowserSort) => void;
  /** When true and viewMode is "home" and at root, show "View Shared Folders" row */
  showViewSharedRow?: boolean;
  /** When "shared", parent row and item navigation use shared routes */
  viewMode?: WorkspaceViewMode;
  /** Optional map of item path -> member count; Members column is always shown (displays "—" when absent). */
  memberCountByPath?: Record<string, number>;
  /** Username for building workspace URLs (e.g. /workspace/${username}/home) */
  username?: string;
  /** When viewMode is "shared", username for "Back to my workspaces" link (current user) */
  sharedRootUsername?: string;
  /** When set, single click selects (and opens panel); double click navigates. Omit for legacy single-click navigate. */
  selectedPaths?: string[];
  /** Called on single click when selection mode is used; modifiers support Ctrl/Cmd+click (toggle) and Shift+click (range). */
  onSelect?: (
    item: WorkspaceBrowserItem,
    modifiers?: { ctrlOrMeta: boolean; shift: boolean },
  ) => void;
  /** Called on double click (folders only) when selection mode is used; parent should navigate */
  onItemDoubleClick?: (item: WorkspaceBrowserItem) => void;
  /** Called when user tries to open a non-folder item (click, double-click, or Enter); e.g. show "under construction" dialog */
  onOpenFileRequested?: (item: WorkspaceBrowserItem) => void;
  /** Called when focus moves to Parent folder or View Shared row so parent can clear selection */
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
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const isAtRoot = !path || path === "" || path === "/";

  const [columnOrder, setColumnOrder] = useState<string[]>([
    "name",
    "size",
    "owner_id",
    "creation_time",
    "members",
    "type",
  ]);

  useImperativeHandle(ref, () => ({
    focus: () => tableContainerRef.current?.focus(),
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

  const { focusedSpecialRow, handleKeyDown } = useTableKeyboardNavigation({
    useSelectionMode,
    items,
    selectedPaths,
    leadingOffset,
    parentOffset,
    onSelect,
    onItemDoubleClick,
    onOpenFileRequested,
    onClearSelection,
    sharedBase,
    router,
    handleParentClick,
  });

  const { columns, handleSort } = useWorkspaceColumns(
    sort,
    onSortChange,
    memberCountByPath,
  );

  const sortingState: SortingState = useMemo(
    () => [{ id: sort.field, desc: sort.direction === "desc" }],
    [sort.field, sort.direction],
  );

  const table = useReactTable<WorkspaceBrowserItem>({
    data: items ?? EMPTY_ITEMS,
    columns,
    state: {
      sorting: sortingState,
      columnOrder,
    },
    onSortingChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(sortingState) : updater;
      const entry = next?.[0];
      if (entry) {
        onSortChange({
          field: entry.id as SortField,
          direction: entry.desc ? "desc" : "asc",
        });
      }
    },
    onColumnOrderChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(columnOrder) : updater;
      setColumnOrder(next);
    },
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    columnResizeMode: "onChange",
    enableColumnResizing: true,
  });

  const columnSizingState = table.getState().columnSizing;
  const columnSizingInfoState = table.getState().columnSizingInfo;
  // Intentionally depend on sizing state only; table identity changes every render
  const columnSizeVars = useMemo(() => {
    const headers = table.getFlatHeaders();
    const colSizes: Record<string, string> = {};
    for (const header of headers) {
      colSizes[`--col-${header.column.id}-size`] =
        `${header.column.getSize()}px`;
    }
    return colSizes;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- table is unstable from useReactTable
  }, [columnSizingState, columnSizingInfoState]);

  const handleColumnDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setColumnOrder((prev) => {
        const oldIndex = prev.indexOf(active.id as string);
        const newIndex = prev.indexOf(over.id as string);
        if (oldIndex === -1 || newIndex === -1) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {}),
  );

  return (
    <div
      ref={tableContainerRef}
      role="grid"
      tabIndex={useSelectionMode ? 0 : undefined}
      aria-label="Workspace items"
      className="scrollbar-themed h-full min-h-0 overflow-auto rounded-md border outline-none"
      onKeyDown={handleKeyDown}
    >
      <DndContext
        id="workspace-table-dnd"
        collisionDetection={closestCenter}
        modifiers={[restrictToHorizontalAxis]}
        onDragEnd={handleColumnDragEnd}
        sensors={sensors}
      >
        <div className="relative min-w-max" style={columnSizeVars}>
          <Table disableScrollWrapper>
            <TableHeader className="border-border bg-background sticky top-0 z-20 border-b shadow-sm [&_tr]:bg-background">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="bg-background">
                  <SortableContext
                    items={columnOrder}
                    strategy={horizontalListSortingStrategy}
                  >
                    {headerGroup.headers.map((header) => (
                      <DraggableTableHeader
                        key={header.id}
                        header={header}
                        onSort={handleSort}
                        sort={sort}
                      />
                    ))}
                  </SortableContext>
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableSkeleton />
              ) : (
                <>
                  {showLeadingRow && (
                    <LeadingRow
                      columns={table.getVisibleLeafColumns()}
                      useSelectionMode={useSelectionMode}
                      isFocused={focusedSpecialRow === "leading"}
                      onClick={() => router.push(sharedBase)}
                    />
                  )}

                  {showParentRow && (
                    <ParentRow
                      columns={table.getVisibleLeafColumns()}
                      useSelectionMode={useSelectionMode}
                      isFocused={focusedSpecialRow === "parent"}
                      onClick={handleParentClick}
                      label={parentRowLabel}
                    />
                  )}

                  {items.length === 0 && !isLoading ? (
                    <EmptyRow colSpan={table.getAllLeafColumns().length} />
                  ) : (
                    table.getRowModel().rows.map((row) => (
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
                    ))
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </DndContext>
    </div>
  );
});
