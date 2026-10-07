"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaceRepository } from "@/contexts/workspace-repository-context";
import { workspaceQueryKeys } from "@/lib/services/workspace/workspace-query-keys";
import {
  useSharedWithUser,
  useUserWorkspaces,
} from "@/hooks/services/workspace/use-shared-with-user";
import { cn } from "@/lib/utils";
import {
  buildMiniBrowserItems,
  normalizePath,
  usernameFromWorkspaceRoot,
} from "@/lib/services/workspace/mini-browser-items";
import { isFolderType } from "@/lib/services/workspace/utils";
import { WorkspaceMiniBrowserTable } from "./workspace-mini-browser-table";

export interface WorkspaceMiniBrowserProps {
  initialPath: string;
  onSelectPath: (path: string) => void;
  mode?: "folders-only" | "all";
  showHidden?: boolean;
  selectedPath?: string | null;
  workspaceRoot?: string;
  className?: string;
}

function useMiniBrowserItems({
  currentPath,
  workspaceRoot,
  mode,
  showHidden,
}: {
  currentPath: string;
  workspaceRoot?: string;
  mode: "folders-only" | "all";
  showHidden: boolean;
}) {
  const normalizedCurrent = normalizePath(currentPath);
  const normalizedRoot = workspaceRoot ? normalizePath(workspaceRoot) : "";
  const isAtRoot = !!workspaceRoot && normalizedCurrent === normalizedRoot;
  const username = workspaceRoot
    ? usernameFromWorkspaceRoot(workspaceRoot)
    : "";
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
    queryFn: () => repository.listDirectory({ path: currentPath }),
    enabled: !!currentPath && !isAtRoot,
    staleTime: 60 * 1000,
  });

  const items = buildMiniBrowserItems({
    isAtRoot,
    userWorkspaces: userWorkspacesQuery.data ?? [],
    shared: sharedQuery.data ?? [],
    pathItems: pathQuery.data ?? [],
    mode,
    showHidden,
  });

  return {
    items,
    isAtRoot,
    normalizedCurrent,
    normalizedRoot,
    isLoading: isAtRoot
      ? userWorkspacesQuery.isLoading || sharedQuery.isLoading
      : pathQuery.isLoading,
    error: isAtRoot
      ? (userWorkspacesQuery.error ?? sharedQuery.error)
      : pathQuery.error,
  };
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
  const [prevInitialPath, setPrevInitialPath] = useState(initialPath);
  const [focusedRow, setFocusedRow] = useState<string | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  if (prevInitialPath !== initialPath) {
    setPrevInitialPath(initialPath);
    setCurrentPath(initialPath);
  }

  const {
    items,
    isAtRoot,
    normalizedCurrent,
    normalizedRoot,
    isLoading,
    error,
  } = useMiniBrowserItems({ currentPath, workspaceRoot, mode, showHidden });
  const pathSegments = currentPath.split("/").filter(Boolean);
  const isInSharedFolder =
    !!workspaceRoot &&
    normalizedCurrent !== normalizedRoot &&
    !normalizedCurrent.startsWith(normalizedRoot + "/");
  const showParentRow = !isAtRoot && pathSegments.length > 0;
  const parentRowLabel =
    isInSharedFolder && pathSegments.length <= 2
      ? "Back to my workspaces"
      : "Parent folder";
  const navigableItems = items.filter((item) => isFolderType(item.type));
  const navigationTargets = [
    ...(showParentRow ? ["parent"] : []),
    ...navigableItems.map((item) => normalizePath(item.path)),
  ];

  const navigateTo = (path: string | undefined) => {
    if (!path) return;
    const normalizedPath = normalizePath(path);
    setCurrentPath(normalizedPath);
    setFocusedRow(null);
    onSelectPath(normalizedPath);
  };

  const handleParentClick = () => {
    if (isInSharedFolder && pathSegments.length <= 2) {
      navigateTo(workspaceRoot);
      return;
    }
    const parentSegments = pathSegments.slice(0, -1);
    navigateTo(
      parentSegments.length > 0 ? `/${parentSegments.join("/")}` : "/",
    );
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter") {
      if (focusedRow === "parent") {
        if (!showParentRow) return;
        event.preventDefault();
        handleParentClick();
        return;
      }
      if (!focusedRow && selectedPath == null) return;
      const key = focusedRow ?? normalizePath(selectedPath);
      const focusedItem = navigableItems.find(
        (item) => normalizePath(item.path) === key,
      );
      if (focusedItem) {
        event.preventDefault();
        navigateTo(focusedItem.path);
      }
      return;
    }
    if (
      (event.key !== "ArrowDown" && event.key !== "ArrowUp") ||
      navigationTargets.length === 0
    ) {
      return;
    }

    const selectedKey =
      selectedPath != null ? normalizePath(selectedPath) : null;
    const currentKey =
      focusedRow ?? selectedKey ?? (showParentRow ? "parent" : null);
    const currentIndex = currentKey
      ? navigationTargets.indexOf(currentKey)
      : -1;
    let nextIndex: number;
    if (event.shiftKey) {
      nextIndex = event.key === "ArrowDown" ? navigationTargets.length - 1 : 0;
    } else if (event.key === "ArrowDown") {
      nextIndex =
        currentIndex < 0
          ? 0
          : Math.min(currentIndex + 1, navigationTargets.length - 1);
    } else {
      nextIndex = currentIndex <= 0 ? 0 : currentIndex - 1;
    }

    event.preventDefault();
    const nextKey = navigationTargets[nextIndex];
    setFocusedRow(nextKey);
    if (nextKey !== "parent") onSelectPath(nextKey);
  };

  useEffect(() => {
    const key =
      focusedRow ?? (selectedPath != null ? normalizePath(selectedPath) : null);
    if (!key || !tableContainerRef.current) return;
    const row = tableContainerRef.current.querySelector<HTMLElement>(
      `[data-row-key="${CSS.escape(key)}"]`,
    );
    if (!row) return;
    const id = requestAnimationFrame(() => {
      row.scrollIntoView({ block: "center", inline: "start" });
    });
    return () => {
      cancelAnimationFrame(id);
    };
  }, [focusedRow, selectedPath]);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <WorkspaceMiniBrowserTable
        containerRef={tableContainerRef}
        items={items}
        isLoading={isLoading}
        error={error}
        selectedPath={selectedPath}
        focusedRow={focusedRow}
        showParentRow={showParentRow}
        parentRowLabel={parentRowLabel}
        normalizePath={normalizePath}
        onKeyDown={handleKeyDown}
        onParentClick={handleParentClick}
        onFolderClick={(item) => {
          if (isFolderType(item.type)) onSelectPath(item.path);
        }}
        onFolderDoubleClick={(item) => {
          if (isFolderType(item.type)) navigateTo(item.path);
        }}
      />
    </div>
  );
}
