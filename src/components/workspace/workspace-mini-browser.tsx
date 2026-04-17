"use client";

import {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
  type KeyboardEvent,
} from "react";
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
import { WorkspaceItemIcon } from "./workspace-item-icon";
import { WorkspaceBrowserItem } from "@/types/workspace-browser";
import { useWorkspaceRepository } from "@/contexts/workspace-repository-context";
import { toWorkspaceBrowserItem } from "@/lib/services/workspace/domain";
import { workspaceQueryKeys } from "@/lib/services/workspace/workspace-query-keys";
import { useSharedWithUser, useUserWorkspaces } from "@/hooks/services/workspace/use-shared-with-user";
import { cn } from "@/lib/utils";
import { hasWriteAccess, formatDate, formatFileSize } from "@/lib/services/workspace/helpers";
import { ChevronRight, FolderUp } from "lucide-react";
import { isFolderType, isFolder } from "@/lib/services/workspace/utils";

/** Derive username (e.g. "user") from workspace root path (e.g. "/user@bvbrc"). */
function usernameFromWorkspaceRoot(workspaceRoot: string): string {
  return workspaceRoot.replace(/^\//, "").split("@")[0] ?? "";
}

function normalizePath(path: string | null | undefined): string {
  if (!path) return "/";
  const trimmed = path.replace(/\/+$/, "");
  return trimmed || "/";
}

function _MiniBrowserBreadcrumbs({
  currentPath,
  onNavigate,
  className,
  clickable = true,
}: {
  currentPath: string;
  onNavigate: (path: string) => void;
  className?: string;
  /** When false, breadcrumbs are display-only (e.g. when viewing a shared folder). */
  clickable?: boolean;
}) {
  const segments = currentPath.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  return (
    <nav
      aria-label="Current path"
      className={cn("text-muted-foreground flex flex-wrap items-center gap-1 text-sm", className)}
    >
      {segments.map((segment, index) => {
        const pathUpToHere = "/" + segments.slice(0, index + 1).join("/");
        const isLast = index === segments.length - 1;
        const segmentClassName = cn(
          "truncate max-w-[150px] px-0.5 py-0.5 text-left",
          isLast && "text-foreground font-medium",
        );
        return (
          <span key={pathUpToHere} className="flex items-center gap-1">
            {clickable ? (
              <button
                type="button"
                onClick={() => onNavigate(pathUpToHere)}
                className={cn("hover:text-foreground rounded transition-colors", segmentClassName)}
                title={pathUpToHere}
              >
                {segment}
              </button>
            ) : (
              <span className={segmentClassName} title={pathUpToHere}>
                {segment}
              </span>
            )}
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
  /**
   * When set, at this path the mini browser shows merged user workspaces + shared folders
   * (e.g. "/user@bvbrc"). Enables choosing shared folders as destination.
   */
  workspaceRoot?: string;
  className?: string;
}

export function WorkspaceMiniBrowser({
  initialPath,
  onSelectPath,
  mode = "folders-only",
  showHidden = false,
  selectedPath = null,
  workspaceRoot,
  className,
}: WorkspaceMiniBrowserProps) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [focusedRow, setFocusedRow] = useState<"parent" | string | null>(null);

  useEffect(() => {
    setCurrentPath(initialPath);
  }, [initialPath]);

  const normalizedCurrent = currentPath.replace(/\/+$/, "") || "/";
  const normalizedRoot = workspaceRoot?.replace(/\/+$/, "") ?? "";
  const isAtRoot = !!workspaceRoot && normalizedCurrent === normalizedRoot;

  useEffect(() => {
    onSelectPath(normalizedCurrent);
  }, [normalizedCurrent, onSelectPath]);

  const username = workspaceRoot ? usernameFromWorkspaceRoot(workspaceRoot) : "";

  const userWorkspacesQuery = useUserWorkspaces({
    username,
    enabled: isAtRoot && !!username,
  });
  const sharedQuery = useSharedWithUser({
    username,
    enabled: isAtRoot && !!username,
  });

  const repository = useWorkspaceRepository("authenticated");
  const pathQuery = useQuery({
    queryKey: workspaceQueryKeys.miniBrowser(currentPath),
    queryFn: async () => {
      const items = await repository.listDirectory({ path: currentPath });
      return items.map(toWorkspaceBrowserItem) as WorkspaceBrowserItem[];
    },
    enabled: !!currentPath && !isAtRoot,
    staleTime: 60 * 1000,
  });

  const rootItems = useMemo(() => {
    if (!isAtRoot) return [];
    const userData = userWorkspacesQuery.data ?? [];
    const shared = (sharedQuery.data ?? []).filter(hasWriteAccess);
    const byPath = new Map<string, WorkspaceBrowserItem>();
    for (const item of [...userData, ...shared]) {
      if (!byPath.has(item.path)) byPath.set(item.path, item);
    }
    return Array.from(byPath.values());
  }, [isAtRoot, userWorkspacesQuery.data, sharedQuery.data]);

  const items = useMemo(
    () => (isAtRoot ? rootItems : (pathQuery.data ?? [])),
    [isAtRoot, rootItems, pathQuery.data],
  );
  const isLoading = isAtRoot
    ? userWorkspacesQuery.isLoading || sharedQuery.isLoading
    : pathQuery.isLoading;
  const error = isAtRoot
    ? userWorkspacesQuery.error ?? sharedQuery.error
    : pathQuery.error;

  const displayItems = useMemo(() => {
    let list = items;
    if (mode === "folders-only") {
      list = list.filter((item) => isFolder(item.type ?? ""));
    }
    if (!showHidden) {
      list = list.filter((item) => !(item.name ?? "").startsWith("."));
    }
    const sortCompare = (a: WorkspaceBrowserItem, b: WorkspaceBrowserItem) => {
      const aFolder = isFolderType(a.type);
      const bFolder = isFolderType(b.type);
      if (aFolder !== bFolder) return aFolder ? -1 : 1;
      return (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" });
    };
    return [...list].sort(sortCompare);
  }, [items, mode, showHidden]);

  const _handleNavigate = (path: string) => {
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

  const pathSegments = useMemo(
    () => currentPath.split("/").filter(Boolean),
    [currentPath],
  );
  const isInSharedFolder =
    !!workspaceRoot &&
    normalizedCurrent !== normalizedRoot &&
    !normalizedCurrent.startsWith(normalizedRoot + "/");
  const showParentRow = !isAtRoot && pathSegments.length > 0;
  const parentRowLabel =
    isInSharedFolder && pathSegments.length <= 2
      ? "Back to my workspaces"
      : "Parent folder";

  const handleParentClick = useCallback(() => {
    if (isInSharedFolder && pathSegments.length <= 2) {
      setCurrentPath(workspaceRoot as string);
      return;
    }
    const parentSegments = pathSegments.slice(0, -1);
    const parentPath = parentSegments.length > 0 ? "/" + parentSegments.join("/") : "/";
    setCurrentPath(parentPath);
  }, [isInSharedFolder, pathSegments, workspaceRoot]);

  const _breadcrumbsClickable = !isInSharedFolder;

  const navigableItems = useMemo(
    () => displayItems.filter((item) => isFolderType(item.type)),
    [displayItems],
  );

  const navigationTargets = useMemo<("parent" | string)[]>(
    () => {
      const targets: ("parent" | string)[] = [];
      if (showParentRow) {
        targets.push("parent");
      }
      for (const item of navigableItems) {
        targets.push(normalizePath(item.path));
      }
      return targets;
    },
    [showParentRow, navigableItems],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter") {
        if (focusedRow === "parent") {
          if (!showParentRow) return;
          e.preventDefault();
          handleParentClick();
          return;
        }
        if (!focusedRow && selectedPath == null) return;
        const key = focusedRow ?? normalizePath(selectedPath);
        const focusedItem =
          navigableItems.find(
            (item) => normalizePath(item.path) === key,
          ) ?? null;
        if (focusedItem) {
          e.preventDefault();
          setCurrentPath(focusedItem.path);
        }
        return;
      }

      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      if (navigationTargets.length === 0) return;

      const selectedKey =
        selectedPath != null ? normalizePath(selectedPath) : null;
      const currentKey =
        focusedRow ?? selectedKey ?? (showParentRow ? "parent" : null);

      const currentIndex = currentKey
        ? navigationTargets.indexOf(currentKey)
        : -1;

      let nextIndex: number;
      if (e.shiftKey) {
        nextIndex = e.key === "ArrowDown"
          ? navigationTargets.length - 1
          : 0;
      } else if (e.key === "ArrowDown") {
        nextIndex =
          currentIndex < 0
            ? 0
            : Math.min(currentIndex + 1, navigationTargets.length - 1);
      } else {
        // ArrowUp without Shift: clamp at the first row (no wrapping)
        if (currentIndex <= 0) {
          nextIndex = 0;
        } else {
          nextIndex = currentIndex - 1;
        }
      }

      e.preventDefault();
      const nextKey = navigationTargets[nextIndex];
      setFocusedRow(nextKey);
      if (nextKey === "parent") {
        return;
      }
      onSelectPath(nextKey);
    },
    [
      focusedRow,
      selectedPath,
      navigationTargets,
      showParentRow,
      navigableItems,
      handleParentClick,
      onSelectPath,
    ],
  );

  useEffect(() => {
    if (!tableContainerRef.current) return;

    const key =
      focusedRow ??
      (selectedPath != null ? normalizePath(selectedPath) : null);
    if (!key) return;

    const container = tableContainerRef.current;
    const row = container.querySelector<HTMLElement>(
      `[data-row-key="${CSS.escape(key)}"]`,
    );
    if (!row) return;

    // Defer so DOM has the new focus/selection; use "start" so first row scrolls into view
    const id = requestAnimationFrame(() => {
      row.scrollIntoView({ block: "center", inline: "start"});
    });
    return () => cancelAnimationFrame(id);
  }, [focusedRow, selectedPath]);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* <MiniBrowserBreadcrumbs
        currentPath={currentPath}
        onNavigate={handleNavigate}
        className="px-2 pt-2"
        clickable={breadcrumbsClickable}
      /> */}

      <div
        ref={tableContainerRef}
        role="grid"
        tabIndex={0}
        aria-label="Workspace destination browser"
        className="scrollbar-themed flex h-full min-h-0 flex-col overflow-auto rounded-md border outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onKeyDown={handleKeyDown}
        onPointerDownCapture={() => tableContainerRef.current?.focus()}
      >
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
            {/* Back to my workspaces / Parent folder */}
            {showParentRow && (
              <TableRow
                data-row-key="parent"
                className={cn(
                  "cursor-pointer hover:bg-muted/50",
                  focusedRow === "parent" && "bg-muted",
                )}
                onClick={handleParentClick}
              >
                <TableCell className="pl-3" colSpan={4}>
                  <div className="flex items-center gap-2">
                    <FolderUp className="text-muted-foreground h-4 w-4 shrink-0" />
                    <span className="text-muted-foreground text-sm">
                      {parentRowLabel}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            )}

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
                    data-row-key={normalizePath(item.path)}
                    className={cn(
                      "cursor-pointer hover:bg-muted/50",
                      isFolderType(item.type) &&
                        isSelected &&
                        focusedRow !== "parent" &&
                        "bg-muted",
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
                      {isFolderType(item.type) ? "—" : formatFileSize(item.size ?? 0)}
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
