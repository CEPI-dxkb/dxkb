"use client";

import React, {
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, ArrowDown, ArrowUpDown, FolderUp, Users } from "lucide-react";
import {
  ColumnDef,
  getCoreRowModel,
  useReactTable,
  flexRender,
  type SortingState,
  type Header,
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
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkspaceItemIcon, isFolderType } from "./workspace-item-icon";
import {
  WorkspaceBrowserItem,
  SortField,
  WorkspaceBrowserSort,
} from "@/types/workspace-browser";
import { encodeWorkspaceSegment, sanitizePathSegment } from "@/lib/utils";
import { normalizePath } from "@/lib/workspace/table-selection";

/** Stable empty array for table data fallback (avoids infinite re-renders per TanStack Data guide). */
const EMPTY_ITEMS: WorkspaceBrowserItem[] = [];

export type ViewMode = "home" | "shared";

interface WorkspaceDataTableProps {
  items: WorkspaceBrowserItem[];
  isLoading: boolean;
  path: string;
  sort: WorkspaceBrowserSort;
  onSortChange: (sort: WorkspaceBrowserSort) => void;
  /** When true and viewMode is "home" and at root, show "View Shared Folders" row */
  showViewSharedRow?: boolean;
  /** When "shared", parent row and item navigation use shared routes */
  viewMode?: ViewMode;
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

function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(dateString: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatOwner(ownerId: string): string {
  if (!ownerId) return "";
  return ownerId.replace(/@bvbrc$/, "");
}

function SortIcon({
  field,
  currentSort,
}: {
  field: SortField;
  currentSort: WorkspaceBrowserSort;
}) {
  if (currentSort.field !== field) {
    return (
      <ArrowUpDown className="text-muted-foreground/50 ml-1 inline h-3 w-3" />
    );
  }
  return currentSort.direction === "asc" ? (
    <ArrowUp className="ml-1 inline h-3 w-3" />
  ) : (
    <ArrowDown className="ml-1 inline h-3 w-3" />
  );
}

/** Row height matching real data: TableCell p-2 (8px top/bottom) + 20px content = 36px (h-9). */
const skeletonRowHeight = "h-9";

/** Skeleton rows matching real table column order (Name, Size, Owner, Members, Created, Type). */
function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i} className="pl-6">
          <TableCell className={`pl-6 text-left ${skeletonRowHeight}`}>
            <div className="flex h-5 items-center gap-2">
              <Skeleton className="h-4 w-4 shrink-0 rounded" />
              <Skeleton className="h-4 w-40 shrink-0" />
            </div>
          </TableCell>
          <TableCell
            className={`text-muted-foreground pl-6 text-left ${skeletonRowHeight}`}
          >
            <Skeleton className="h-4 w-14" />
          </TableCell>
          <TableCell
            className={`text-muted-foreground hidden pl-6 text-left md:table-cell ${skeletonRowHeight}`}
          >
            <Skeleton className="h-4 w-20" />
          </TableCell>
          <TableCell
            className={`text-muted-foreground pl-6 text-left ${skeletonRowHeight}`}
          >
            <Skeleton className="h-4 w-16" />
          </TableCell>
          <TableCell
            className={`text-muted-foreground hidden pl-6 text-left sm:table-cell ${skeletonRowHeight}`}
          >
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell
            className={`text-muted-foreground hidden pl-6 text-left lg:table-cell ${skeletonRowHeight}`}
          >
            <Skeleton className="h-4 w-16" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

function formatMemberCount(count: number): string {
  if (count <= 0) return "—";
  if (count === 1) return "Only me";
  return `${count} members`;
}

function DraggableTableHeader({
  header,
  onSort: _onSort,
  sort: _sort,
}: {
  header: Header<WorkspaceBrowserItem, unknown>;
  onSort: (field: SortField) => void;
  sort: WorkspaceBrowserSort;
}) {
  const { attributes, isDragging, listeners, setNodeRef, transform } =
    useSortable({
      id: header.column.id,
    });

  const style: CSSProperties = {
    opacity: isDragging ? 0.8 : 1,
    position: "relative" as const,
    transform: CSS.Translate.toString(transform),
    transition: "width transform 0.2s ease-in-out",
    whiteSpace: "nowrap",
    width: header.column.getSize(),
    zIndex: isDragging ? 1 : 0,
  };

  const meta = header.column.columnDef.meta as
    | { className?: string }
    | undefined;
  const className = clsx("pl-6 relative bg-background", meta?.className ?? "");

  return (
    <TableHead
      ref={setNodeRef}
      colSpan={header.colSpan}
      className={className}
      style={{
        ...style,
        minWidth: style.width,
        maxWidth: style.width,
      }}
    >
      <div className="relative flex w-full items-center justify-between py-0">
        <div className="flex min-w-0 flex-1 cursor-pointer select-none">
          {flexRender(header.column.columnDef.header, header.getContext())}
        </div>
        <button
          type="button"
          className="hover:bg-primary/10 cursor-grab touch-none rounded p-1 active:cursor-grabbing"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          aria-label="Drag to reorder column"
        >
          <span className="text-muted-foreground select-none" aria-hidden>
            ⋮⋮
          </span>
        </button>
        {header.column.getCanResize() && (
          <div
            role="separator"
            aria-orientation="vertical"
            onMouseDown={header.getResizeHandler()}
            onTouchStart={header.getResizeHandler()}
            onDoubleClick={() => header.column.resetSize()}
            className={clsx(
              "border-border absolute top-0 right-0 z-10 h-full w-2 cursor-col-resize border-r",
              "hover:bg-primary/15 hover:border-primary/50",
              header.column.getIsResizing() && "bg-primary/25 border-primary",
            )}
            style={{
              transform: "translateX(50%)",
            }}
          />
        )}
      </div>
    </TableHead>
  );
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

  /** When set, keyboard focus is on a special row (not an item); clear when selection changes */
  const [focusedSpecialRow, setFocusedSpecialRow] = useState<
    "leading" | "parent" | null
  >(null);

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

  // Clear special-row focus when user selects an item (e.g. by clicking)
  useEffect(() => {
    if ((selectedPaths ?? []).length > 0) setFocusedSpecialRow(null);
  }, [selectedPaths]);

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

  const handleSort = useCallback(
    (field: SortField) => {
      if (sort.field === field) {
        onSortChange({
          field,
          direction: sort.direction === "asc" ? "desc" : "asc",
        });
      } else {
        onSortChange({ field, direction: "asc" });
      }
    },
    [sort.field, sort.direction, onSortChange],
  );

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
  const virtualRowCount = leadingOffset + parentOffset + items.length;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!useSelectionMode) return;
      if (virtualRowCount === 0) return;

