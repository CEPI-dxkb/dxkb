"use client";

import { useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, ArrowDown, ArrowUpDown, FolderUp, Users } from "lucide-react";
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
  /** Optional map of item path -> member count; when provided, a "Members" column is shown */
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
    return <ArrowUpDown className="text-muted-foreground/50 ml-1 inline h-3 w-3" />;
  }
  return currentSort.direction === "asc" ? (
    <ArrowUp className="ml-1 inline h-3 w-3" />
  ) : (
    <ArrowDown className="ml-1 inline h-3 w-3" />
  );
}

/** Row height matching real data: TableCell p-2 (8px top/bottom) + 20px content = 36px (h-9). */
const skeletonRowHeight = "h-9";

/** Skeleton rows matching real table column order and dimensions (Name, Size, Owner, Members?, Created, Type). */
function TableSkeleton({ showMembersColumn = true }: { showMembersColumn?: boolean }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i} className="pl-6">
          <TableCell className={`text-left pl-6 ${skeletonRowHeight}`}>
            <div className="flex h-5 items-center gap-2">
              <Skeleton className="h-4 w-4 shrink-0 rounded" />
              <Skeleton className="h-4 w-40 shrink-0" />
            </div>
          </TableCell>
          <TableCell className={`text-muted-foreground text-left pl-6 ${skeletonRowHeight}`}>
            <Skeleton className="h-4 w-14" />
          </TableCell>
          <TableCell className={`text-muted-foreground hidden md:table-cell text-left pl-6 ${skeletonRowHeight}`}>
            <Skeleton className="h-4 w-20" />
          </TableCell>
          {showMembersColumn && (
            <TableCell className={`text-muted-foreground hidden lg:table-cell text-left pl-6 ${skeletonRowHeight}`}>
              <Skeleton className="h-4 w-16" />
            </TableCell>
          )}
          <TableCell className={`text-muted-foreground hidden sm:table-cell text-left pl-6 ${skeletonRowHeight}`}>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell className={`text-muted-foreground hidden lg:table-cell text-left pl-6 ${skeletonRowHeight}`}>
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
  },
  ref,
) {
  const useSelectionMode = onSelect != null;
  const router = useRouter();
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const isAtRoot = !path || path === "" || path === "/";

  useImperativeHandle(ref, () => ({
    focus: () => tableContainerRef.current?.focus(),
  }));

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!useSelectionMode || items.length === 0) return;
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;

      const paths = selectedPaths ?? [];
      const focusPath =
        paths.length > 0 ? paths[paths.length - 1] : null;
      const normalizedFocus = normalizePath(focusPath ?? undefined);
      const currentIndex = items.findIndex(
        (i) => normalizePath(i.path) === normalizedFocus,
      );

      let nextIndex: number;
      if (e.key === "ArrowDown") {
        nextIndex = currentIndex < 0 ? 0 : Math.min(currentIndex + 1, items.length - 1);
      } else {
        nextIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
      }

      const nextItem = items[nextIndex];
      if (nextItem) {
        e.preventDefault();
        onSelect?.(nextItem, { ctrlOrMeta: false, shift: false });
      }
    },
    [useSelectionMode, items, selectedPaths, onSelect],
  );
  const pathSegments = path
    ? path.split("/").map(sanitizePathSegment).filter(Boolean)
    : [];
  const safeUsername = sanitizePathSegment(username);
  const homeBase = safeUsername ? `/workspace/${encodeWorkspaceSegment(safeUsername)}/home` : "/workspace/home";
  const sharedBase = safeUsername ? `/workspace/${encodeWorkspaceSegment(safeUsername)}` : "/workspace/shared";
  const sharedRootHref =
    sharedRootUsername != null
      ? `/workspace/${encodeWorkspaceSegment(sanitizePathSegment(sharedRootUsername))}`
      : sharedBase;

  function handleSort(field: SortField) {
    if (sort.field === field) {
      onSortChange({
        field,
        direction: sort.direction === "asc" ? "desc" : "asc",
      });
    } else {
      onSortChange({ field, direction: "asc" });
    }
  }

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

  function handleParentClick() {
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
  }

  const showParentRow =
    viewMode === "shared"
      ? pathSegments.length >= 1
      : !isAtRoot;
  const parentRowLabel =
    viewMode === "shared"
      ? pathSegments.length <= 2
        ? "Back to my workspaces"
        : "Parent folder"
      : "Parent folder";
  const showLeadingRow =
    showViewSharedRow && viewMode === "home" && isAtRoot;

  const showMembersColumn = memberCountByPath != null;
  /** When loading in shared folder view, show Members column in header/skeleton so layout matches once data loads. */
  const showMembersColumnInUI =
    showMembersColumn || (isLoading && viewMode === "shared" && !isAtRoot);
  const sortableColumns: { field: SortField; label: string; className?: string }[] = [
    { field: "name", label: "Name" },
    { field: "size", label: "Size" },
    { field: "owner_id", label: "Owner", className: "hidden md:table-cell" },
    { field: "creation_time", label: "Created", className: "hidden sm:table-cell" },
  ];

  return (
    <div
      ref={tableContainerRef}
      role="grid"
      tabIndex={useSelectionMode ? 0 : undefined}
      aria-label="Workspace items"
      className="scrollbar-themed h-full min-h-0 overflow-y-auto rounded-md border outline-none"
      onKeyDown={handleKeyDown}
    >
      <Table>
        <TableHeader>
          <TableRow>
            {sortableColumns.map((col) => (
              <TableHead
                key={col.field}
                className={`cursor-pointer select-none pl-6 ${col.className ?? ""}`}
                onClick={() => handleSort(col.field)}
              >
                {col.label}
                <SortIcon field={col.field} currentSort={sort} />
              </TableHead>
            ))}
            {showMembersColumnInUI && (
              <TableHead className="hidden lg:table-cell pl-6">Members</TableHead>
            )}
            <TableHead className="hidden lg:table-cell pl-6">Type</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableSkeleton showMembersColumn={showMembersColumnInUI} />
          ) : (
            <>
              {showLeadingRow && (
                <TableRow
                  className="cursor-pointer pl-6"
                  onClick={() => router.push(sharedBase)}
                >
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 shrink-0 text-amber-500" />
                      <span className="text-muted-foreground font-medium italic">
                        View Shared Folders
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="pl-6" />
                  <TableCell className="hidden md:table-cell pl-6" />
                  {showMembersColumn && <TableCell className="hidden lg:table-cell pl-6" />}
                  <TableCell className="hidden sm:table-cell pl-6" />
                  <TableCell className="hidden lg:table-cell pl-6" />
                </TableRow>
              )}

              {showParentRow && (
                <TableRow
                  className="cursor-pointer pl-6"
                  onClick={handleParentClick}
                >
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-2">
                      <FolderUp className="h-4 w-4 shrink-0 text-amber-500" />
                      <span className="text-muted-foreground font-medium italic">
                        {parentRowLabel}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="pl-6" />
                  <TableCell className="hidden md:table-cell pl-6" />
                  {showMembersColumn && <TableCell className="hidden lg:table-cell pl-6" />}
                  <TableCell className="hidden sm:table-cell pl-6" />
                  <TableCell className="hidden lg:table-cell pl-6" />
                </TableRow>
              )}

              {items.length === 0 && !isLoading ? (
                <TableRow className="pl-6">
                  <TableCell
                    colSpan={showMembersColumn ? 6 : 5}
                    className="text-muted-foreground py-12 text-center pl-6"
                  >
                    This folder is empty
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => {
                  const isNavigable = isFolderType(item.type);
                  const memberCount = memberCountByPath?.[item.path];
                  const normalizedItemPath = normalizePath(item.path);
                  const selectedSet = new Set((selectedPaths ?? []).map(normalizePath));
                  const isSelected =
                    useSelectionMode && selectedSet.has(normalizedItemPath);

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
                      handleItemClick(item);
                    }
                  }

                  function handleRowDoubleClick() {
                    if (useSelectionMode && isNavigable) {
                      onItemDoubleClick?.(item);
                    }
                  }

                  return (
                    <TableRow
                      key={item.id}
                      className={
                        (useSelectionMode ? "border-l-2 " + (isSelected ? "border-l-primary" : "border-l-transparent") : "")
                        + (useSelectionMode || isNavigable ? " cursor-pointer pl-6" : " pl-6")
                        + (isSelected ? " bg-muted" : "")
                      }
                      onMouseDown={handleRowMouseDown}
                      onClick={handleRowClick}
                      onDoubleClick={handleRowDoubleClick}
                      title={
                        useSelectionMode && isNavigable
                          ? "Double-click to open folder"
                          : undefined
                      }
                      aria-selected={useSelectionMode ? isSelected : undefined}
                    >
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-2">
                          <WorkspaceItemIcon type={item.type} />
                          <span
                            className={
                              isNavigable
                                ? "font-medium hover:underline"
                                : ""
                            }
                          >
                            {item.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground pl-6">
                        {formatFileSize(item.size)}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell pl-6">
                        {formatOwner(item.owner_id)}
                      </TableCell>
                      {showMembersColumn && (
                        <TableCell className="text-muted-foreground hidden lg:table-cell pl-6">
                          {memberCount != null
                            ? formatMemberCount(memberCount)
                            : "—"}
                        </TableCell>
                      )}
                      <TableCell className="text-muted-foreground hidden sm:table-cell pl-6">
                        {formatDate(item.creation_time)}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden lg:table-cell pl-6">
                        {item.type}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </>
          )}
        </TableBody>
      </Table>
    </div>
  );
});
