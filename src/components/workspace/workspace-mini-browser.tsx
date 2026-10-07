"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaceRepository } from "@/contexts/workspace-repository-context";
import { workspaceQueryKeys } from "@/lib/services/workspace/workspace-query-keys";
import {
  useSharedWithUser,
  useUserWorkspaces,
} from "@/hooks/services/workspace/use-shared-with-user";
import {
  buildMiniBrowserItems,
  normalizePath,
  usernameFromWorkspaceRoot,
} from "@/lib/services/workspace/mini-browser-items";
import { isFolderType } from "@/lib/services/workspace/utils";
import { WorkspaceMiniBrowserView } from "./workspace-mini-browser-view";

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

  if (prevInitialPath !== initialPath) {
    setPrevInitialPath(initialPath);
    setCurrentPath(initialPath);
  }

  const { items, isAtRoot, normalizedCurrent, normalizedRoot, isLoading, error } =
    useMiniBrowserItems({ currentPath, workspaceRoot, mode, showHidden });
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

  const navigateTo = (path: string | undefined) => {
    if (!path) return;
    const normalizedPath = normalizePath(path);
    setCurrentPath(normalizedPath);
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

  return (
    <WorkspaceMiniBrowserView
      className={className}
      items={items}
      isLoading={isLoading}
      error={error}
      selectedPath={selectedPath}
      parentRowLabel={showParentRow ? parentRowLabel : null}
      onParentClick={handleParentClick}
      isItemNavigable={(item) => isFolderType(item.type)}
      isItemSelectable={(item) => isFolderType(item.type)}
      onNavigate={(item) => {
        navigateTo(item.path);
      }}
      onSelect={(item) => {
        onSelectPath(normalizePath(item.path));
      }}
    />
  );
}
