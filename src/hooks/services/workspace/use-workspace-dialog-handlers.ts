"use client";

import { useEffect, useCallback } from "react";
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
  refetch: () => void;
  clearSelection: () => void;
}

export function useWorkspaceDialogHandlers(options: UseWorkspaceDialogHandlersOptions) {
  const {
    workspaceCrud,
    workspaceClient,
    currentDirectoryPath,
    currentUserWorkspaceRoot,
    username,
    refetch,
    clearSelection,
  } = options;

  const { state, dispatch } = useWorkspaceDialog();
  const { activeDialog, isLoading } = state;

  // Check for non-empty folders when delete dialog opens.
  // Depend on `deleteItems` (activeDialog.items reference) rather than the full
  // `activeDialog` object, so that dispatching SET_DELETE_NON_EMPTY_PATHS — which
  // spreads a new activeDialog but keeps the same items reference — does NOT
  // re-trigger this effect and cause an infinite Workspace.ls polling loop.
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
      .catch(() => {});
    return () => controller.abort();
  }, [deleteItems, workspaceClient, dispatch]);

  const handleConfirmDelete = useCallback(async () => {
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
    dispatch({ type: "SET_LOADING", value: true });
    try {
      await workspaceCrud.delete({
        objects: paths,
        force: true,
        deleteDirectories: true,
      });
      clearSelection();
      dispatch({ type: "CLOSE" });
      refetch();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete.";
      toast.error(message);
    } finally {
      dispatch({ type: "SET_LOADING", value: false });
    }
  }, [activeDialog, workspaceCrud, clearSelection, refetch, dispatch]);

  const handleCopyConfirm = useCallback(
    async (destinationPath: string, filenameOverride?: string) => {
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
      dispatch({ type: "SET_LOADING", value: true });
      try {
        await workspaceCrud.copyByPaths({
          objects,
          recursive: true,
          move: isMove,
        });
        dispatch({ type: "CLOSE" });
        clearSelection();
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
        dispatch({ type: "SET_LOADING", value: false });
      }
    },
    [activeDialog, workspaceCrud, workspaceClient, currentUserWorkspaceRoot, clearSelection, refetch, dispatch],
  );

  const handleCreateFolder = useCallback(
    async (folderName: string) => {
      const name = folderName.trim();
      if (!name) return;
      const safeName = sanitizePathSegment(name);
      if (!safeName) return;
      const parent = currentDirectoryPath.replace(/\/+$/, "") || currentDirectoryPath;
      const newFolderPath = `${parent}/${safeName}`;
      dispatch({ type: "SET_LOADING", value: true });
      try {
        await workspaceCrud.createFolderByPath(newFolderPath);
        dispatch({ type: "CLOSE" });
        clearSelection();
        refetch();
        toast.success("Folder created", { description: safeName });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to create folder.";
        toast.error(message);
      } finally {
        dispatch({ type: "SET_LOADING", value: false });
      }
    },
    [currentDirectoryPath, workspaceCrud, clearSelection, refetch, dispatch],
  );

  const handleCreateWorkspace = useCallback(
    async (workspaceName: string) => {
      const name = workspaceName.trim();
      if (!name) return;
      const safeName = sanitizePathSegment(name);
      if (!safeName) return;
      dispatch({ type: "SET_LOADING", value: true });
      try {
        const fullPath = `/${username}/${safeName}/`;
        await workspaceCrud.createFolderByPath(fullPath);
        dispatch({ type: "CLOSE" });
        clearSelection();
        refetch();
        toast.success("Workspace created", { description: safeName });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to create workspace.";
        toast.error(message);
      } finally {
        dispatch({ type: "SET_LOADING", value: false });
      }
    },
    [username, workspaceCrud, clearSelection, refetch, dispatch],
  );

  const handleEditTypeConfirm = useCallback(
    async (newType: string) => {
      if (activeDialog?.type !== "editType") return;
      const item = activeDialog.item;
      if (!item?.path) return;
      dispatch({ type: "SET_LOADING", value: true });
      try {
        await workspaceCrud.updateObjectType(item.path, newType);
        clearSelection();
        dispatch({ type: "CLOSE" });
        refetch();
        toast.success("Object type updated", {
          description: `${item.name} is now type "${newType}".`,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update object type.";
        toast.error(message);
      } finally {
        dispatch({ type: "SET_LOADING", value: false });
      }
    },
    [activeDialog, workspaceCrud, clearSelection, refetch, dispatch],
  );

  return {
    dialogState: state,
    dialogDispatch: dispatch,
    isDialogLoading: isLoading,
    handleConfirmDelete,
    handleCopyConfirm,
    handleCreateFolder,
    handleCreateWorkspace,
    handleEditTypeConfirm,
  };
}
