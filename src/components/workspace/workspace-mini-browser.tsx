"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { WorkspaceBrowserItem } from "@/types/workspace-browser";
import { WorkspaceApiClient } from "@/lib/services/workspace/client";
import { cn } from "@/lib/utils";
import { ChevronRight, FolderOpen } from "lucide-react";

const client = new WorkspaceApiClient();

async function fetchListByPath(fullPath: string): Promise<WorkspaceBrowserItem[]> {
  const results = await client.makeRequest<WorkspaceBrowserItem[]>(
    "Workspace.ls",
    [{ paths: [fullPath], includeSubDirs: false, recursive: false }],
  );
  return results ?? [];
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

function formatSize(bytes: number): string {
  if (!bytes || bytes === 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function MiniBrowserBreadcrumbs({
  currentPath,
  onNavigate,
}: {
  currentPath: string;
  onNavigate: (path: string) => void;
}) {
  const segments = currentPath.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  return (
    <nav
      aria-label="Current path"
      className="text-muted-foreground flex flex-wrap items-center gap-1 text-sm"
    >
      {segments.map((segment, index) => {
        const pathUpToHere = "/" + segments.slice(0, index + 1).join("/");
        const isLast = index === segments.length - 1;
        return (
          <span key={pathUpToHere} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onNavigate(pathUpToHere)}
              className={cn(
                "hover:text-foreground truncate max-w-[120px] rounded px-0.5 py-0.5 text-left transition-colors",
                isLast && "text-foreground font-medium",
              )}
              title={pathUpToHere}
            >
              {segment}
            </button>
            {!isLast && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
          </span>
        );
      })}
    </nav>
  );
}

export interface WorkspaceMiniBrowserProps {
  /** Full path (e.g. /user@bvbrc/home) */
  initialPath: string;
  onSelectPath: (path: string) => void;
  mode?: "folders-only" | "all";
  showHidden?: boolean;
  /** Currently selected path for highlight */
  selectedPath?: string | null;
}

export function WorkspaceMiniBrowser({
  initialPath,
  onSelectPath,
  mode = "folders-only",
  showHidden = false,
  selectedPath = null,
}: WorkspaceMiniBrowserProps) {
  const [currentPath, setCurrentPath] = useState(initialPath);

  useEffect(() => {
    setCurrentPath(initialPath);
  }, [initialPath]);

  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ["workspace-mini-browser", currentPath],
    queryFn: () => fetchListByPath(currentPath),
    enabled: !!currentPath,
    staleTime: 60 * 1000,
  });

  const displayItems = useMemo(() => {
    let list = items;
    if (mode === "folders-only") {
      list = list.filter((item) => isFolderType(item.type));
    }
    if (!showHidden) {
      list = list.filter((item) => !item.name.startsWith("."));
    }
    return list.sort((a, b) => {
      const aFolder = isFolderType(a.type);
      const bFolder = isFolderType(b.type);
      if (aFolder !== bFolder) return aFolder ? -1 : 1;
      return (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" });
    });
  }, [items, mode, showHidden]);

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
  };

  const handleFolderDoubleClick = (item: WorkspaceBrowserItem) => {
    if (isFolderType(item.type)) {
      setCurrentPath(item.path);
    }
  };

  const handleFolderClick = (item: WorkspaceBrowserItem) => {
    if (isFolderType(item.type)) {
      onSelectPath(item.path);
    }
  };

  const currentPathNormalized = currentPath.endsWith("/")
    ? currentPath.slice(0, -1)
    : currentPath;
  const isCurrentSelected = selectedPath != null && (
    selectedPath === currentPath ||
    selectedPath === currentPath + "/" ||
    selectedPath + "/" === currentPath ||
    selectedPath === currentPathNormalized
  );

  return (
    <div className="flex flex-col gap-2">
      <MiniBrowserBreadcrumbs currentPath={currentPath} onNavigate={handleNavigate} />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-3">Name</TableHead>
              <TableHead className="hidden pl-3 sm:table-cell">Size</TableHead>
              <TableHead className="hidden pl-3 md:table-cell">Owner</TableHead>
              <TableHead className="hidden pl-3 lg:table-cell">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Row to select current folder as destination */}
            <TableRow
              className={cn(
                "cursor-pointer hover:bg-muted/50",
                isCurrentSelected && "bg-muted",
              )}
              onClick={() => onSelectPath(currentPath)}
            >
              <TableCell className="pl-3" colSpan={4}>
                <div className="flex items-center gap-2">
                  <FolderOpen className="text-amber-500 h-4 w-4 shrink-0" />
                  <span className="text-muted-foreground text-sm">
                    (Current folder)
                  </span>
                </div>
              </TableCell>
            </TableRow>

            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="pl-3">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-4" />
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
                <TableCell className="text-destructive pl-3" colSpan={4}>
                  Failed to load folder contents.
                </TableCell>
              </TableRow>
            ) : (
              displayItems.map((item) => {
                const isSelected =
                  selectedPath != null &&
                  (item.path === selectedPath ||
                    item.path + "/" === selectedPath ||
                    item.path === selectedPath.replace(/\/+$/, ""));
                return (
                  <TableRow
                    key={item.id ?? item.path}
                    className={cn(
                      "cursor-pointer hover:bg-muted/50",
                      isFolderType(item.type) && isSelected && "bg-muted",
                    )}
                    onClick={() => handleFolderClick(item)}
                    onDoubleClick={() => handleFolderDoubleClick(item)}
                  >
                    <TableCell className="pl-3">
                      <div className="flex items-center gap-2">
                        <WorkspaceItemIcon type={item.type} />
                        <span className="truncate text-sm">{item.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden pl-3 sm:table-cell text-sm">
                      {isFolderType(item.type) ? "—" : formatSize(item.size ?? 0)}
                    </TableCell>
                    <TableCell className="hidden pl-3 md:table-cell text-sm">
                      {(item.owner_id ?? "").replace(/@bvbrc$/, "")}
                    </TableCell>
                    <TableCell className="hidden pl-3 lg:table-cell text-sm">
                      {formatDate(item.creation_time ?? "")}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
