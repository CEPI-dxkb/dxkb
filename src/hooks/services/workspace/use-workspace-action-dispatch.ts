"use client";

import { useCallback } from "react";
import { useMutation, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { WorkspaceBrowserItem } from "@/types/workspace-browser";
import { useWorkspaceRepository } from "@/contexts/workspace-repository-context";
import { triggerDownload } from "@/lib/utils";
import {
  expandDownloadPaths,
  getSiblingJobResultPathForDotFolder,
} from "@/lib/services/workspace/helpers";
import { isFolderType } from "@/lib/services/workspace/utils";
import { toggleFavorite } from "@/lib/services/workspace/favorites";
import { forbiddenDownloadTypes } from "@/lib/services/workspace/types";
import { workspaceQueryKeys } from "@/lib/services/workspace/workspace-query-keys";
import { useWorkspaceDialog } from "@/contexts/workspace-dialog-context";
import { getStructureViewerUrl } from "@/components/workspace/file-viewer/file-viewer-registry";

export interface UseWorkspaceActionDispatchOptions {
  currentUser: string;
  myWorkspaceRoot: string;
  queryClient: QueryClient;
  items: WorkspaceBrowserItem[];
  /** When true, dispatch download through the public (unauthenticated) repository. */
  isPublic?: boolean;
}

export function useWorkspaceActionDispatch({
  currentUser,
  myWorkspaceRoot,
  queryClient,
  items,
  isPublic = false,
}: UseWorkspaceActionDispatchOptions) {
  const repository = useWorkspaceRepository(isPublic ? "public" : "authenticated");
  const { dispatch } = useWorkspaceDialog();

  const favoriteMutation = useMutation({
    mutationFn: async (folderPath: string) => {
      return toggleFavorite(myWorkspaceRoot, folderPath);
    },
    onSuccess: (added, folderPath) => {
      void queryClient.invalidateQueries({
        queryKey: workspaceQueryKeys.favorites(myWorkspaceRoot),
      });
      toast.success(
        added ? "Added to favorites" : "Removed from favorites",
        { description: folderPath },
      );
    },
    onError: (err) => {
      const message =
        err instanceof Error ? err.message : "Failed to update favorites.";
      toast.error(message);
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async ({
      mappedPaths,
      downloadable,
    }: {
      mappedPaths: string[];
      downloadable: WorkspaceBrowserItem[];
    }) => {
      const urlArrays = await repository.getDownloadUrls(mappedPaths);
      return { urlArrays, downloadable };
    },
    onSuccess: ({ urlArrays, downloadable }) => {
      for (let i = 0; i < urlArrays.length; i++) {
        const url = urlArrays[i]?.[0];
        if (!url) continue;
        triggerDownload(url, downloadable[i]?.name ?? "download");
      }
    },
    onError: (err) => {
      const message =
        err instanceof Error ? err.message : "Download failed.";
      toast.error(message);
    },
  });

  const { mutate: favoriteMutate } = favoriteMutation;
  const { mutate: downloadMutate } = downloadMutation;

  const handleAction = useCallback(
    async (actionId: string, selection: WorkspaceBrowserItem[]) => {
      if (actionId === "delete") {
        dispatch({ type: "OPEN_DELETE", items: selection });
        return;
      }
      if (actionId === "copy") {
        dispatch({ type: "OPEN_COPY", items: selection, mode: "copy" });
        return;
      }
      if (actionId === "move") {
        dispatch({ type: "OPEN_COPY", items: selection, mode: "move" });
        return;
      }
      if (actionId === "editType") {
        const single = selection[0] ?? null;
        if (single?.path) {
          dispatch({ type: "OPEN_EDIT_TYPE", item: single });
        }
        return;
      }
      if (actionId === "viewer3d") {
        const single = selection[0] ?? null;
        if (single?.path) {
          window.open(getStructureViewerUrl(single.path), "_blank", "noopener,noreferrer");
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
        favoriteMutate(single.path);
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
        downloadMutate({ mappedPaths, downloadable });
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
            : single?.name != null
              ? String(single.name).trim() || "archive"
              : "archive";

      dispatch({ type: "OPEN_DOWNLOAD_OPTIONS", paths: mappedPaths, defaultName });
    },
    [currentUser, myWorkspaceRoot, items, dispatch, favoriteMutate, downloadMutate],
  );

  return {
    handleAction,
    isDownloading: downloadMutation.isPending,
    isFavoriting: favoriteMutation.isPending,
  };
}
