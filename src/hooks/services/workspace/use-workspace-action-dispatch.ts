"use client";

import { useState, useCallback } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { WorkspaceBrowserItem } from "@/types/workspace-browser";
import type { WorkspaceApiClient } from "@/lib/services/workspace/client";
import type { WorkspaceDownloadMethods } from "@/lib/services/workspace/methods/download";
import {
  expandDownloadPaths,
  getSiblingJobResultPathForDotFolder,
} from "@/lib/services/workspace/helpers";
import { isFolderType } from "@/lib/services/workspace/utils";
import { toggleFavorite } from "@/lib/services/workspace/favorites";
import { forbiddenDownloadTypes } from "@/lib/services/workspace/types";
import { useWorkspaceDialog } from "@/contexts/workspace-dialog-context";

export interface UseWorkspaceActionDispatchOptions {
  currentUser: string;
  myWorkspaceRoot: string;
  queryClient: QueryClient;
  workspaceDownload: WorkspaceDownloadMethods;
  workspaceClient: WorkspaceApiClient;
  items: WorkspaceBrowserItem[];
}

export function useWorkspaceActionDispatch({
  currentUser,
  myWorkspaceRoot,
  queryClient,
  workspaceDownload,
  items,
}: UseWorkspaceActionDispatchOptions) {
  const { dispatch } = useWorkspaceDialog();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isFavoriting, setIsFavoriting] = useState(false);

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
          toast.error(message);
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
            : single?.name != null
              ? String(single.name).trim() || "archive"
              : "archive";

      dispatch({ type: "OPEN_DOWNLOAD_OPTIONS", paths: mappedPaths, defaultName });
    },
    [currentUser, myWorkspaceRoot, queryClient, workspaceDownload, items, dispatch],
  );

  return {
    handleAction,
    isDownloading,
    isFavoriting,
  };
}
