"use client";

import type { KeyboardEvent, RefObject } from "react";
import { FolderUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import type { WorkspaceItem } from "@/lib/services/workspace/domain";
import {
  formatDate,
  formatFileSize,
  formatOwner,
} from "@/lib/services/workspace/helpers";
import { normalizePath } from "@/lib/services/workspace/mini-browser-items";
import { isFolderType } from "@/lib/services/workspace/utils";
import { WorkspaceItemIcon } from "./workspace-item-icon";

interface WorkspaceMiniBrowserTableProps {
  containerRef: RefObject<HTMLDivElement | null>;
  items: WorkspaceItem[];
  isLoading: boolean;
  error: Error | null;
  /** Row key ("parent" or a normalized path) drawn as selected. */
  highlightedKey: string | null;
  /** Label of the parent row; `null` hides the row. */
  parentRowLabel: string | null;
  ariaLabel: string;
  emptyMessage?: string;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onParentClick: () => void;
  onItemClick: (item: WorkspaceItem) => void;
  onItemDoubleClick: (item: WorkspaceItem) => void;
}

export function WorkspaceMiniBrowserTable({
  containerRef,
  items,
  isLoading,
  error,
  highlightedKey,
  parentRowLabel,
  ariaLabel,
  emptyMessage,
  onKeyDown,
  onParentClick,
  onItemClick,
  onItemDoubleClick,
}: WorkspaceMiniBrowserTableProps) {
  return (
    <div
      ref={containerRef}
      role="region"
      tabIndex={0}
      aria-label={ariaLabel}
      className="scrollbar-themed flex h-full min-h-0 min-w-0 flex-col overflow-auto rounded-md border outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onKeyDown={onKeyDown}
      onPointerDownCapture={() => containerRef.current?.focus()}
    >
      <Table className="min-w-lg" disableScrollWrapper>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-48 pl-3">Name</TableHead>
            <TableHead className="hidden pl-3 sm:table-cell">Size</TableHead>
            <TableHead className="hidden pl-3 md:table-cell">Owner</TableHead>
            <TableHead className="hidden pl-3 lg:table-cell">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {parentRowLabel !== null && (
            <TableRow
              data-row-key="parent"
              className="cursor-pointer"
              data-state={highlightedKey === "parent" ? "selected" : undefined}
              onClick={onParentClick}
            >
              <TableCell className="pl-3" colSpan={4}>
                <div className="flex items-center gap-2">
                  <FolderUp className="size-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {parentRowLabel}
                  </span>
                </div>
              </TableCell>
            </TableRow>
          )}
          {isLoading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={index}>
                <TableCell className="pl-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="size-4" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </TableCell>
                <TableCell className="hidden pl-3 sm:table-cell">
                  <Skeleton className="h-4 w-12" />
                </TableCell>
                <TableCell className="hidden pl-3 md:table-cell">
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell className="hidden pl-3 lg:table-cell">
                  <Skeleton className="h-4 w-24" />
                </TableCell>
              </TableRow>
            ))
          ) : error ? (
            <TableRow>
              <TableCell className="pl-3" colSpan={4}>
                <span className="text-destructive">
                  Failed to load folder contents.
                </span>
              </TableCell>
            </TableRow>
          ) : items.length === 0 && emptyMessage ? (
            <TableRow>
              <TableCell className="pl-3" colSpan={4}>
                <span className="text-sm text-muted-foreground">
                  {emptyMessage}
                </span>
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => {
              const rowKey = normalizePath(item.path);
              return (
                <TableRow
                  key={item.id}
                  data-row-key={rowKey}
                  className="cursor-pointer"
                  data-state={
                    highlightedKey === rowKey ? "selected" : undefined
                  }
                  onClick={() => {
                    onItemClick(item);
                  }}
                  onDoubleClick={() => {
                    onItemDoubleClick(item);
                  }}
                >
                  <TableCell className="pl-3">
                    <div className="flex items-center gap-2">
                      <WorkspaceItemIcon type={item.type} />
                      <span className="truncate text-sm">{item.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden pl-3 sm:table-cell">
                    {isFolderType(item.type) ? "—" : formatFileSize(item.size)}
                  </TableCell>
                  <TableCell className="hidden pl-3 md:table-cell">
                    {formatOwner(item.ownerId ?? "")}
                  </TableCell>
                  <TableCell className="hidden pl-3 lg:table-cell">
                    {formatDate(item.createdAt ?? "")}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
