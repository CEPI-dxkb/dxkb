"use client";

import { useState, useMemo, useEffect, useRef } from "react";
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
import { WorkspaceJobResultView } from "./workspace-job-result-view";
import { WorkspaceBreadcrumbs } from "./workspace-breadcrumbs";
import { WorkspaceToolbar } from "./workspace-toolbar";
import {
  WorkspaceDataTable,
  type WorkspaceDataTableHandle,
} from "./workspace-data-table";
import { WorkspaceActionBar } from "./workspace-action-bar";
import { WorkspaceShell } from "./workspace-shell";
import { WorkspaceDialogs } from "./workspace-dialogs";
import { WorkspaceDownloadMethods } from "@/lib/services/workspace/methods/download";
import { loadFavorites } from "@/lib/services/workspace/favorites";
import { WorkspaceBrowserItem, WorkspaceBrowserSort, type WorkspaceViewMode } from "@/types/workspace-browser";
import { encodeWorkspaceSegment } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkspaceApiClient } from "@/lib/services/workspace/client";
import { WorkspaceCrudMethods } from "@/lib/services/workspace/methods/crud";

interface WorkspaceBrowserProps {
  /** "home" = current user's home; "shared" = shared-with-me / shared folder view */
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
  const fullWorkspaceUsername =
    (user?.realm ? `${user.username}@${user.realm}` : null) ??
    user?.username ??
    "";
  const myWorkspaceRoot = fullWorkspaceUsername || currentUser;

