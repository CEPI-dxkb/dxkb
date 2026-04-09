"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import type { ListPermissionsResult } from "@/lib/services/workspace/shared";
import { useAuth } from "@/contexts/auth-context";
import { useWorkspacePanel } from "@/contexts/workspace-panel-context";
import { useWorkspaceDialog } from "@/contexts/workspace-dialog-context";
import { useWorkspacePathResolve } from "@/hooks/services/workspace/use-workspace-path-resolve";
import { useWorkspaceData } from "@/hooks/services/workspace/use-workspace-data";
import { useWorkspaceFilteredItems } from "@/hooks/services/workspace/use-workspace-filtered-items";
import { useWorkspaceSelection } from "@/hooks/services/workspace/use-workspace-selection";
import { useWorkspaceNavigation } from "@/hooks/services/workspace/use-workspace-navigation";
import { useWorkspaceActionDispatch } from "@/hooks/services/workspace/use-workspace-action-dispatch";
import { useWorkspaceDialogHandlers } from "@/hooks/services/workspace/use-workspace-dialog-handlers";
import { JobMetadataCard } from "./job-metadata-card";
import { useJobResultData } from "@/hooks/services/workspace/use-job-result-data";
import { useWorkspaceListByPath } from "@/hooks/services/workspace/use-shared-with-user";
import { getDotPathRelative } from "@/lib/services/workspace/helpers";
import { WorkspaceBreadcrumbs } from "./workspace-breadcrumbs";
import { WorkspaceToolbar } from "./workspace-toolbar";
import {
  WorkspaceDataTable,
  type WorkspaceDataTableHandle,
} from "./workspace-file-table";
import { WorkspaceActionBar, type WorkspaceActionId } from "./workspace-action-bar";
import { WorkspaceShell } from "./workspace-shell";
import { WorkspaceDialogs } from "./workspace-dialogs";
import { WorkspaceNotFoundDialog } from "./workspace-not-found-dialog";
import { WorkspaceDownloadMethods } from "@/lib/services/workspace/methods/download";
import { loadFavorites } from "@/lib/services/workspace/favorites";
import { addRecentFolder } from "@/lib/recent-workspace-folders";
import { usePublicWorkspaceData, type PublicWorkspaceLevel } from "@/hooks/services/workspace/use-public-workspace-data";
import { WorkspaceBrowserItem, WorkspaceBrowserSort, type WorkspaceViewMode } from "@/types/workspace-browser";
import { encodeWorkspaceSegment, noop, workspaceUsername } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkspaceApiClient } from "@/lib/services/workspace/client";
import { WorkspaceCrudMethods } from "@/lib/services/workspace/methods/crud";

const emptyItems: WorkspaceBrowserItem[] = [];

interface WorkspaceBrowserProps {
  /** "home" = current user's home; "shared" = shared-with-me / shared folder view; "public" = public browsing */
  mode: WorkspaceViewMode;
  /** Username from URL segment (e.g. workspace/chrescobar/home) */
  username: string;
  path: string;
  /** URL for the workspace guide (env WORKSPACE_GUIDE_URL). Passed from server. */
  workspaceGuideUrl: string;
  /** Optional initial data for shared mode (SSR/prefetch) */
  initialSharedItems?: WorkspaceBrowserItem[];
  initialPathItems?: WorkspaceBrowserItem[];
  initialPermissions?: ListPermissionsResult;
}

