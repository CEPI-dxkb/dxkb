"use client";

import { useState, useEffect, useRef, useDeferredValue } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import type { ListPermissionsResult } from "@/lib/services/workspace/domain";
import { useAuth } from "@/lib/auth/provider";
import { useUiPreference } from "@/lib/ui-preferences/provider";
import { useWorkspacePanel } from "@/contexts/workspace-panel-context";
import { useWorkspaceDialog } from "@/contexts/workspace-dialog-context";
import { useRetryKeepingError } from "@/components/views/use-retry-keeping-error";
import { useWorkspacePathResolve } from "@/hooks/services/workspace/use-workspace-path-resolve";
import { useWorkspaceDirectory } from "@/hooks/services/workspace/use-workspace-directory";
import { useEnsureUserWorkspace } from "@/hooks/services/workspace/use-ensure-user-workspace";
import { useWorkspaceFilteredItems } from "@/hooks/services/workspace/use-workspace-filtered-items";
import { useWorkspaceSelection } from "@/hooks/services/workspace/use-workspace-selection";
import { useWorkspaceNavigation } from "@/hooks/services/workspace/use-workspace-navigation";
import { useWorkspaceActionDispatch } from "@/hooks/services/workspace/use-workspace-action-dispatch";
import { useWorkspaceDialogHandlers } from "@/hooks/services/workspace/use-workspace-dialog-handlers";
import { useJobResultData } from "@/hooks/services/workspace/use-job-result-data";
import { getDotPathRelative } from "@/lib/services/workspace/helpers";
import {
  buildHomePath,
  canWriteToCurrentDir as computeCanWriteToCurrentDir,
  computeWorkspacePaths,
} from "@/lib/services/workspace/path-utils";
import type { WorkspaceDataTableHandle } from "./workspace-file-table";
import {
  WorkspaceBrowserLoading,
  WorkspaceBrowserPresentation,
} from "./workspace-browser-presentation";
import {
  WorkspaceActionBar,
  type WorkspaceActionId,
} from "./workspace-action-bar";
import { extractAnnotationGenomeId } from "./workspace-job-action-bar";
import { WorkspaceDialogs } from "./workspace-dialogs";
import { WorkspaceNotFoundDialog } from "./workspace-not-found-dialog";
import { loadFavorites } from "@/lib/services/workspace/favorites";
import { workspaceQueryKeys } from "@/lib/services/workspace/workspace-query-keys";
import { addRecentFolder } from "@/lib/recent-workspace-folders";
import { isFolderType } from "@/lib/services/workspace/utils";
import { isWorkspaceObjectMissing } from "@/lib/services/workspace/workspace-errors";
import { type WorkspaceViewMode } from "@/types/workspace-browser";
import { noop } from "@/lib/utils";
import {
  encodeWorkspaceSegment,
  workspaceUsername,
} from "@/lib/services/workspace/path-utils";
import { pickDirectoryMode } from "./workspace-directory-mode";

type PublicWorkspaceLevel = "root" | "user" | "path";

interface WorkspaceBrowserProps {
  mode: WorkspaceViewMode;
  username: string;
  path: string;
  workspaceGuideUrl: string;
  initialPermissions?: ListPermissionsResult;
}

