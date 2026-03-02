"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useWorkspaceBrowser } from "@/hooks/services/workspace/use-workspace-browser";
import {
  useSharedWithUser,
  useUserWorkspaces,
  useWorkspaceListByPath,
  useWorkspaceGet,
  useWorkspacePermissions,
} from "@/hooks/services/workspace/use-shared-with-user";
import type { ListPermissionsResult } from "@/lib/services/workspace/shared";
import { useAuth } from "@/contexts/auth-context";
import {
  useWorkspacePanel,
  WORKSPACE_PANEL_IDS,
} from "@/contexts/workspace-panel-context";
import { useWorkspacePathResolve } from "@/hooks/services/workspace/use-workspace-path-resolve";
import { WorkspaceJobResultView } from "./workspace-job-result-view";
import { WorkspaceBreadcrumbs } from "./workspace-breadcrumbs";
import { WorkspaceToolbar } from "./workspace-toolbar";
import {
  WorkspaceDataTable,
  type WorkspaceDataTableHandle,
} from "./workspace-data-table";
import { InfoPanel } from "@/components/containers/InfoPanel";
import { WorkspaceActionBar } from "./workspace-action-bar";
import { WorkspaceDownloadMethods } from "@/lib/services/workspace/methods/download";
import { sortItems } from "@/lib/services/workspace/helpers";
import { loadFavorites } from "@/lib/services/workspace/favorites";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkspaceBrowserItem, WorkspaceBrowserSort } from "@/types/workspace-browser";
import { encodeWorkspaceSegment } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { WorkspaceApiClient } from "@/lib/services/workspace/client";
import { WorkspaceCrudMethods } from "@/lib/services/workspace/methods/crud";
import { normalizePath } from "@/lib/workspace/table-selection";
import { useWorkspaceBrowserActions } from "@/hooks/services/workspace/use-workspace-browser-actions";
import { CopyToDialog } from "./copy-to-dialog";
import { CreateFolderDialog } from "./create-folder-dialog";
import { CreateWorkspaceDialog } from "./create-workspace-dialog";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { DownloadOptionsDialog } from "./download-options-dialog";
import { EditTypeDialog } from "./edit-type-dialog";
import { FileViewerConstructionDialog } from "./file-viewer-construction-dialog";
import { UploadDialog } from "./upload-dialog";