  const [authChecked, setAuthChecked] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAuthChecked(true), 800);
    return () => clearTimeout(t);
  }, []);

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
  });

  const [sort, setSort] = useState<WorkspaceBrowserSort>({
    field: "name",
    direction: "asc",
  });
  const tableRef = useRef<WorkspaceDataTableHandle>(null);

  const isHome = mode === "home";
  const isAtSharedRoot = !isHome && (!path || path === "");
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

  const resolveQuery = useWorkspacePathResolve({
    fullPath: currentFullPath,
    enabled: !!currentFullPath,
  });
  const isJobResultView =
    !!path &&
    path.trim() !== "" &&
    resolveQuery.data?.type === "job_result";

  const { items, isLoading, isFetching, error, refetch, memberCountByPath, currentDirPermissions } =
    useWorkspaceData({
      mode,
      username,
      path,
      fullPath,
      currentUser,
      isJobResultView,
      isAtSharedRoot,
      initialSharedItems,
      initialPathItems,
      initialPermissions,
    });

  const processedItems = useWorkspaceFilteredItems(items, {
    showHiddenFiles,
    typeFilter,
    searchQuery,
    sort,
  });

  const { selectedItems, selectedPaths, primaryItem, handleSelectItem, clearSelection } =
    useWorkspaceSelection({
      processedItems,
      panelManuallyHidden,
      setPanelExpanded,
    });

  const { handleItemDoubleClick } = useWorkspaceNavigation({
    mode,
    username,
    path,
    router,
    clearSelection,
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

  const canWriteToCurrentDir = useMemo(() => {
    if (!fullPath) return false;
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
  }, [currentDirPermissions, fullPath, currentUser, fullWorkspaceUsername, myWorkspaceRoot]);

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
    refetch,
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
    if (isHome || !isAtSharedRoot || !myWorkspaceRoot || isUrlCurrentUser)
      return;
    router.replace(`/workspace/${encodeWorkspaceSegment(myWorkspaceRoot)}`);
  }, [isHome, isAtSharedRoot, myWorkspaceRoot, isUrlCurrentUser, username, router]);

  // --- Early returns ---

  if (path && path.trim() !== "" && resolveQuery.isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-12rem)] w-full flex-col overflow-hidden">
        <div className="min-w-0 shrink-0 space-y-4 overflow-hidden p-4">
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-8 w-full" />
        </div>
        <div className="min-h-0 flex-1 px-4">
          <WorkspaceDataTable
            items={[]}
            isLoading={true}
            path={path}
            sort={{ field: "name", direction: "asc" }}
            onSortChange={() => {}}
            showViewSharedRow={false}
            viewMode={isHome ? "home" : "shared"}
            username={username}
          />
        </div>
      </div>
    );
  }

  if (isJobResultView && resolveQuery.data) {
    return (
      <WorkspaceJobResultView
        path={path}
        username={username}
        viewMode={isHome ? "home" : "shared"}
        resolvedJobMeta={resolveQuery.data}
        workspaceGuideUrl={workspaceGuideUrl}
        currentUser={currentUser}
        myWorkspaceRoot={myWorkspaceRoot}
        onAction={handleAction}
        onRefetch={() => void resolveQuery.refetch()}
      />
    );
  }

  if (!currentUser) {
    if (mode === "shared" && !authChecked) {
      return (
        <div className="flex min-h-[calc(100vh-12rem)] w-full flex-col overflow-hidden">
          <div className="min-w-0 shrink-0 space-y-4 overflow-hidden p-4">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-8 w-full" />
          </div>
          <div>
            <WorkspaceDataTable
              items={[]}
              isLoading={true}
              path={path}
              sort={{ field: "name", direction: "asc" }}
              onSortChange={() => {}}
              showViewSharedRow={false}
              viewMode="shared"
              username={username}
            />
          </div>
        </div>
      );
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
  const disabledAndLoading = [
    ...(isDownloading ? ["download"] : []),
    ...(isDialogLoading && activeDialog?.type === "delete" ? ["delete"] : []),
    ...(isDialogLoading && activeDialog?.type === "copy" ? ["copy", "move"] : []),
    ...(isDialogLoading && activeDialog?.type === "editType" ? ["editType"] : []),
    ...(isFavoriting ? ["favorite"] : []),
  ];

  return (
    <WorkspaceShell
      selectedItems={selectedItems}
      workspaceGuideUrl={workspaceGuideUrl}
      actionBar={
        <WorkspaceActionBar
          selection={selectedItems}
          workspaceGuideUrl={workspaceGuideUrl}
          isCurrentSelectionFavorite={isCurrentSelectionFavorite}
          disabledActionIds={disabledAndLoading}
          loadingActionIds={disabledAndLoading}
          onAction={handleAction}
        />
      }
    >
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
      <div className="min-w-0 shrink-0 space-y-4 overflow-hidden p-4">
        <WorkspaceBreadcrumbs
          path={path}
          username={username}
          itemCount={items.length}
          viewMode={isHome ? "home" : isAtSharedRoot ? "root" : "shared"}
          currentUsername={currentUser}
          workspaceRootUsername={isHome ? undefined : myWorkspaceRoot}
        />
        <WorkspaceToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          onRefresh={() => refetch()}
          isRefreshing={isFetching}
          showHiddenFiles={showHiddenFiles}
          onShowHiddenFilesChange={setShowHiddenFiles}
          onNewFolder={isHome || canWriteToCurrentDir ? () => dialogDispatch({ type: "OPEN_CREATE_FOLDER" }) : undefined}
          onUpload={isHome || canWriteToCurrentDir ? () => dialogDispatch({ type: "OPEN_UPLOAD" }) : undefined}
          isAtRoot={isAtSharedRoot}
          onNewWorkspace={
            isAtSharedRoot ? () => dialogDispatch({ type: "OPEN_CREATE_WORKSPACE" }) : undefined
          }
        />
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {isHome ? "Failed to load workspace contents" : "Failed to load shared folders"}: {error.message}
            </AlertDescription>
          </Alert>
        )}
      </div>
      <div className="min-h-0 flex-1">
        <WorkspaceDataTable
          ref={tableRef}
          items={processedItems}
          isLoading={isLoading}
          path={path}
          sort={sort}
          onSortChange={setSort}
          showViewSharedRow={
            isHome && (!path || path === "" || path === "/" || !path.trim())
          }
          viewMode={isHome ? "home" : "shared"}
          username={username}
          sharedRootUsername={isHome ? undefined : myWorkspaceRoot}
          memberCountByPath={memberCountByPath}
          selectedPaths={selectedPaths}
          onSelect={handleSelectItem}
          onItemDoubleClick={handleItemDoubleClick}
          onOpenFileRequested={() => dialogDispatch({ type: "OPEN_FILE_VIEWER_CONSTRUCTION" })}
          onClearSelection={clearSelection}
        />
      </div>
    </WorkspaceShell>
  );
}
