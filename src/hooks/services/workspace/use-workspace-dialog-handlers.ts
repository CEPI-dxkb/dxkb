"use client";

import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { WorkspaceBrowserItem } from "@/types/workspace-browser";
import type { WorkspaceApiClient } from "@/lib/services/workspace/client";
import type { WorkspaceCrudMethods } from "@/lib/services/workspace/methods/crud";
import type { WorkspaceDownloadMethods } from "@/lib/services/workspace/methods/download";
import {
  getFolderPathsFromItems,
  getNonEmptyFolderPaths,
  ensureDestinationWriteAccess,
} from "@/lib/services/workspace/helpers";
import { isFolder } from "@/lib/services/workspace/utils";
import { sanitizePathSegment } from "@/lib/utils";
import { useWorkspaceDialog } from "@/contexts/workspace-dialog-context";

export interface UseWorkspaceDialogHandlersOptions {
  workspaceCrud: WorkspaceCrudMethods;
  workspaceDownload: WorkspaceDownloadMethods;
  workspaceClient: WorkspaceApiClient;
  currentDirectoryPath: string;
  currentUserWorkspaceRoot: string;
  username: string;
  myWorkspaceRoot: string;
  clearSelection: () => void;
}

function invalidateWorkspaceQueries(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ["workspace-browser"] });
  void queryClient.invalidateQueries({ queryKey: ["workspace-list-path"] });
}

