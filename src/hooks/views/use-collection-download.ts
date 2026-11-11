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

/** Saves a collection's download: a selection or a small query is buffered through the gateway, a larger query or whole-contig file is a native form POST (`usesNativeDownload`). An empty file is a failure. */
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