export function WorkspaceBrowser({
  mode,
  username,
  path,
  workspaceGuideUrl,
  initialSharedItems,
  initialPathItems,
  initialPermissions,
}: WorkspaceBrowserProps) {
  const router = useRouter();
  const { user } = useAuth();
  const currentUser = user?.username ?? "";
  const fullWorkspaceUsername = workspaceUsername(user);
  const myWorkspaceRoot = fullWorkspaceUsername || currentUser;

  const [authChecked, setAuthChecked] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAuthChecked(true), 800);
    return () => clearTimeout(t);
  }, []);

  const [dismissedPath, setDismissedPath] = useState<string | null>(null);
  const notFoundDismissed = dismissedPath === path;
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const {
    panelManuallyHidden,
    setPanelExpanded,
    showHiddenFiles,
    setShowHiddenFiles,
  } = useWorkspacePanel();
  const { state: dialogState, dispatch: dialogDispatch } = useWorkspaceDialog();

  const workspaceClient = useMemo(() => new WorkspaceApiClient(), []);
  const workspaceCrud = useMemo(
    () => new WorkspaceCrudMethods(workspaceClient),
    [workspaceClient],
  );
  const workspaceDownload = useMemo(
    () => new WorkspaceDownloadMethods(workspaceClient),
    [workspaceClient],
  );
  const queryClient = useQueryClient();
  const { data: favoritePaths = [] } = useQuery({
    queryKey: ["workspace-favorites", myWorkspaceRoot],
    queryFn: () => loadFavorites(myWorkspaceRoot),
    enabled: mode === "home" && !!myWorkspaceRoot,
    staleTime: 2 * 60 * 1000,
  });

  const [sort, setSort] = useState<WorkspaceBrowserSort>({
    field: "name",
    direction: "asc",
  });
  const tableRef = useRef<WorkspaceDataTableHandle>(null);

  const isHome = mode === "home";
  const isPublic = mode === "public";
  const isAtSharedRoot = !isHome && !isPublic && (!path || path === "");
  const fullPath = path ? `/${path}` : "";

  const currentFullPath = useMemo(() => {
    if (!path || path.trim() === "") return "";
    if (isHome) {
      const trimmed = path.replace(/^\/+|\/+$/g, "");
      const userSegment = username.includes("@") ? username : `${username}@bvbrc`;
      return `/${userSegment}/home${trimmed ? `/${trimmed}` : ""}`;
    }
    return fullPath;
  }, [path, isHome, username, fullPath]);

  // Determine the public browsing level for the public data hook
  const publicLevel: PublicWorkspaceLevel = useMemo(() => {
    if (!isPublic) return "root";
    if (!username) return "root";
    // If path has more segments than just the username, we're inside a workspace
    const pathSegments = path ? path.split("/").filter(Boolean) : [];
    return pathSegments.length > 1 ? "path" : "user";
  }, [isPublic, username, path]);

  const publicData = usePublicWorkspaceData({
    level: isPublic ? publicLevel : "root",
    username: isPublic ? username : undefined,
    fullPath: isPublic && publicLevel === "path" ? fullPath : undefined,
  });

  const resolveQuery = useWorkspacePathResolve({
    fullPath: currentFullPath,
    enabled: !isPublic && !!currentFullPath,
  });
  const isJobResultView =
    !isPublic &&
    !!path &&
    path.trim() !== "" &&
    resolveQuery.data?.type === "job_result";

  const authenticatedData = useWorkspaceData({
    mode,
    username,
    path,
    fullPath,
    currentUser,
    isJobResultView,
    isAtSharedRoot,
    pathResolveFailed: resolveQuery.isError,
    initialSharedItems,
    initialPathItems,
    initialPermissions,
  });

  const { dotPath } = useJobResultData({
    resolvedJobMeta: resolveQuery.data ?? null,
    enabled: isJobResultView,
  });
  const dotPathNormalized = dotPath.startsWith("/") ? dotPath : `/${dotPath}`;
  const jobListQuery = useWorkspaceListByPath({
    fullPath: dotPathNormalized,
    enabled: isJobResultView && !!dotPath,
  });

  const { items, isLoading, isFetching, error, refetch, memberCountByPath, currentDirPermissions } =
    isPublic
      ? {
          items: publicData.items,
          isLoading: publicData.isLoading,
          isFetching: publicData.isFetching,
          error: publicData.error,
          refetch: publicData.refetch,
          memberCountByPath: undefined,
          currentDirPermissions: undefined,
        }
      : isJobResultView
        ? {
            items: jobListQuery.data ?? emptyItems,
            isLoading: jobListQuery.isLoading,
            isFetching: jobListQuery.isFetching,
            error: jobListQuery.error,
            refetch: () => void jobListQuery.refetch(),
            memberCountByPath: undefined,
            currentDirPermissions: undefined,
          }
        : authenticatedData;

  const processedItems = useWorkspaceFilteredItems(items, {
    showHiddenFiles: isJobResultView ? true : showHiddenFiles,
    typeFilter: isJobResultView ? "all" : typeFilter,
    searchQuery: isJobResultView ? "" : searchQuery,
    sort,
  });

  const { selectedItems, selectedPaths, primaryItem, handleSelectItem, clearSelection } =
    useWorkspaceSelection({
      processedItems,
      panelManuallyHidden,
      setPanelExpanded,
    });

  const jobResultBasePath = useMemo(() => {
    if (!isJobResultView || !resolveQuery.data) return undefined;
    return getDotPathRelative(path, resolveQuery.data.name);
  }, [isJobResultView, path, resolveQuery.data]);

  const { handleItemDoubleClick } = useWorkspaceNavigation({
    mode,
    username,
    path,
    router,
    clearSelection,
    basePath: jobResultBasePath,
  });

  const { handleAction, isDownloading, isFavoriting } = useWorkspaceActionDispatch({
    currentUser,
    myWorkspaceRoot,
    queryClient,
    workspaceDownload,
    workspaceClient,
    items,
  });

  const currentUserWorkspaceRoot =
    myWorkspaceRoot ? `/${myWorkspaceRoot}` : `/${currentUser}`;
  const currentDirectoryPath = isHome
    ? `${currentUserWorkspaceRoot}/home${fullPath ? fullPath : ""}`
    : fullPath;

  useEffect(() => {
    if (isPublic || !currentDirectoryPath || mode !== "home") return;
    addRecentFolder(currentDirectoryPath, currentUserWorkspaceRoot);
  }, [isPublic, currentDirectoryPath, mode, currentUserWorkspaceRoot]);

  const canWriteToCurrentDir = useMemo(() => {
    if (isPublic || !fullPath) return false;
    // User owns this path (created it themselves)
    let decodedFullPath: string;
    try {
      decodedFullPath = decodeURIComponent(fullPath);
    } catch {
      decodedFullPath = fullPath;
    }
    const isOwnedPath =
      decodedFullPath.startsWith(`/${myWorkspaceRoot}/`) ||
      decodedFullPath.startsWith(`/${currentUser}/`);
    if (isOwnedPath) return true;
    // Folder shared to the user with write access
    if (!currentDirPermissions) return false;
    const perms = currentDirPermissions[decodedFullPath] ?? currentDirPermissions[fullPath];
    if (!perms) return false;
    const writePerms = ["w", "a", "o"];
    return perms.some(
      ([user, perm]) =>
        (user === currentUser || user === fullWorkspaceUsername) &&
        writePerms.includes(perm),
    );
  }, [isPublic, currentDirPermissions, fullPath, currentUser, fullWorkspaceUsername, myWorkspaceRoot]);

  const {
    isDialogLoading,
    handleConfirmDelete,
    handleCopyConfirm,
    handleCreateFolder,
    handleCreateWorkspace,
    handleEditTypeConfirm,
  } = useWorkspaceDialogHandlers({
    workspaceCrud,
    workspaceDownload,
    workspaceClient,
    currentDirectoryPath,
    currentUserWorkspaceRoot,
    username,
    myWorkspaceRoot,
    clearSelection,
  });

  const isCurrentSelectionFavorite =
    primaryItem?.path != null && favoritePaths.includes(primaryItem.path);

  // Restore focus to the table after selection
  useEffect(() => {
    if (selectedItems.length === 0) return;
    const id = setTimeout(() => tableRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, [selectedItems]);

  // After route change (and after loading resolves), focus the table so keyboard navigation works.
  // resolveQuery.isLoading causes an early return that unmounts the ref'd table; guard against that.
  useEffect(() => {
    if (resolveQuery.isLoading) return;
    const id = setTimeout(() => tableRef.current?.focus(), 100);
    return () => clearTimeout(id);
  }, [path, mode, resolveQuery.isLoading]);

  // Redirect non-owner to their own shared root
  const isUrlCurrentUser =
    username === currentUser ||
    username === fullWorkspaceUsername ||
    username === myWorkspaceRoot ||
    (currentUser && username.startsWith(`${currentUser}@`));
  useEffect(() => {
    if (isPublic || isHome || !isAtSharedRoot || !myWorkspaceRoot || isUrlCurrentUser)
      return;
    router.replace(`/workspace/${encodeWorkspaceSegment(myWorkspaceRoot)}`);
  }, [isPublic, isHome, isAtSharedRoot, myWorkspaceRoot, isUrlCurrentUser, username, router]);

  // Detect when the workspace path doesn't exist
  const pathNotFound = useMemo(() => {
    if (isPublic || !path || path.trim() === "") return false;
    // resolveQuery errors when the path doesn't exist at all
    if (resolveQuery.isError) return true;
    // authenticatedData.error when directory listing fails (e.g. deleted between resolve and listing)
    if (error && !resolveQuery.isLoading && !resolveQuery.isError) return true;
    return false;
  }, [isPublic, path, resolveQuery.isError, resolveQuery.isLoading, error]);

  const handleNotFoundConfirm = useCallback(() => {
    router.replace(`/workspace/${encodeWorkspaceSegment(myWorkspaceRoot)}/home`);
  }, [router, myWorkspaceRoot]);

  // --- Early returns ---

  const loadingSkeleton = (viewMode: "home" | "shared") => (
    <div className="flex min-h-[calc(100vh-12rem)] w-full flex-col overflow-hidden">
      <div className="min-w-0 shrink-0 space-y-4 overflow-hidden p-4">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="min-h-0 flex-1">
        <WorkspaceDataTable
          items={[]}
          isLoading={true}
          path={path}
          sort={{ field: "name", direction: "asc" }}
          onSortChange={noop}
          viewMode={viewMode}
          username={username}
        />
      </div>
    </div>
  );

  if (!isPublic && path && path.trim() !== "" && resolveQuery.isLoading && !resolveQuery.isError) {
    return loadingSkeleton(isHome ? "home" : "shared");
  }

  if (!isPublic && !currentUser) {
    if (mode === "shared" && !authChecked) {
      return loadingSkeleton("shared");
    }
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          You must be signed in to access the workspace.
        </AlertDescription>
      </Alert>
    );
  }

  const { activeDialog } = dialogState;
  const disabledAndLoading: WorkspaceActionId[] = [
    ...(isDownloading ? (["download"] as const) : []),
    ...(isDialogLoading && activeDialog?.type === "delete" ? (["delete"] as const) : []),
    ...(isDialogLoading && activeDialog?.type === "copy" ? (["copy", "move"] as const) : []),
    ...(isDialogLoading && activeDialog?.type === "editType" ? (["editType"] as const) : []),
    ...(isFavoriting ? (["favorite"] as const) : []),
  ];

  return (
    <WorkspaceShell
      selectedItems={selectedItems}
      actionBar={
        <WorkspaceActionBar
          selection={selectedItems}
          workspaceGuideUrl={workspaceGuideUrl}
          isCurrentSelectionFavorite={isJobResultView ? false : isCurrentSelectionFavorite}
          disabledActionIds={isJobResultView ? [] : disabledAndLoading}
          loadingActionIds={isJobResultView ? [] : disabledAndLoading}
          readOnly={isPublic}
          onAction={handleAction}
        />
      }
    >
      {!isPublic && !isJobResultView && (
        <WorkspaceDialogs
          currentUserWorkspaceRoot={currentUserWorkspaceRoot}
          currentDirectoryPath={currentDirectoryPath}
          workspaceDownload={workspaceDownload}
          isDialogLoading={isDialogLoading}
          onConfirmDelete={handleConfirmDelete}
          onCopyConfirm={handleCopyConfirm}
          onCreateFolder={handleCreateFolder}
          onCreateWorkspace={handleCreateWorkspace}
          onEditTypeConfirm={handleEditTypeConfirm}
          onRefetch={refetch}
        />
      )}
      <div className="@container min-w-0 shrink-0 space-y-4 overflow-hidden p-4">
        <WorkspaceBreadcrumbs
          path={path}
          username={username}
          itemCount={items.length}
          viewMode={isPublic ? "public" : isHome ? "home" : isAtSharedRoot ? "root" : "shared"}
          currentUsername={currentUser}
          workspaceRootUsername={isHome ? undefined : myWorkspaceRoot}
        />
        <WorkspaceToolbar
          searchQuery={isJobResultView ? "" : searchQuery}
          onSearchChange={isJobResultView ? noop : setSearchQuery}
          typeFilter={isJobResultView ? "all" : typeFilter}
          onTypeFilterChange={isJobResultView ? noop : setTypeFilter}
          onRefresh={() => {
            if (isJobResultView) void resolveQuery.refetch();
            refetch();
          }}
          isRefreshing={isFetching}
          showHiddenFiles={isJobResultView ? true : showHiddenFiles}
          onShowHiddenFilesChange={isJobResultView ? noop : setShowHiddenFiles}
          onNewFolder={!isPublic && !isJobResultView && (isHome || canWriteToCurrentDir) ? () => dialogDispatch({ type: "OPEN_CREATE_FOLDER" }) : undefined}
          onUpload={!isPublic && !isJobResultView && (isHome || canWriteToCurrentDir) ? () => dialogDispatch({ type: "OPEN_UPLOAD" }) : undefined}
          isAtRoot={isAtSharedRoot}
          onNewWorkspace={
            !isPublic && !isJobResultView && isAtSharedRoot ? () => dialogDispatch({ type: "OPEN_CREATE_WORKSPACE" }) : undefined
          }
        />
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {isPublic ? "Failed to load public workspaces" : isHome ? "Failed to load workspace contents" : "Failed to load shared folders"}: {error.message}
            </AlertDescription>
          </Alert>
        )}
      </div>
      {isJobResultView ? (
        <div className="border-border flex min-h-0 flex-1 flex-col gap-4 overflow-hidden pb-4">
          <div className="px-4">
            {resolveQuery.data && <JobMetadataCard resolvedJobMeta={resolveQuery.data} className="px-4" />}
          </div>
          <div className="min-h-0 flex-1">
            <WorkspaceDataTable
              ref={tableRef}
              items={processedItems}
              isLoading={isLoading}
              path={path}
              sort={sort}
              onSortChange={setSort}
              viewMode={isHome ? "home" : "shared"}
              username={username}
              sharedRootUsername={isHome ? undefined : myWorkspaceRoot}
              selectedPaths={selectedPaths}
              onSelect={handleSelectItem}
              onItemDoubleClick={handleItemDoubleClick}
              onClearSelection={clearSelection}
            />
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <WorkspaceDataTable
            ref={tableRef}
            items={processedItems}
            isLoading={isLoading}
            path={path}
            sort={sort}
            onSortChange={setSort}
            viewMode={isPublic ? "public" : isHome ? "home" : "shared"}
            username={username}
            sharedRootUsername={isHome ? undefined : myWorkspaceRoot}
            memberCountByPath={memberCountByPath}
            favoritePaths={isHome ? favoritePaths : undefined}
            selectedPaths={selectedPaths}
            onSelect={handleSelectItem}
            onItemDoubleClick={handleItemDoubleClick}
            onClearSelection={clearSelection}
          />
        </div>
      )}
      <WorkspaceNotFoundDialog
        open={pathNotFound && !notFoundDismissed}
        onOpenChange={(open) => { if (!open) setDismissedPath(path); }}
        onConfirm={handleNotFoundConfirm}
      />
    </WorkspaceShell>
  );
}
