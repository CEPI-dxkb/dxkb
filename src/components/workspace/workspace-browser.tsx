"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
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
import { WorkspaceBreadcrumbs } from "./workspace-breadcrumbs";
import { WorkspaceToolbar } from "./workspace-toolbar";
import {
  WorkspaceDataTable,
  type WorkspaceDataTableHandle,
} from "./workspace-data-table";
import { InfoPanel } from "@/components/containers/InfoPanel";
import { WorkspaceActionBar } from "./workspace-action-bar";
import { isFolderType } from "./workspace-item-icon";
import { getDownloadUrls } from "@/lib/services/workspace/methods/download";
import {
  loadFavorites,
  toggleFavorite,
} from "@/lib/services/workspace/favorites";
import { forbiddenDownloadTypes } from "@/lib/services/workspace/types";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkspaceBrowserItem, WorkspaceBrowserSort } from "@/types/workspace-browser";
import { encodeWorkspaceSegment, sanitizePathSegment } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CopyToDialog } from "./copy-to-dialog";
import { CreateFolderDialog } from "./create-folder-dialog";
import { UploadDialog } from "./upload-dialog";
import { EditTypeDialog } from "./edit-type-dialog";
import { WorkspaceApiClient } from "@/lib/services/workspace/client";
import { WorkspaceCrudMethods } from "@/lib/services/workspace/methods/crud";

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