      const paths = selectedPaths ?? [];
      const focusPath = paths.length > 0 ? paths[paths.length - 1] : null;
      const normalizedFocus = normalizePath(focusPath ?? undefined);
      const currentItemIndex = items.findIndex(
        (i) => normalizePath(i.path) === normalizedFocus,
      );

      let currentVirtual: number;
      if (focusedSpecialRow === "leading") {
        currentVirtual = 0;
      } else if (focusedSpecialRow === "parent") {
        currentVirtual = leadingOffset;
      } else if (currentItemIndex >= 0) {
        currentVirtual = leadingOffset + parentOffset + currentItemIndex;
      } else {
        currentVirtual = -1;
      }

      if (e.key === "Enter") {
        if (focusedSpecialRow === "parent") {
          e.preventDefault();
          handleParentClick();
          return;
        }
        if (focusedSpecialRow === "leading") {
          e.preventDefault();
          router.push(sharedBase);
          return;
        }
        const focusedItem =
          currentItemIndex >= 0 ? items[currentItemIndex] : null;
        if (focusedItem) {
          e.preventDefault();
          if (!isFolderType(focusedItem.type)) {
            onOpenFileRequested?.(focusedItem);
          } else {
            onItemDoubleClick?.(focusedItem);
          }
        }
        return;
      }

      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;

      let nextVirtual: number;
      if (e.shiftKey) {
        nextVirtual =
          e.key === "ArrowDown" ? virtualRowCount - 1 : 0;
      } else if (e.key === "ArrowDown") {
        nextVirtual =
          currentVirtual < 0 ? 0 : Math.min(currentVirtual + 1, virtualRowCount - 1);
      } else {
        nextVirtual =
          currentVirtual <= 0 ? virtualRowCount - 1 : currentVirtual - 1;
      }

      e.preventDefault();

