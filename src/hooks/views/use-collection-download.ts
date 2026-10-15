"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { DataRepository } from "@/lib/data-api/client";
import { startNativeDownload } from "@/lib/data-api/download-transport";
import {
  downloadFileName,
  emptyDownloadMessage,
  usesNativeDownload,
  type DownloadFormatId,
  type DownloadRequest,
} from "@/lib/data-api/downloads";
import type { DataResource } from "@/lib/data-api/types";
import { downloadBlob, formatUserFacingErrorMessage } from "@/lib/utils";

const repository = new DataRepository();

const genericDownloadErrorMessage =
  "The download could not be created. Please try again.";

export interface CollectionDownloadVariables {
  resource: DataResource;
  request: DownloadRequest;
}

/**
 * The one way a collection's Download tile saves a file. A selection, and a
 * query of at most `maxBufferedDownloadRows`, is fetched through the gateway
 * and saved from memory; a larger query, and any file of whole contigs, is a
 * native form POST the browser streams to disk (`usesNativeDownload`). A
 * failure toasts the server's own message, and an empty file is a failure
 * too (the gateway refuses one, and a buffered one is checked here again), so
 * a click never saves a zero-byte file.
 *
 * `pending` is the format being downloaded, so the tile can show which row is
 * busy. The mutation lives with whoever calls this hook — the collection
 * shell — so a remounted tile still sees it.
 */
export function useCollectionDownload() {
  const mutation = useMutation({
    mutationFn: async ({ resource, request }: CollectionDownloadVariables) => {
      if (usesNativeDownload(resource, request)) {
        await startNativeDownload(resource, request);
        return;
      }
      const blob = await repository.download(resource, request);
      if (blob.size === 0) throw new Error(emptyDownloadMessage(request.format));
      downloadBlob(blob, downloadFileName(request.fileNameBase, request.format));
    },
    onError: (error) => {
      toast.error(
        formatUserFacingErrorMessage(error, genericDownloadErrorMessage),
      );
    },
  });

  return {
    download: (
      resource: DataResource,
      request: DownloadRequest,
      options?: { onSuccess?: () => void },
    ) => {
      mutation.mutate({ resource, request }, options);
    },
    pending: (mutation.isPending
      ? mutation.variables.request.format
      : null) satisfies DownloadFormatId | null,
  };
}