export type WorkspaceViewMode = "home" | "shared";

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
    setPanelManuallyHidden,
    panelExpanded,
    setPanelExpanded,
    showHiddenFiles,
    setShowHiddenFiles,
    panelLayout,
    setPanelLayout,
  } = useWorkspacePanel();
  const [selectedItems, setSelectedItems] = useState<WorkspaceBrowserItem[]>([]);
  const [anchorPath, setAnchorPath] = useState<string | null>(null);

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
  const primaryItem = selectedItems[selectedItems.length - 1] ?? null;
  const isCurrentSelectionFavorite =
    primaryItem?.path != null && favoritePaths.includes(primaryItem.path);

  const [sort, setSort] = useState<WorkspaceBrowserSort>({
    field: "name",
    direction: "asc",
  });
  const tableRef = useRef<WorkspaceDataTableHandle>(null);

  const isHome = mode === "home";

  // Restore focus to the table after selection so arrow keys work (runs after panel/layout and any deferred focus)
  useEffect(() => {
    if (selectedItems.length === 0) return;
    const id = setTimeout(() => tableRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, [selectedItems]);

  // After route change (e.g. opening a folder via Enter), focus the table so keyboard navigation works without re-clicking
  useEffect(() => {
    const id = setTimeout(() => tableRef.current?.focus(), 100);
    return () => clearTimeout(id);
  }, [path, mode]);
  const isAtSharedRoot = !isHome && (!path || path === "");
  const fullPath = path ? `/${path}` : "";

  const currentFullPath = useMemo(() => {
    if (!path || path.trim() === "") return "";
    if (isHome) {
      const trimmed = path.replace(/^\/+|\/+$/g, "");
      // Username may already be "user@realm" from URL; do not append @bvbrc again.
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

  const homeQuery = useWorkspaceBrowser({
    username: currentUser,
    path,
    enabled: isHome && !!currentUser && !isJobResultView,
  });

  const sharedQuery = useSharedWithUser({
    username: currentUser,
    enabled: !isHome && isAtSharedRoot && !!currentUser,
    initialData: !isHome && isAtSharedRoot ? initialSharedItems : undefined,
  });

  const userWorkspacesQuery = useUserWorkspaces({
    username: currentUser,
    enabled: !isHome && isAtSharedRoot && !!currentUser,
  });

  const pathQuery = useWorkspaceListByPath({
    fullPath,
    enabled:
      !isHome && !isAtSharedRoot && !!fullPath && !isJobResultView,
    initialData: !isHome && !isAtSharedRoot ? initialPathItems : undefined,
  });

  useWorkspaceGet({
    objectPaths: !isHome && !isAtSharedRoot && fullPath ? [fullPath] : [],
    enabled: !isHome && !isAtSharedRoot && !!fullPath,
  });

  const rootItems = useMemo(() => {
    if (isHome || !isAtSharedRoot) return [];
    const shared = sharedQuery.data ?? [];
    const userData = userWorkspacesQuery.data ?? [];
    const byPath = new Map<string, WorkspaceBrowserItem>();
    for (const item of [...userData, ...shared]) {
      if (!byPath.has(item.path)) byPath.set(item.path, item);
    }
    return Array.from(byPath.values());
  }, [isHome, isAtSharedRoot, sharedQuery.data, userWorkspacesQuery.data]);

  const items = useMemo(
    () =>
      isHome
        ? (homeQuery.data ?? [])
        : isAtSharedRoot
          ? rootItems
          : (pathQuery.data ?? []),
    [
      isHome,
      isAtSharedRoot,
      homeQuery.data,
      rootItems,
      pathQuery.data,
    ]
  );
  const itemPaths = useMemo(() => items.map((i) => i.path), [items]);
  const permissionsQuery = useWorkspacePermissions({
    paths: itemPaths,
    enabled: !isHome && itemPaths.length > 0,
    initialData: !isHome ? initialPermissions : undefined,
  });

  const memberCountByPath = useMemo(() => {
    if (isHome) return undefined;
    const perms = permissionsQuery.data;
    if (!perms) return undefined;
    const out: Record<string, number> = {};
    for (const pathEntry of itemPaths) {
      const list = perms[pathEntry];
      out[pathEntry] = Array.isArray(list) ? list.length : 0;
    }
    return out;
  }, [isHome, permissionsQuery.data, itemPaths]);

  const isLoading = isHome
    ? homeQuery.isLoading
    : isAtSharedRoot
      ? sharedQuery.isLoading || userWorkspacesQuery.isLoading
      : pathQuery.isLoading;
  const error = isHome
    ? homeQuery.error
    : isAtSharedRoot
      ? (sharedQuery.error ?? userWorkspacesQuery.error)
      : pathQuery.error;
  const refetch = isHome
    ? homeQuery.refetch
    : isAtSharedRoot
      ? () => {
          void sharedQuery.refetch();
          void userWorkspacesQuery.refetch();
        }
      : pathQuery.refetch;
  const isFetching = isHome
    ? homeQuery.isFetching
    : isAtSharedRoot
      ? sharedQuery.isFetching || userWorkspacesQuery.isFetching
      : pathQuery.isFetching;

  const processedItems = useMemo(() => {
    let filtered = items;

    if (!showHiddenFiles) {
      filtered = filtered.filter((item) => {
        const name = item.name ?? "";
        const lastSegment = item.path?.split("/").filter(Boolean).pop() ?? "";
        return !name.startsWith(".") && !lastSegment.startsWith(".");
      });
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter((item) => item.type === typeFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((item) =>
        item.name?.toLowerCase().includes(query),
      );
    }

    return sortItems(filtered, sort);
  }, [items, showHiddenFiles, typeFilter, searchQuery, sort]);

  const isUrlCurrentUser =
    username === currentUser ||
    username === fullWorkspaceUsername ||
    username === myWorkspaceRoot ||
    (currentUser && username.startsWith(`${currentUser}@`));
  useEffect(() => {
    if (isHome || !isAtSharedRoot || !myWorkspaceRoot || isUrlCurrentUser)
      return;
    router.replace(`/workspace/${encodeWorkspaceSegment(myWorkspaceRoot)}`);
  }, [
    isHome,
    isAtSharedRoot,
    myWorkspaceRoot,
    isUrlCurrentUser,
    username,
    router,
  ]);

  const currentUserWorkspaceRoot =
    myWorkspaceRoot ? `/${myWorkspaceRoot}` : `/${currentUser}`;
  const currentDirectoryPath = `${currentUserWorkspaceRoot}/home${fullPath ? fullPath : ""}`;

  const actions = useWorkspaceBrowserActions({
    workspaceClient,
    workspaceCrud,
    workspaceDownload,
    queryClient,
    router,
    mode,
    username,
    path,
    currentUser,
    myWorkspaceRoot,
    currentUserWorkspaceRoot,
    currentDirectoryPath,
    items,
    processedItems,
    selectedItems,
    setSelectedItems,
    anchorPath,
    setAnchorPath,
    panelManuallyHidden,
    setPanelExpanded,
    refetch,
    favoritePaths,
  });

  const {
    deleteDialogOpen,
    setDeleteDialogOpen,
    isDeleting,
    pendingDeleteSelection,
    nonEmptyFolderPathsInDelete,
    copyDialogOpen,
    setCopyDialogOpen,
    copyMoveDialogMode,
    pendingCopySelection,
    isCopying,
    editTypeDialogOpen,
    setEditTypeDialogOpen,
    pendingEditTypeItem,
    setPendingEditTypeItem,
    isUpdatingType,
    newFolderDialogOpen,
    setNewFolderDialogOpen,
    isCreatingFolder,
    uploadDialogOpen,
    setUploadDialogOpen,
    downloadOptionsOpen,
    setDownloadOptionsOpen,
    downloadOptionsPaths,
    downloadOptionsDefaultName,
    createWorkspaceDialogOpen,
    setCreateWorkspaceDialogOpen,
    isCreatingWorkspace,
    fileViewerConstructionOpen,
    setFileViewerConstructionOpen,
    isDownloading,
    isFavoriting,
    handleItemDoubleClick,
    handleSelectItem,
    handleAction,
    handleConfirmDelete,
    handleCopyConfirm,
    handleCreateFolder,
    handleCreateWorkspace,
    handleEditTypeConfirm,
  } = actions;

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

  const errorMessage =
    mode === "home"
      ? "Failed to load workspace contents"
      : "Failed to load shared folders";

  const _deleteTargetLabel =
    pendingDeleteSelection.length === 0
      ? "item"
      : pendingDeleteSelection.length === 1
        ? pendingDeleteSelection[0]?.name ?? "item"
        : `${pendingDeleteSelection.length} items`;

  const mainContent = (
    <div>
      <CopyToDialog
        open={copyDialogOpen}
        onOpenChange={setCopyDialogOpen}
        sourceItems={pendingCopySelection}
        currentUserWorkspaceRoot={currentUserWorkspaceRoot}
        onConfirm={handleCopyConfirm}
        isCopying={isCopying}
        mode={copyMoveDialogMode}
      />
      <EditTypeDialog
        open={editTypeDialogOpen}
        onOpenChange={(open) => {
          setEditTypeDialogOpen(open);
          if (!open && !isUpdatingType) setPendingEditTypeItem(null);
        }}
        item={pendingEditTypeItem}
        onConfirm={(newType) => handleEditTypeConfirm(newType)}
        isUpdating={isUpdatingType}
      />
      <CreateFolderDialog
        open={newFolderDialogOpen}
        onOpenChange={setNewFolderDialogOpen}
        onCreateFolder={handleCreateFolder}
        isCreating={isCreatingFolder}
      />
      <CreateWorkspaceDialog
        open={createWorkspaceDialogOpen}
        onOpenChange={setCreateWorkspaceDialogOpen}
        onCreateWorkspace={handleCreateWorkspace}
        isCreating={isCreatingWorkspace}
      />
      <UploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        targetPath={currentDirectoryPath}
        onUploadComplete={() => {
          refetch();
          setUploadDialogOpen(false);
        }}
      />
      <DownloadOptionsDialog
        open={downloadOptionsOpen}
        onOpenChange={setDownloadOptionsOpen}
        paths={downloadOptionsPaths}
        defaultArchiveName={downloadOptionsDefaultName}
        downloadMethods={workspaceDownload}
      />
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        isDeleting={isDeleting}
        pendingDeleteSelection={pendingDeleteSelection}
        nonEmptyFolderPathsInDelete={nonEmptyFolderPathsInDelete}
        onConfirmDelete={handleConfirmDelete}
      />
      <FileViewerConstructionDialog
        open={fileViewerConstructionOpen}
        onOpenChange={setFileViewerConstructionOpen}
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
          onNewFolder={isHome ? () => setNewFolderDialogOpen(true) : undefined}
          onUpload={isHome ? () => setUploadDialogOpen(true) : undefined}
          isAtRoot={isAtSharedRoot}
          onNewWorkspace={
            isAtSharedRoot ? () => setCreateWorkspaceDialogOpen(true) : undefined
          }
        />

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {errorMessage}: {error.message}
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
          selectedPaths={selectedItems.map((i) => normalizePath(i.path))}
          onSelect={handleSelectItem}
          onItemDoubleClick={handleItemDoubleClick}
          onOpenFileRequested={() => setFileViewerConstructionOpen(true)}
          onClearSelection={() => {
            setSelectedItems([]);
            setAnchorPath(null);
          }}
        />
      </div>
    </div>
  );

  const actionStrip = (
    <div className="border-border/50 bg-muted/50 flex h-full w-[80px] shrink-0 flex-col rounded-l-lg border-r py-2">
      <div className="relative mx-0.5 mb-1 h-8 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className={`absolute inset-0 h-full w-full justify-start gap-1 font-normal ${
            panelExpanded ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
          onClick={() => {
            setPanelManuallyHidden(false);
            setPanelExpanded(true);
          }}
          title="Show details panel"
        >
          <PanelRightOpen className="h-4 w-4 shrink-0" />
          Show
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={`absolute inset-0 h-full w-full justify-start gap-1 font-normal ${
            panelExpanded ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={() => {
            setPanelManuallyHidden(true);
            setPanelExpanded(false);
          }}
          title="Hide panel"
        >
          <PanelRightClose className="h-4 w-4 shrink-0" />
          Hide
        </Button>
      </div>
      <div className="scrollbar-themed min-h-0 flex-1 overflow-y-auto px-1.5">
        <WorkspaceActionBar
          selection={selectedItems}
          workspaceGuideUrl={workspaceGuideUrl}
          isCurrentSelectionFavorite={isCurrentSelectionFavorite}
          disabledActionIds={[
            ...(isDownloading ? ["download"] : []),
            ...(isDeleting ? ["delete"] : []),
            ...(isCopying ? ["copy", "move"] : []),
            ...(isUpdatingType ? ["editType"] : []),
            ...(isFavoriting ? ["favorite"] : []),
          ]}
          loadingActionIds={[
            ...(isDownloading ? ["download"] : []),
            ...(isDeleting ? ["delete"] : []),
            ...(isCopying ? ["copy", "move"] : []),
            ...(isUpdatingType ? ["editType"] : []),
            ...(isFavoriting ? ["favorite"] : []),
          ]}
          onAction={handleAction}
        />
      </div>
    </div>
  );

  const detailsPanelContent = selectedItems.length > 0 ? (
    <InfoPanel
      variant="workspace"
      selection={selectedItems}
      onClose={() => {
        setPanelManuallyHidden(true);
        setPanelExpanded(false);
      }}
    />
  ) : (
    <div className="flex h-full w-full flex-col overflow-hidden px-4 py-2">
      <div className="flex items-center justify-between gap-2 border-b pb-2">
        <h3 className="text-muted-foreground truncate text-sm font-semibold">
          Nothing selected
        </h3>
      </div>
      <div className="text-muted-foreground flex flex-1 items-center justify-center py-6 text-center text-sm">
        Select an item to view details
      </div>
    </div>
  );

  if (!panelExpanded) {
    return (
      <div className="flex h-full min-h-0 w-full flex-row gap-0">
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {mainContent}
        </div>
        <aside className="bg-muted/30 flex min-h-full shrink-0 rounded-tl-lg rounded-bl-lg border-l">
          {actionStrip}
        </aside>
      </div>
    );
  }

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="h-full min-h-0 w-full"
      defaultLayout={panelLayout}
      onLayoutChanged={setPanelLayout}
    >
      <ResizablePanel
        id={WORKSPACE_PANEL_IDS.main}
        defaultSize={panelLayout[WORKSPACE_PANEL_IDS.main] ?? 75}
        minSize={50}
        className="flex h-full min-h-0 flex-row overflow-hidden"
      >
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {mainContent}
        </div>
        <aside className="bg-muted/30 flex min-h-full shrink-0 rounded-tl-lg rounded-bl-lg border-l">
          {actionStrip}
        </aside>
      </ResizablePanel>
      <ResizableHandle withHandle className="shrink-0" />
      <ResizablePanel
        id={WORKSPACE_PANEL_IDS.details}
        defaultSize={panelLayout[WORKSPACE_PANEL_IDS.details] ?? 25}
        minSize={110}
        maxSize={600}
        className="flex min-h-0 flex-col overflow-hidden py-2"
      >
        {detailsPanelContent}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