      if (nextVirtual < leadingOffset) {
        setFocusedSpecialRow("leading");
        onClearSelection?.();
        return;
      }
      if (nextVirtual < leadingOffset + parentOffset) {
        setFocusedSpecialRow("parent");
        onClearSelection?.();
        return;
      }
      const nextItemIndex = nextVirtual - leadingOffset - parentOffset;
      const nextItem = items[nextItemIndex];
      if (nextItem != null) {
        setFocusedSpecialRow(null);
        onSelect?.(nextItem, { ctrlOrMeta: false, shift: false });
      }
    },
    [
      useSelectionMode,
      virtualRowCount,
      leadingOffset,
      parentOffset,
      items,
      selectedPaths,
      focusedSpecialRow,
      onSelect,
      onItemDoubleClick,
      onOpenFileRequested,
      onClearSelection,
      sharedBase,
      router,
      handleParentClick,
    ],
  );

  const sortingState: SortingState = useMemo(
    () => [{ id: sort.field, desc: sort.direction === "desc" }],
    [sort.field, sort.direction],
  );

  const columns = useMemo<ColumnDef<WorkspaceBrowserItem>[]>(() => {
    const sortableHeader = (field: SortField, label: string) => (
      <span className="inline-flex items-center gap-1">
        {label}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleSort(field);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleSort(field);
            }
          }}
          className="hover:bg-primary/10 focus-visible:ring-primary cursor-pointer rounded p-0.5 select-none focus:outline-none focus-visible:ring-2"
          aria-label={`Sort by ${label}`}
        >
          <SortIcon field={field} currentSort={sort} />
        </button>
      </span>
    );
    const base: ColumnDef<WorkspaceBrowserItem>[] = [
      {
        id: "name",
        accessorKey: "name",
        header: () => sortableHeader("name", "Name"),
        cell: ({ row }) => {
          const item = row.original;
          const isNavigable = isFolderType(item.type);
          return (
            <div className="flex items-center gap-2">
              <WorkspaceItemIcon type={item.type} />
              <span
                className={isNavigable ? "font-medium hover:underline" : ""}
              >
                {item.name}
              </span>
            </div>
          );
        },
        meta: { className: "" },
        size: 220,
        enableResizing: true,
      },
      {
        id: "size",
        accessorKey: "size",
        header: () => sortableHeader("size", "Size"),
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">
            {formatFileSize(Number(getValue()) || 0)}
          </span>
        ),
        meta: { className: "" },
        size: 90,
        enableResizing: true,
      },
      {
        id: "owner_id",
        accessorKey: "owner_id",
        header: () => sortableHeader("owner_id", "Owner"),
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">
            {formatOwner(String(getValue() ?? ""))}
          </span>
        ),
        meta: { className: "hidden md:table-cell" },
        size: 120,
        enableResizing: true,
      },
      {
        id: "creation_time",
        accessorKey: "creation_time",
        header: () => sortableHeader("creation_time", "Created"),
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">
            {formatDate(String(getValue() ?? ""))}
          </span>
        ),
        meta: { className: "hidden sm:table-cell" },
        size: 120,
        enableResizing: true,
      },
      {
        id: "members",
        header: "Members",
        cell: ({ row }) => {
          const count = memberCountByPath?.[row.original.path];
          return (
            <span className="text-muted-foreground">
              {count != null ? formatMemberCount(count) : "—"}
            </span>
          );
        },
        meta: { className: "" },
        size: 100,
        enableResizing: true,
      },
    ];
    base.push({
      id: "type",
      accessorKey: "type",
      header: () => sortableHeader("type", "Type"),
      cell: ({ getValue }) => (
        <span className="text-muted-foreground">
          {String(getValue() ?? "")}
        </span>
      ),
      meta: { className: "hidden lg:table-cell" },
      size: 90,
      enableResizing: true,
    });
    return base;
  }, [sort, memberCountByPath, handleSort]);

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
                    <TableRow
                      className={
                        (useSelectionMode
                          ? "border-l-2 " +
                            (focusedSpecialRow === "leading"
                              ? "border-l-primary"
                              : "border-l-transparent") +
                            " cursor-pointer pl-6 "
                          : "cursor-pointer pl-6 ") +
                        (focusedSpecialRow === "leading" ? " bg-muted" : "")
                      }
                      onClick={() => router.push(sharedBase)}
                      aria-selected={
                        useSelectionMode && focusedSpecialRow === "leading"
                          ? true
                          : undefined
                      }
                    >
                      {table.getVisibleLeafColumns().map((column) => {
                        const meta = column.columnDef.meta as
                          | { className?: string }
                          | undefined;
                        const className = clsx("pl-6", meta?.className ?? "");
                        return (
                          <TableCell
                            key={column.id}
                            className={className}
                            style={{
                              width: `var(--col-${column.id}-size)`,
                              minWidth: `var(--col-${column.id}-size)`,
                              maxWidth: `var(--col-${column.id}-size)`,
                            }}
                          >
                            {column.id === "name" ? (
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 shrink-0 text-amber-500" />
                                <span className="text-muted-foreground font-medium italic">
                                  View Shared Folders
                                </span>
                              </div>
                            ) : null}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  )}

                  {showParentRow && (
                    <TableRow
                      className={
                        (useSelectionMode
                          ? "border-l-2 " +
                            (focusedSpecialRow === "parent"
                              ? "border-l-primary"
                              : "border-l-transparent") +
                            " cursor-pointer pl-6 "
                          : "cursor-pointer pl-6 ") +
                        (focusedSpecialRow === "parent" ? " bg-muted" : "")
                      }
                      onClick={handleParentClick}
                      aria-selected={
                        useSelectionMode && focusedSpecialRow === "parent"
                          ? true
                          : undefined
                      }
                    >
                      {table.getVisibleLeafColumns().map((column) => {
                        const meta = column.columnDef.meta as
                          | { className?: string }
                          | undefined;
                        const className = clsx("pl-6", meta?.className ?? "");
                        return (
                          <TableCell
                            key={column.id}
                            className={className}
                            style={{
                              width: `var(--col-${column.id}-size)`,
                              minWidth: `var(--col-${column.id}-size)`,
                              maxWidth: `var(--col-${column.id}-size)`,
                            }}
                          >
                            {column.id === "name" ? (
                              <div className="flex items-center gap-2">
                                <FolderUp className="h-4 w-4 shrink-0 text-amber-500" />
                                <span className="text-muted-foreground font-medium italic">
                                  {parentRowLabel}
                                </span>
                              </div>
                            ) : null}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  )}

                  {items.length === 0 && !isLoading ? (
                    <TableRow className="pl-6">
                      <TableCell
                        colSpan={table.getAllLeafColumns().length}
                        className="text-muted-foreground py-12 pl-6 text-center"
                      >
                        This folder is empty
                      </TableCell>
                    </TableRow>
                  ) : (
                    table.getRowModel().rows.map((row) => {
                      const item = row.original;
                      const isNavigable = isFolderType(item.type);
                      const normalizedItemPath = normalizePath(item.path);
                      const isSelected =
                        useSelectionMode &&
                        selectedPathSet.has(normalizedItemPath);

                      function handleRowMouseDown(e: React.MouseEvent) {
                        if (
                          useSelectionMode &&
                          (e.shiftKey || e.ctrlKey || e.metaKey)
                        ) {
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
                          handleItemClick(item);
                        } else {
                          onOpenFileRequested?.(item);
                        }
                      }

                      function handleRowDoubleClick() {
                        if (useSelectionMode) {
                          if (isNavigable) {
                            onItemDoubleClick?.(item);
                          } else {
                            onOpenFileRequested?.(item);
                          }
                        }
                      }

                      return (
                        <TableRow
                          key={row.id}
                          className={
                            (useSelectionMode
                              ? "border-l-2 " +
                                (isSelected
                                  ? "border-l-primary"
                                  : "border-l-transparent")
                              : "") +
                            (useSelectionMode || isNavigable || onOpenFileRequested
                              ? " cursor-pointer pl-6"
                              : " pl-6") +
                            (isSelected ? " bg-muted" : "")
                          }
                          onMouseDown={handleRowMouseDown}
                          onClick={handleRowClick}
                          onDoubleClick={handleRowDoubleClick}
                          title={
                            useSelectionMode && isNavigable
                              ? "Double-click to open folder"
                              : useSelectionMode && !isNavigable && onOpenFileRequested
                                ? "Double-click to open file"
                                : undefined
                          }
                          aria-selected={
                            useSelectionMode ? isSelected : undefined
                          }
                        >
                          {row.getVisibleCells().map((cell) => {
                            const meta = cell.column.columnDef.meta as
                              | { className?: string }
                              | undefined;
                            const className = clsx(
                              "pl-6",
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
                                {flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext(),
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })
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