function sortItems(
  items: WorkspaceBrowserItem[],
  sort: WorkspaceBrowserSort,
): WorkspaceBrowserItem[] {
  return [...items].sort((a, b) => {
    const aIsFolder = isFolderType(a.type);
    const bIsFolder = isFolderType(b.type);
    if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;

    let comparison = 0;
    switch (sort.field) {
      case "name":
        comparison = a.name.localeCompare(b.name, undefined, {
          sensitivity: "base",
        });
        break;
      case "size":
        comparison = (a.size ?? 0) - (b.size ?? 0);
        break;
      case "owner_id":
        comparison = (a.owner_id ?? "").localeCompare(b.owner_id ?? "");
        break;
      case "creation_time":
        comparison = (a.timestamp ?? 0) - (b.timestamp ?? 0);
        break;
      case "type":
        comparison = a.type.localeCompare(b.type);
        break;
      default:
        comparison = 0;
    }

    return sort.direction === "asc" ? comparison : -comparison;
  });
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
  const [selectedItem, setSelectedItem] = useState<WorkspaceBrowserItem | null>(
    null,
  );
  const [isDownloading, setIsDownloading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  /** Selection at the time Delete was clicked; used when confirming in the dialog. */
  const [pendingDeleteSelection, setPendingDeleteSelection] = useState<
    WorkspaceBrowserItem[]
  >([]);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copyMoveDialogMode, setCopyMoveDialogMode] = useState<"copy" | "move">(
    "copy",
  );
  const [pendingCopySelection, setPendingCopySelection] = useState<
    WorkspaceBrowserItem[]
  >([]);
  const [isCopying, setIsCopying] = useState(false);
  const [editTypeDialogOpen, setEditTypeDialogOpen] = useState(false);
  const [pendingEditTypeItem, setPendingEditTypeItem] =
    useState<WorkspaceBrowserItem | null>(null);
  const [isUpdatingType, setIsUpdatingType] = useState(false);
  const [isFavoriting, setIsFavoriting] = useState(false);
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  const workspaceCrud = useMemo(
    () => new WorkspaceCrudMethods(new WorkspaceApiClient()),
    [],
  );
  const queryClient = useQueryClient();
  const { data: favoritePaths = [] } = useQuery({
    queryKey: ["workspace-favorites", myWorkspaceRoot],
    queryFn: () => loadFavorites(myWorkspaceRoot),
    enabled: mode === "home" && !!myWorkspaceRoot,
  });
  const isCurrentSelectionFavorite =
    selectedItem?.path != null && favoritePaths.includes(selectedItem.path);

  const [sort, setSort] = useState<WorkspaceBrowserSort>({
    field: "name",
    direction: "asc",
  });
  const tableRef = useRef<WorkspaceDataTableHandle>(null);

  const isHome = mode === "home";
  useEffect(() => {
    setSelectedItem(null);
  }, [path, mode]);

  // Restore focus to the table after selection so arrow keys work (runs after panel/layout and any deferred focus)
  useEffect(() => {
    if (!selectedItem) return;
    const id = setTimeout(() => tableRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, [selectedItem]);
  const isAtSharedRoot = !isHome && (!path || path === "");
  const fullPath = path ? `/${path}` : "";

  const homeQuery = useWorkspaceBrowser({
    username: currentUser,
    path,
    enabled: isHome && !!currentUser,
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
    enabled: !isHome && !isAtSharedRoot && !!fullPath,
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

  const items = isHome
    ? (homeQuery.data ?? [])
    : isAtSharedRoot
      ? rootItems
      : (pathQuery.data ?? []);
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

  function handleItemDoubleClick(item: WorkspaceBrowserItem) {
    if (!isFolderType(item.type)) return;
    if (isHome) {
      const segments = path
        ? path.split("/").map(sanitizePathSegment).filter(Boolean)
        : [];
      segments.push(sanitizePathSegment(item.name));
      const encoded = segments.map(encodeWorkspaceSegment).join("/");
      const homeBase = `/workspace/${encodeWorkspaceSegment(username)}/home`;
      router.push(`${homeBase}/${encoded}`);
    } else {
      const segments = item.path
        .replace(/^\//, "")
        .split("/")
        .map(sanitizePathSegment)
        .filter(Boolean);
      const encoded = segments.map(encodeWorkspaceSegment).join("/");
      router.push(`/workspace/${encoded}`);
    }
    setSelectedItem(null);
  }

  function handleSelectItem(item: WorkspaceBrowserItem) {
    setSelectedItem(item);
    if (!panelManuallyHidden) setPanelExpanded(true);
  }

  async function handleAction(
    actionId: string,
    selection: WorkspaceBrowserItem[],
  ) {
    if (actionId === "delete") {
      setPendingDeleteSelection(selection);
      setDeleteDialogOpen(true);
      return;
    }
    if (actionId === "copy") {
      setCopyMoveDialogMode("copy");
      setPendingCopySelection(selection);
      setCopyDialogOpen(true);
      return;
    }
    if (actionId === "move") {
      setCopyMoveDialogMode("move");
      setPendingCopySelection(selection);
      setCopyDialogOpen(true);
      return;
    }
    if (actionId === "editType") {
      const single = selection[0] ?? null;
      if (single?.path) {
        setPendingEditTypeItem(single);
        setEditTypeDialogOpen(true);
      }
      return;
    }
    if (actionId === "favorite") {
      const single = selection[0] ?? null;
      if (
        !currentUser ||
        !myWorkspaceRoot ||
        !single?.path ||
        single.type !== "folder"
      ) {
        return;
      }
      setIsFavoriting(true);
      try {
        const added = await toggleFavorite(myWorkspaceRoot, single.path);
        await queryClient.invalidateQueries({
          queryKey: ["workspace-favorites", myWorkspaceRoot],
        });
        toast.success(
          added ? "Added to favorites" : "Removed from favorites",
          { description: single.path },
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update favorites.";
        toast.error(message);
      } finally {
        setIsFavoriting(false);
      }
      return;
    }
    if (actionId !== "download") return;
    const downloadable = selection.filter(
      (item) =>
        !isFolderType(item.type) &&
        !(forbiddenDownloadTypes as readonly string[]).includes(item.type),
    );
    if (downloadable.length === 0) {
      alert(
        "Select a file to download. Folders and some object types cannot be downloaded.",
      );
      return;
    }
    const paths = downloadable.map((item) => item.path);
    setIsDownloading(true);
    try {
      const urlArrays = await getDownloadUrls(paths);
      for (let i = 0; i < urlArrays.length; i++) {
        const url = urlArrays[i]?.[0];
        if (!url) continue;
        const name = downloadable[i]?.name ?? "download";
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.rel = "noopener noreferrer";
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Download failed.";
      alert(message);
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleConfirmDelete() {
    if (pendingDeleteSelection.length === 0) {
      setDeleteDialogOpen(false);
      return;
    }
    const paths = pendingDeleteSelection
      .map((item) => item.path)
      .filter((p): p is string => Boolean(p));
    if (paths.length === 0) {
      setDeleteDialogOpen(false);
      setPendingDeleteSelection([]);
      return;
    }
    setIsDeleting(true);
    try {
      await workspaceCrud.delete({
        objects: paths,
        force: true,
        deleteDirectories: true,
      });
      setSelectedItem(null);
      setDeleteDialogOpen(false);
      setPendingDeleteSelection([]);
      refetch();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete.";
      alert(message);
    } finally {
      setIsDeleting(false);
    }
  }

  const currentUserWorkspaceRoot =
    myWorkspaceRoot ? `/${myWorkspaceRoot}` : `/${currentUser}`;

  async function handleCopyConfirm(
    destinationPath: string,
    filenameOverride?: string,
  ) {
    if (pendingCopySelection.length === 0) return;
    const base = destinationPath.replace(/\/+$/, "") || destinationPath;
    const firstDestName =
      filenameOverride ?? pendingCopySelection[0]?.name ?? "";
    const objects: [string, string][] = pendingCopySelection
      .map((item, index) => {
        const src = item.path;
        if (!src || item.name == null) return null;
        const name =
          index === 0 && filenameOverride != null
            ? filenameOverride
            : item.name;
        const dest = `${base}/${name}`;
        return [src, dest] as [string, string];
      })
      .filter((p): p is [string, string] => p != null);
    if (objects.length === 0) {
      setCopyDialogOpen(false);
      setPendingCopySelection([]);
      return;
    }
    setIsCopying(true);
    const isMove = copyMoveDialogMode === "move";
    try {
      await workspaceCrud.copyByPaths({
        objects,
        recursive: true,
        move: isMove,
      });
      setCopyDialogOpen(false);
      setPendingCopySelection([]);
      setSelectedItem(null);
      refetch();

      const description = isMove
        ? objects
            .map(([src, dest]) => `Moved ${src} to ${dest}`)
            .join("; ")
        : objects.length === 1
          ? `${base}/${firstDestName}`
          : `${base} (${objects.length} items)`;
      toast.success(isMove ? "Move Successful" : "Copy Successful", {
        description,
      });
    } catch (err) {
      const apiResponse = (err as Error & { apiResponse?: unknown }).apiResponse;
      const errorCode =
        apiResponse != null &&
        typeof apiResponse === "object" &&
        "error" in apiResponse &&
        typeof (apiResponse as { error?: { code?: number } }).error === "object"
          ? (apiResponse as { error: { code?: number } }).error?.code
          : (apiResponse as { code?: number } | null)?.code;
      const isOverwriteError = errorCode === -32603;

      let message: string;
      let description: string | undefined;

      if (isOverwriteError) {
        const base = destinationPath.replace(/\/+$/, "") || destinationPath;
        const fullPath = firstDestName
          ? `${base}/${firstDestName}`
          : base;
        message = `Can not overwrite '${fullPath}'`;
        description = undefined;
      } else {
        message =
          err instanceof Error ? err.message : isMove ? "Move failed." : "Copy failed.";
        description =
          apiResponse !== undefined && apiResponse !== null
            ? typeof apiResponse === "string"
              ? apiResponse
              : JSON.stringify(apiResponse, null, 2)
            : undefined;
      }

      toast.error(message, { description });
    } finally {
      setIsCopying(false);
    }
  }

  const currentDirectoryPath = `${currentUserWorkspaceRoot}/home${fullPath ? fullPath : ""}`;

  async function handleCreateFolder(folderName: string) {
    const name = folderName.trim();
    if (!name) return;
    const parent = currentDirectoryPath.replace(/\/+$/, "") || currentDirectoryPath;
    const newFolderPath = `${parent}/${name}`;
    setIsCreatingFolder(true);
    try {
      await workspaceCrud.createFolderByPath(newFolderPath);
      setNewFolderDialogOpen(false);
      setSelectedItem(null);
      refetch();
      toast.success("Folder created", {
        description: name,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create folder.";
      toast.error(message);
    } finally {
      setIsCreatingFolder(false);
    }
  }

  async function handleEditTypeConfirm(newType: string) {
    const item = pendingEditTypeItem;
    if (!item?.path) return;
    setIsUpdatingType(true);
    try {
      await workspaceCrud.updateObjectType(item.path, newType);
      setSelectedItem(null);
      setEditTypeDialogOpen(false);
      setPendingEditTypeItem(null);
      refetch();
      toast.success("Object type updated", {
        description: `${item.name} is now type "${newType}".`,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update object type.";
      toast.error(message);
    } finally {
      setIsUpdatingType(false);
    }
  }

  if (!currentUser) {
    if (mode === "shared" && !authChecked) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-10 w-full" />
          <div className="rounded-md border">
            <Skeleton className="h-64 w-full" />
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

  const deleteTargetLabel =
    pendingDeleteSelection.length === 0
      ? "item"
      : pendingDeleteSelection.length === 1
        ? pendingDeleteSelection[0]?.name ?? "item"
        : `${pendingDeleteSelection.length} items`;

  const mainContent = (
    <>
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
      <UploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        targetPath={currentDirectoryPath}
        onUploadComplete={() => {
          refetch();
          setUploadDialogOpen(false);
        }}
      />
      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open && !isDeleting) setPendingDeleteSelection([]);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Delete from workspace</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete {deleteTargetLabel}? This action
            cannot be undone.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void handleConfirmDelete()}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Spinner className="mr-2 h-3.5 w-3.5 shrink-0" />
                  Deleting…
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

      <div>
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
          selectedPath={selectedItem?.path ?? null}
          onSelect={handleSelectItem}
          onItemDoubleClick={handleItemDoubleClick}
        />
      </div>
    </>
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
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5">
        <WorkspaceActionBar
          selection={selectedItem ? [selectedItem] : []}
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

  const detailsPanelContent = selectedItem ? (
    <InfoPanel
      variant="workspace"
      workspaceItem={selectedItem}
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
      <div className="flex min-h-[calc(100vh-12rem)] w-full flex-row gap-0">
        <div className="flex min-h-[calc(100vh-12rem)] min-w-0 flex-1 flex-col overflow-hidden">
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
      className="min-h-[calc(100vh-12rem)] w-full"
      defaultLayout={panelLayout}
      onLayoutChanged={setPanelLayout}
    >
      <ResizablePanel
        id={WORKSPACE_PANEL_IDS.main}
        defaultSize={panelLayout[WORKSPACE_PANEL_IDS.main] ?? 75}
        minSize={50}
        className="flex min-h-[calc(100vh-12rem)] flex-row overflow-hidden"
      >
        <div className="flex min-h-[calc(100vh-12rem)] min-w-0 flex-1 flex-col overflow-hidden">
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