function useWorkspaceBrowser({
  mode,
  username,
  path,
  workspaceGuideUrl,
  initialPermissions,
}: WorkspaceBrowserProps) {
  const router = useRouter();
  const { user } = useAuth();
  const currentUser = user?.username ?? "";
  const fullWorkspaceUsername = workspaceUsername(user);
  const myWorkspaceRoot = fullWorkspaceUsername || currentUser;

  const isUrlCurrentUser =
    username === currentUser ||
    username === fullWorkspaceUsername ||
    username === myWorkspaceRoot ||
    (!!currentUser && username.startsWith(`${currentUser}@`));

  const [authChecked, setAuthChecked] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      setAuthChecked(true);
    }, 800);
    return () => {
      clearTimeout(t);
    };
  }, []);

  const [dismissedPath, setDismissedPath] = useState<string | null>(null);
  const notFoundDismissed = dismissedPath === path;
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const { panelManuallyHidden, setPanelExpanded } = useWorkspacePanel();
  const { state: dialogState, dispatch: dialogDispatch } = useWorkspaceDialog();

  const queryClient = useQueryClient();
  const { data: favoritePaths = [] } = useQuery({
    queryKey: workspaceQueryKeys.favorites(myWorkspaceRoot),
    queryFn: () => loadFavorites(myWorkspaceRoot),
    enabled: mode === "home" && !!myWorkspaceRoot,
    staleTime: 2 * 60 * 1000,
  });

  // Shared by every folder per device; this component is keyed by path, so local state
  // would reset on each folder change.
  const [sort, setSort] = useUiPreference("workspaceSort");
  const [showHiddenFiles, setShowHiddenFiles] = useUiPreference(
    "workspaceShowHiddenFiles",
  );
  const tableRef = useRef<WorkspaceDataTableHandle>(null);

  const isHome = mode === "home";
  const isPublic = mode === "public";
  const isAtSharedRoot = !isHome && !isPublic && (!path || path === "");
  const fullPath = path ? `/${path}` : "";

  const currentFullPath =
    !path || path.trim() === ""
      ? ""
      : isHome
        ? buildHomePath(username, path)
        : fullPath;

  const pathSegments = path ? path.split("/").filter(Boolean) : [];
  const publicLevel: PublicWorkspaceLevel =
    !isPublic || !username ? "root" : pathSegments.length > 1 ? "path" : "user";

  const resolveQuery = useWorkspacePathResolve({
    fullPath: currentFullPath,
    enabled: !isPublic && !!currentFullPath,
  });
  const isJobResultView =
    !isPublic &&
    !!path &&
    path.trim() !== "" &&
    resolveQuery.data?.type === "job_result";

  const { dotPath } = useJobResultData({
    resolvedJobMeta: resolveQuery.data ?? null,
    enabled: isJobResultView,
  });

  const directoryMode = pickDirectoryMode({
    mode,
    username,
    path,
    fullPath,
    currentUser: myWorkspaceRoot,
    isJobResultView,
    isAtSharedRoot,
    isPublic,
    publicLevel,
    jobDotPath: dotPath,
  });
  // Only a path the Workspace says is missing stops the listing; a lookup that failed for
  // another reason (an outage) says nothing about the folder.
  const resolveMissing = isWorkspaceObjectMissing(resolveQuery.error);
  const enabled = !!directoryMode && !resolveMissing;

  const directoryResult = useWorkspaceDirectory(
    directoryMode ?? { kind: "publicRoot" },
    {
      enabled,
      initialPermissions,
    },
  );

  const {
    items: rawItems,
    isLoading,
    isFetching,
    hasLoaded,
    error,
    refetch,
    memberCountByPath,
    permissions: currentDirPermissions,
  } = directoryResult;

  const items = enabled ? rawItems : [];
  const listingError = enabled ? error : null;
  const listingSucceeded = enabled && hasLoaded && !listingError;
  const loadError =
    listingError ?? (listingSucceeded ? null : resolveQuery.error) ?? null;

  const isOwnHome = mode === "home" && isUrlCurrentUser;
  // A failed listing is not an empty home; treating it as one fires the setup writes on
  // every visit during an outage.
  const homeAppearsEmpty =
    isOwnHome && path === "" && listingSucceeded && items.length === 0;
  const { retrySetup } = useEnsureUserWorkspace({
    enabled: isOwnHome,
    userKey: myWorkspaceRoot,
    listError: listingError,
    homeAppearsEmpty,
  });

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const processedItems = useWorkspaceFilteredItems(items, {
    showHiddenFiles: isJobResultView ? true : showHiddenFiles,
    typeFilter: isJobResultView ? "all" : typeFilter,
    searchQuery: isJobResultView ? "" : deferredSearchQuery,
    sort,
  });

  const {
    selectedItems,
    selectedPaths,
    primaryItem,
    handleSelectItem,
    clearSelection,
  } = useWorkspaceSelection({
    processedItems,
    panelManuallyHidden,
    setPanelExpanded,
  });

  const jobResultBasePath =
    isJobResultView && resolveQuery.data
      ? getDotPathRelative(path, resolveQuery.data.name)
      : undefined;

  const { handleItemDoubleClick } = useWorkspaceNavigation({
    mode,
    username,
    path,
    router,
    clearSelection,
    basePath: jobResultBasePath,
  });

  const { handleAction, favoriteMutate, isDownloading, isFavoriting } =
    useWorkspaceActionDispatch({
      currentUser,
      myWorkspaceRoot,
      queryClient,
      items,
      isPublic,
    });

  const { currentDirectoryPath, currentUserWorkspaceRoot } =
    computeWorkspacePaths({
      mode: isPublic ? "public" : isHome ? "home" : "shared",
      username,
      path,
      myWorkspaceRoot,
    });

  // Remember a folder only once it opened as one, not a failed path or a file path.
  const resolvedAsFolder =
    path === "" || isFolderType(resolveQuery.data?.type);
  const openedAsFolder = listingSucceeded && resolvedAsFolder;
  useEffect(() => {
    if (isPublic || !currentDirectoryPath || mode !== "home") return;
    if (!openedAsFolder) return;
    addRecentFolder(currentDirectoryPath, currentUserWorkspaceRoot);
  }, [
    isPublic,
    currentDirectoryPath,
    mode,
    currentUserWorkspaceRoot,
    openedAsFolder,
  ]);

  const canWriteToCurrentDir = computeCanWriteToCurrentDir({
    mode: isPublic ? "public" : isHome ? "home" : "shared",
    fullPath,
    currentUser,
    fullWorkspaceUsername,
    myWorkspaceRoot,
    currentDirPermissions,
  });

  const {
    isDialogLoading,
    handleConfirmDelete,
    handleCopyConfirm,
    handleCreateFolder,
    handleCreateWorkspace,
    handleEditTypeConfirm,
  } = useWorkspaceDialogHandlers({
    currentDirectoryPath,
    currentUserWorkspaceRoot,
    username,
    myWorkspaceRoot,
    clearSelection,
  });

  const isCurrentSelectionFavorite =
    primaryItem != null && favoritePaths.includes(primaryItem.path);

  const homeFolderPath = isHome ? buildHomePath(username, path) : "";

  const isCurrentFolderFavorite =
    isHome && favoritePaths.includes(homeFolderPath);

  const handleToggleCurrentFolderFavorite = isHome
    ? () => { favoriteMutate(homeFolderPath); }
    : undefined;

  useEffect(() => {
    if (selectedItems.length === 0) return;
    const id = setTimeout(() => tableRef.current?.focus(), 50);
    return () => {
      clearTimeout(id);
    };
  }, [selectedItems]);

  useEffect(() => {
    if (resolveQuery.isLoading) return;
    const id = setTimeout(() => tableRef.current?.focus(), 100);
    return () => {
      clearTimeout(id);
    };
  }, [path, mode, resolveQuery.isLoading]);

  useEffect(() => {
    if (
      isPublic ||
      isHome ||
      !isAtSharedRoot ||
      !myWorkspaceRoot ||
      isUrlCurrentUser
    )
      return;
    window.location.replace(
      `/workspace/${encodeWorkspaceSegment(myWorkspaceRoot)}`,
    );
  }, [
    isPublic,
    isHome,
    isAtSharedRoot,
    myWorkspaceRoot,
    isUrlCurrentUser,
    username,
    router,
  ]);

  const pathNotFound =
    !isPublic &&
    !!path &&
    path.trim() !== "" &&
    (resolveMissing ||
      (!resolveQuery.isLoading && isWorkspaceObjectMissing(listingError)));

  const retryLoad = () => {
    if (resolveQuery.isError || isJobResultView) void resolveQuery.refetch();
    refetch();
    // A failed home setup reruns only if the home still looks missing; during an outage
    // this sends nothing.
    retrySetup();
  };
  // Retry and Refresh keep the failure on screen until the refetch answers, instead of the
  // skeletons a query without data falls back to.
  const retry = useRetryKeepingError(
    {
      error: loadError,
      isFetching: isFetching || resolveQuery.isFetching,
      refetch: retryLoad,
    },
    `${mode}:${username}:${path}`,
  );
  const shownError = retry.error instanceof Error ? retry.error : null;
  const keepingError = retry.retrying && shownError !== null;

  const handleNotFoundConfirm = () => {
    router.replace(
      `/workspace/${encodeWorkspaceSegment(myWorkspaceRoot)}/home`,
    );
  };

  if (
    !isPublic &&
    path &&
    path.trim() !== "" &&
    resolveQuery.isLoading &&
    !keepingError
  ) {
    return (
      <WorkspaceBrowserLoading
        path={path}
        username={username}
        viewMode={isHome ? "home" : "shared"}
        sort={sort}
      />
    );
  }

  if (!isPublic && !currentUser) {
    if (mode === "shared" && !authChecked) {
      return (
        <WorkspaceBrowserLoading
          path={path}
          username={username}
          viewMode="shared"
          sort={sort}
        />
      );
    }
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertDescription>
          You must be signed in to access the workspace.
        </AlertDescription>
      </Alert>
    );
  }

  const { activeDialog } = dialogState;
  const disabledAndLoading: WorkspaceActionId[] = [
    ...(isDownloading ? (["download"] as const) : []),
    ...(isDialogLoading && activeDialog?.type === "delete"
      ? (["delete"] as const)
      : []),
    ...(isDialogLoading && activeDialog?.type === "copy"
      ? (["copy", "move"] as const)
      : []),
    ...(isDialogLoading && activeDialog?.type === "editType"
      ? (["editType"] as const)
      : []),
    ...(isFavoriting ? (["favorite"] as const) : []),
  ];

  const canCreateItems =
    !isPublic && !isJobResultView && (isHome || canWriteToCurrentDir);

  return (
    <WorkspaceBrowserPresentation
      selectedItems={selectedItems}
      actionBar={
        <WorkspaceActionBar
          selection={selectedItems}
          workspaceGuideUrl={workspaceGuideUrl}
          isCurrentSelectionFavorite={
            isJobResultView ? false : isCurrentSelectionFavorite
          }
          disabledActionIds={isJobResultView ? [] : disabledAndLoading}
          loadingActionIds={isJobResultView ? [] : disabledAndLoading}
          readOnly={isPublic}
          onAction={handleAction}
        />
      }
      dialogs={
        !isPublic && !isJobResultView ? (
          <WorkspaceDialogs
            currentUserWorkspaceRoot={currentUserWorkspaceRoot}
            currentDirectoryPath={currentDirectoryPath}
            isDialogLoading={isDialogLoading}
            onConfirmDelete={handleConfirmDelete}
            onCopyConfirm={handleCopyConfirm}
            onCreateFolder={handleCreateFolder}
            onCreateWorkspace={handleCreateWorkspace}
            onEditTypeConfirm={handleEditTypeConfirm}
            onRefetch={refetch}
          />
        ) : null
      }
      notFoundDialog={
        <WorkspaceNotFoundDialog
          open={pathNotFound && !notFoundDismissed}
          onOpenChange={(open) => {
            if (!open) setDismissedPath(path);
          }}
          onConfirm={handleNotFoundConfirm}
        />
      }
      path={path}
      username={username}
      itemCount={
        isLoading || (shownError && items.length === 0)
          ? undefined
          : items.length
      }
      currentUsername={currentUser}
      workspaceRootUsername={isHome ? undefined : myWorkspaceRoot}
      toolbar={{
        searchQuery: isJobResultView ? "" : searchQuery,
        onSearchChange: isJobResultView ? noop : setSearchQuery,
        typeFilter: isJobResultView ? "all" : typeFilter,
        onTypeFilterChange: isJobResultView ? noop : setTypeFilter,
        onRefresh: retry.retry,
        isRefreshing: isFetching,
        showHiddenFiles: isJobResultView ? true : showHiddenFiles,
        onShowHiddenFilesChange: isJobResultView ? noop : setShowHiddenFiles,
        onNewFolder: canCreateItems
          ? () => {
              dialogDispatch({ type: "OPEN_CREATE_FOLDER" });
            }
          : undefined,
        onUpload: canCreateItems
          ? () => {
              dialogDispatch({ type: "OPEN_UPLOAD" });
            }
          : undefined,
        onNewWorkspace:
          !isPublic && !isJobResultView && isAtSharedRoot
            ? () => {
                dialogDispatch({ type: "OPEN_CREATE_WORKSPACE" });
              }
            : undefined,
      }}
      error={shownError}
      hasLoadedItems={items.length > 0}
      retrying={keepingError}
      onRetry={retry.retry}
      view={
        isJobResultView
          ? {
              kind: "jobResult",
              source: isHome ? "home" : "shared",
              resolvedJobMeta: resolveQuery.data ?? null,
              annotationGenomeId: resolveQuery.data
                ? extractAnnotationGenomeId(resolveQuery.data, processedItems)
                : null,
            }
          : isPublic
            ? { kind: "public" }
            : isHome
              ? { kind: "home" }
              : { kind: "shared", atRoot: isAtSharedRoot }
      }
      tableRef={tableRef}
      items={processedItems}
      isLoading={isLoading && !keepingError}
      sort={sort}
      onSortChange={setSort}
      sharedRootUsername={isHome ? undefined : myWorkspaceRoot}
      memberCountByPath={memberCountByPath}
      favoritePaths={isHome ? favoritePaths : undefined}
      isCurrentFolderFavorite={isCurrentFolderFavorite}
      isFavoritingCurrentFolder={isFavoriting}
      onToggleCurrentFolderFavorite={handleToggleCurrentFolderFavorite}
      selectedPaths={selectedPaths}
      onSelect={handleSelectItem}
      onItemDoubleClick={handleItemDoubleClick}
      onClearSelection={clearSelection}
    />
  );
}

export function WorkspaceBrowser(props: WorkspaceBrowserProps) {
  return useWorkspaceBrowser(props);
}
