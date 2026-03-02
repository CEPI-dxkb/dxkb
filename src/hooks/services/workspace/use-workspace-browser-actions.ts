"use client";

import { useState, useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { WorkspaceBrowserItem } from "@/types/workspace-browser";
import type { WorkspaceApiClient } from "@/lib/services/workspace/client";
import type { WorkspaceCrudMethods } from "@/lib/services/workspace/methods/crud";
import type { WorkspaceDownloadMethods } from "@/lib/services/workspace/methods/download";
import {
  getFolderPathsFromItems,
  getNonEmptyFolderPaths,
  getSiblingJobResultPathForDotFolder,
  expandDownloadPaths,
  ensureDestinationWriteAccess,
} from "@/lib/services/workspace/helpers";
import { isFolderType, isFolder } from "@/lib/services/workspace/utils";
import { toggleFavorite } from "@/lib/services/workspace/favorites";
import { forbiddenDownloadTypes } from "@/lib/services/workspace/types";
import { computeNextSelection } from "@/lib/workspace/table-selection";
import { encodeWorkspaceSegment, sanitizePathSegment } from "@/lib/utils";

export type WorkspaceViewMode = "home" | "shared";

export interface UseWorkspaceBrowserActionsOptions {
  workspaceClient: WorkspaceApiClient;
  workspaceCrud: WorkspaceCrudMethods;
  workspaceDownload: WorkspaceDownloadMethods;
  queryClient: QueryClient;
  router: { push: (url: string) => void; replace: (url: string) => void };
  mode: WorkspaceViewMode;
  username: string;
  path: string;
  currentUser: string;
  myWorkspaceRoot: string;
  currentUserWorkspaceRoot: string;
  currentDirectoryPath: string;
  items: WorkspaceBrowserItem[];
  processedItems: WorkspaceBrowserItem[];
  selectedItems: WorkspaceBrowserItem[];
  setSelectedItems: React.Dispatch<React.SetStateAction<WorkspaceBrowserItem[]>>;
  anchorPath: string | null;
  setAnchorPath: React.Dispatch<React.SetStateAction<string | null>>;
  panelManuallyHidden: boolean;
  setPanelExpanded: (value: boolean) => void;
  refetch: () => void;
  favoritePaths: string[];
}

export function useWorkspaceBrowserActions(
  options: UseWorkspaceBrowserActionsOptions,
) {
  const {
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
    favoritePaths: _favoritePaths,
  } = options;

  const isHome = mode === "home";

  const [isDownloading, setIsDownloading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pendingDeleteSelection, setPendingDeleteSelection] = useState<
    WorkspaceBrowserItem[]
  >([]);
  const [nonEmptyFolderPathsInDelete, setNonEmptyFolderPathsInDelete] =
    useState<string[]>([]);
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
  const [downloadOptionsOpen, setDownloadOptionsOpen] = useState(false);
  const [downloadOptionsPaths, setDownloadOptionsPaths] = useState<string[]>(
    [],
  );
  const [downloadOptionsDefaultName, setDownloadOptionsDefaultName] =
    useState<string>("archive");
  const [createWorkspaceDialogOpen, setCreateWorkspaceDialogOpen] =
    useState(false);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [fileViewerConstructionOpen, setFileViewerConstructionOpen] =
    useState(false);

  useEffect(() => {
    if (!deleteDialogOpen) {
      setNonEmptyFolderPathsInDelete([]);
      return;
    }
    const folderPaths = getFolderPathsFromItems(pendingDeleteSelection);
    if (folderPaths.length === 0) {
      setNonEmptyFolderPathsInDelete([]);
      return;
    }
    const controller = new AbortController();
    const listFolder = (p: string) =>
      workspaceClient.makeRequest<WorkspaceBrowserItem[]>(
        "Workspace.ls",
        [{ paths: [p], includeSubDirs: false, recursive: false }],
        { silent: true },
      );
    void getNonEmptyFolderPaths(folderPaths, listFolder, {
      signal: controller.signal,
    })
      .then(setNonEmptyFolderPathsInDelete)
      .catch(() => {});
    return () => controller.abort();
  }, [deleteDialogOpen, pendingDeleteSelection, workspaceClient]);

  function navigateToItem(item: WorkspaceBrowserItem) {
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
    setSelectedItems([]);
    setAnchorPath(null);
  }

  function handleItemDoubleClick(item: WorkspaceBrowserItem) {
    if (item.type === "job_result") {
      navigateToItem(item);
      return;
    }
    if (!isFolderType(item.type)) return;
    navigateToItem(item);
  }

  function handleSelectItem(
    item: WorkspaceBrowserItem,
    modifiers?: { ctrlOrMeta: boolean; shift: boolean },
  ) {
    const { nextSelection, nextAnchorPath } = computeNextSelection(
      processedItems,
      selectedItems,
      anchorPath,
      item,
      modifiers ?? { ctrlOrMeta: false, shift: false },
    );
    setSelectedItems(nextSelection);
    setAnchorPath(nextAnchorPath);
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
        Boolean(item.path) &&
        !(forbiddenDownloadTypes as readonly string[]).includes(
          (item.type ?? "").toLowerCase(),
        ),
    );
    if (downloadable.length === 0) {
      toast.error("Nothing to download for this selection.", {
        description:
          "Some object types are not downloadable. Try selecting files or standard folders.",
      });
      return;
    }

    const mappedPaths = expandDownloadPaths(downloadable, items);
    const singleFile =
      downloadable.length === 1 && !isFolderType(downloadable[0]?.type ?? "");
    if (singleFile) {
      setIsDownloading(true);
      try {
        const urlArrays = await workspaceDownload.getDownloadUrls(mappedPaths);
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
        const message =
          err instanceof Error ? err.message : "Download failed.";
        alert(message);
      } finally {
        setIsDownloading(false);
      }
      return;
    }
    const single = downloadable.length === 1 ? downloadable[0] : null;
    const singleType = String(single?.type ?? "").toLowerCase();
    const defaultName =
      singleType === "job_result"
        ? String(single?.name ?? "").replace(/^\./, "").trim() || "archive"
        : single?.name != null && String(single.name).startsWith(".")
          ? (getSiblingJobResultPathForDotFolder(single.path ?? "", items)?.split("/").filter(Boolean).pop() ??
              String(single.name).replace(/^\./, "")).trim() || "archive"
          : "archive";

    setDownloadOptionsDefaultName(defaultName);
    setDownloadOptionsPaths(mappedPaths);
    setDownloadOptionsOpen(true);
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
      setSelectedItems([]);
      setAnchorPath(null);
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

  async function handleCopyConfirm(
    destinationPath: string,
    filenameOverride?: string,
  ) {
    if (pendingCopySelection.length === 0) return;
    const isMove = copyMoveDialogMode === "move";
    const base = destinationPath.replace(/\/+$/, "") || destinationPath;
    const destIsRoot = base === currentUserWorkspaceRoot;
    const hasNonFolder = pendingCopySelection.some(
      (item) => !isFolder(item.type),
    );
    if (destIsRoot && hasNonFolder) {
      const actionVerb = isMove ? "Moving" : "Copying";
      toast.error(
        "Sorry! " +
          actionVerb +
          " objects to the top level directory, " +
          currentUserWorkspaceRoot +
          ", is not allowed.",
      );
      return;
    }
    const listFolder = (p: string) =>
      workspaceClient.makeRequest<WorkspaceBrowserItem[]>(
        "Workspace.ls",
        [{ paths: [p], includeSubDirs: false, recursive: false }],
        { silent: true },
      );
    const result = await ensureDestinationWriteAccess(base, listFolder);
    if (!result.ok) {
      toast.error(result.errorMessage);
      return;
    }
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
    try {
      await workspaceCrud.copyByPaths({
        objects,
        recursive: true,
        move: isMove,
      });
      setCopyDialogOpen(false);
      setPendingCopySelection([]);
      setSelectedItems([]);
      setAnchorPath(null);
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
        const basePath = destinationPath.replace(/\/+$/, "") || destinationPath;
        const fullPath = firstDestName
          ? `${basePath}/${firstDestName}`
          : basePath;
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

  async function handleCreateFolder(folderName: string) {
    const name = folderName.trim();
    if (!name) return;
    const parent = currentDirectoryPath.replace(/\/+$/, "") || currentDirectoryPath;
    const newFolderPath = `${parent}/${name}`;
    setIsCreatingFolder(true);
    try {
      await workspaceCrud.createFolderByPath(newFolderPath);
      setNewFolderDialogOpen(false);
      setSelectedItems([]);
      setAnchorPath(null);
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

  async function handleCreateWorkspace(workspaceName: string) {
    const name = workspaceName.trim();
    if (!name) return;
    const safeName = sanitizePathSegment(name);
    if (!safeName) return;
    setIsCreatingWorkspace(true);
    try {
      const fullPath = `/${username}/${safeName}/`;
      await workspaceCrud.createFolderByPath(fullPath);
      setCreateWorkspaceDialogOpen(false);
      setSelectedItems([]);
      setAnchorPath(null);
      refetch();
      toast.success("Workspace created", {
        description: safeName,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create workspace.";
      toast.error(message);
    } finally {
      setIsCreatingWorkspace(false);
    }
  }

  async function handleEditTypeConfirm(newType: string) {
    const item = pendingEditTypeItem;
    if (!item?.path) return;
    setIsUpdatingType(true);
    try {
      await workspaceCrud.updateObjectType(item.path, newType);
      setSelectedItems([]);
      setAnchorPath(null);
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

  function onDeleteDialogOpenChange(open: boolean) {
    setDeleteDialogOpen(open);
    if (!open && !isDeleting) setPendingDeleteSelection([]);
  }

  return {
    // Dialog state
    deleteDialogOpen,
    setDeleteDialogOpen: onDeleteDialogOpenChange,
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
    // Handlers
    navigateToItem,
    handleItemDoubleClick,
    handleSelectItem,
    handleAction,
    handleConfirmDelete,
    handleCopyConfirm,
    handleCreateFolder,
    handleCreateWorkspace,
    handleEditTypeConfirm,
    // For dialogs
    currentUserWorkspaceRoot,
    currentDirectoryPath,
    workspaceDownload,
  };
}
