"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { DataRepository } from "@/lib/data-api/client";
import {
  fastaFileName,
  fastaTypeLabels,
  type FastaResource,
  type FastaTypeFor,
} from "@/lib/data-api/fasta";
import { downloadBlob, formatUserFacingErrorMessage } from "@/lib/utils";

const repository = new DataRepository();

const genericFastaErrorMessage =
  "The FASTA download could not be created. Please try again.";

export interface FastaDownloadRequest<
  Resource extends FastaResource = FastaResource,
> {
  resource: Resource;
  type: FastaTypeFor<Resource>;
  ids: readonly string[];
  fileNameBase: string;
}

/** Fetches through the same-origin gateway and saves the file; an empty result is a failure. `pendingType` is the type being fetched. */
export function useFastaDownload() {
  const mutation = useMutation({
    mutationFn: async ({
      resource,
      type,
      ids,
      fileNameBase,
    }: FastaDownloadRequest) => {
      const blob = await repository.fasta(resource, { type, ids: [...ids] });
      if (blob.size === 0) {
        throw new Error(
          `No ${fastaTypeLabels[type].toLowerCase()} sequence is available for the requested records.`,
        );
      }
      downloadBlob(blob, fastaFileName(fileNameBase, type));
    },
    onError: (error) => {
      toast.error(formatUserFacingErrorMessage(error, genericFastaErrorMessage));
    },
  });

  return {
    download: <Resource extends FastaResource>(
      request: FastaDownloadRequest<Resource>,
    ) => {
      mutation.mutate(request);
    },
    pendingType: mutation.isPending ? mutation.variables.type : undefined,
  };
}
