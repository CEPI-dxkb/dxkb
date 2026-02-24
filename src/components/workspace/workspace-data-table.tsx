"use client";

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
import { encodeWorkspaceSegment } from "@/lib/utils";

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

function TableSkeleton({ showMembersColumn = false }: { showMembersColumn?: boolean }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-40" />
            </div>
          </TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
          {showMembersColumn && (
            <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-16" /></TableCell>
          )}
          <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-28" /></TableCell>
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

export function WorkspaceDataTable({
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
}: WorkspaceDataTableProps) {
  const router = useRouter();
  const isAtRoot = !path || path === "" || path === "/";
  const pathSegments = path ? path.split("/").filter(Boolean) : [];
  const homeBase = username ? `/workspace/${encodeWorkspaceSegment(username)}/home` : "/workspace/home";
  const sharedBase = username ? `/workspace/${encodeWorkspaceSegment(username)}` : "/workspace/shared";
  const sharedRootHref =
    sharedRootUsername != null
      ? `/workspace/${encodeWorkspaceSegment(sharedRootUsername)}`
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
      const segments = item.path.replace(/^\//, "").split("/").filter(Boolean);
      const encoded = segments.map(encodeWorkspaceSegment).join("/");
      router.push(`/workspace/${encoded}`);
    } else {
      const segments = path ? path.split("/").filter(Boolean) : [];
      segments.push(item.name);
      const encoded = segments.map(encodeWorkspaceSegment).join("/");
      router.push(`${homeBase}/${encoded}`);
    }
  }

  function handleParentClick() {
    if (viewMode === "shared") {
      router.push(sharedRootHref);
    } else {
      const segments = path.split("/").filter(Boolean);
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
    viewMode === "shared" ? "Back to my workspace" : "Parent folder";
  const showLeadingRow =
    showViewSharedRow && viewMode === "home" && isAtRoot;

  const showMembersColumn = memberCountByPath != null;
  const sortableColumns: { field: SortField; label: string; className?: string }[] = [
    { field: "name", label: "Name" },
    { field: "size", label: "Size" },
    { field: "owner_id", label: "Owner", className: "hidden md:table-cell" },
    { field: "creation_time", label: "Created", className: "hidden sm:table-cell" },
  ];

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {sortableColumns.map((col) => (
              <TableHead
                key={col.field}
                className={`cursor-pointer select-none ${col.className ?? ""}`}
                onClick={() => handleSort(col.field)}
              >
                {col.label}
                <SortIcon field={col.field} currentSort={sort} />
              </TableHead>
            ))}
            {showMembersColumn && (
              <TableHead className="hidden lg:table-cell">Members</TableHead>
            )}
            <TableHead className="hidden lg:table-cell">Type</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableSkeleton showMembersColumn={showMembersColumn} />
          ) : (
            <>
              {showLeadingRow && (
                <TableRow
                  className="cursor-pointer"
                  onClick={() => router.push(sharedBase)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 shrink-0 text-amber-500" />
                      <span className="text-muted-foreground font-medium italic">
                        View Shared Folders
                      </span>
                    </div>
                  </TableCell>
                  <TableCell />
                  <TableCell className="hidden md:table-cell" />
                  {showMembersColumn && <TableCell className="hidden lg:table-cell" />}
                  <TableCell className="hidden sm:table-cell" />
                  <TableCell className="hidden lg:table-cell" />
                </TableRow>
              )}

              {showParentRow && (
                <TableRow
                  className="cursor-pointer"
                  onClick={handleParentClick}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FolderUp className="h-4 w-4 shrink-0 text-amber-500" />
                      <span className="text-muted-foreground font-medium italic">
                        {parentRowLabel}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell />
                  <TableCell className="hidden md:table-cell" />
                  {showMembersColumn && <TableCell className="hidden lg:table-cell" />}
                  <TableCell className="hidden sm:table-cell" />
                  <TableCell className="hidden lg:table-cell" />
                </TableRow>
              )}

              {items.length === 0 && !isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={showMembersColumn ? 6 : 5}
                    className="text-muted-foreground py-12 text-center"
                  >
                    This folder is empty
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => {
                  const isNavigable = isFolderType(item.type);
                  const memberCount = memberCountByPath?.[item.path];

                  return (
                    <TableRow
                      key={item.id}
                      className={isNavigable ? "cursor-pointer" : ""}
                      onClick={() => isNavigable && handleItemClick(item)}
                    >
                      <TableCell>
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
                      <TableCell className="text-muted-foreground">
                        {formatFileSize(item.size)}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell">
                        {formatOwner(item.owner_id)}
                      </TableCell>
                      {showMembersColumn && (
                        <TableCell className="text-muted-foreground hidden lg:table-cell">
                          {memberCount != null
                            ? formatMemberCount(memberCount)
                            : "—"}
                        </TableCell>
                      )}
                      <TableCell className="text-muted-foreground hidden sm:table-cell">
                        {formatDate(item.creation_time)}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden lg:table-cell">
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
}