export function useWorkspaceDialogHandlers(options: UseWorkspaceDialogHandlersOptions) {
  const {
    workspaceCrud,
    workspaceClient,
    currentDirectoryPath,
    currentUserWorkspaceRoot,
    username,
    clearSelection,
  } = options;

  const { state, dispatch } = useWorkspaceDialog();
  const { activeDialog } = state;
  const queryClient = useQueryClient();

  // Check for non-empty folders when delete dialog opens.
  const deleteItems = activeDialog?.type === "delete" ? activeDialog.items : null;
  useEffect(() => {
    if (!deleteItems) return;
    const folderPaths = getFolderPathsFromItems(deleteItems);
    if (folderPaths.length === 0) return;
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
      .then((paths) => dispatch({ type: "SET_DELETE_NON_EMPTY_PATHS", paths }))
      .catch(() => { /* abort errors ignored */ });
    return () => controller.abort();
  }, [deleteItems, workspaceClient, dispatch]);

  const deleteMutation = useMutation({
    mutationFn: async (items: WorkspaceBrowserItem[]) => {
      const paths = items
        .map((item) => item.path)
        .filter((p): p is string => Boolean(p));
      if (paths.length === 0) return;
      await workspaceCrud.delete({
        objects: paths,
        force: true,
        deleteDirectories: true,
      });
    },
    onSuccess: () => {
      clearSelection();
      dispatch({ type: "CLOSE" });
      invalidateWorkspaceQueries(queryClient);
    },
    onError: (err) => {
      const message =
        err instanceof Error ? err.message : "Failed to delete.";
      toast.error(message);
    },
  });

  const copyMutation = useMutation({
    mutationFn: async ({
      objects,
      isMove,
    }: {
      objects: [string, string][];
      isMove: boolean;
      firstDestName: string;
      destinationPath: string;
    }) => {
      await workspaceCrud.copyByPaths({
        objects,
        recursive: true,
        move: isMove,
      });
      return { objects, isMove };
    },
    onSuccess: ({ objects, isMove }, { firstDestName, destinationPath }) => {
      dispatch({ type: "CLOSE" });
      clearSelection();
      invalidateWorkspaceQueries(queryClient);

      const base = destinationPath.replace(/\/+$/, "") || destinationPath;
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
    },
    onError: (err, { isMove, firstDestName, destinationPath }) => {
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
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: async (safeName: string) => {
      const parent = currentDirectoryPath.replace(/\/+$/, "") || currentDirectoryPath;
      const newFolderPath = `${parent}/${safeName}`;
      await workspaceCrud.createFolderByPath(newFolderPath);
      return safeName;
    },
    onSuccess: (safeName) => {
      dispatch({ type: "CLOSE" });
      clearSelection();
      invalidateWorkspaceQueries(queryClient);
      toast.success("Folder created", { description: safeName });
    },
    onError: (err) => {
      const message =
        err instanceof Error ? err.message : "Failed to create folder.";
      toast.error(message);
    },
  });

  const createWorkspaceMutation = useMutation({
    mutationFn: async (safeName: string) => {
      const fullPath = `/${username}/${safeName}/`;
      await workspaceCrud.createFolderByPath(fullPath);
      return safeName;
    },
    onSuccess: (safeName) => {
      dispatch({ type: "CLOSE" });
      clearSelection();
      invalidateWorkspaceQueries(queryClient);
      toast.success("Workspace created", { description: safeName });
    },
    onError: (err) => {
      const message =
        err instanceof Error ? err.message : "Failed to create workspace.";
      toast.error(message);
    },
  });

  const editTypeMutation = useMutation({
    mutationFn: async ({
      path,
      newType,
    }: {
      path: string;
      newType: string;
      itemName?: string;
    }) => {
      await workspaceCrud.updateObjectType(path, newType);
    },
    onSuccess: (_, { newType, itemName }) => {
      clearSelection();
      dispatch({ type: "CLOSE" });
      invalidateWorkspaceQueries(queryClient);
      toast.success("Object type updated", {
        description: `${itemName} is now type "${newType}".`,
      });
    },
    onError: (err) => {
      const message =
        err instanceof Error ? err.message : "Failed to update object type.";
      toast.error(message);
    },
  });

  const handleConfirmDelete = async () => {
    if (activeDialog?.type !== "delete") return;
    const items = activeDialog.items;
    if (items.length === 0) {
      dispatch({ type: "CLOSE" });
      return;
    }
    const paths = items
      .map((item) => item.path)
      .filter((p): p is string => Boolean(p));
    if (paths.length === 0) {
      dispatch({ type: "CLOSE" });
      return;
    }
    deleteMutation.mutate(items);
  };

  const handleCopyConfirm = async (destinationPath: string, filenameOverride?: string) => {
    if (activeDialog?.type !== "copy") return;
    const pendingCopySelection = activeDialog.items;
    const isMove = activeDialog.mode === "move";
    if (pendingCopySelection.length === 0) return;
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
      dispatch({ type: "CLOSE" });
      return;
    }
    copyMutation.mutate({ objects, isMove, firstDestName, destinationPath });
  };

  const handleCreateFolder = async (folderName: string) => {
    const name = folderName.trim();
    if (!name) return;
    const safeName = sanitizePathSegment(name);
    if (!safeName) return;
    createFolderMutation.mutate(safeName);
  };

  const handleCreateWorkspace = async (workspaceName: string) => {
    const name = workspaceName.trim();
    if (!name) return;
    const safeName = sanitizePathSegment(name);
    if (!safeName) return;
    createWorkspaceMutation.mutate(safeName);
  };

  const handleEditTypeConfirm = async (newType: string) => {
    if (activeDialog?.type !== "editType") return;
    const item = activeDialog.item;
    if (!item?.path) return;
    editTypeMutation.mutate({ path: item.path, newType, itemName: item.name });
  };

  const isDialogLoading =
    deleteMutation.isPending ||
    copyMutation.isPending ||
    createFolderMutation.isPending ||
    createWorkspaceMutation.isPending ||
    editTypeMutation.isPending;

  return {
    dialogState: state,
    dialogDispatch: dispatch,
    isDialogLoading,
    handleConfirmDelete,
    handleCopyConfirm,
    handleCreateFolder,
    handleCreateWorkspace,
    handleEditTypeConfirm,
  };
}
