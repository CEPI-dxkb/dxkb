"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useFastaDownload } from "@/hooks/views/use-fasta-download";
import {
  fastaTypeLabels,
  type FastaResource,
  type FastaTypeFor,
} from "@/lib/data-api/fasta";

interface FastaDownloadButtonsProps<Resource extends FastaResource> {
  resource: Resource;
  ids: readonly string[];
  types: readonly FastaTypeFor<Resource>[];
  fileNameBase: string;
}

export function FastaDownloadButtons<Resource extends FastaResource>({
  resource,
  ids,
  types,
  fileNameBase,
}: FastaDownloadButtonsProps<Resource>) {
  const { download, pendingType } = useFastaDownload();
  if (ids.length === 0) return null;
  return types.map((type) => {
    const pending = pendingType === type;
    return (
      <Button
        key={type}
        type="button"
        variant="outline"
        size="sm"
        aria-busy={pending || undefined}
        disabled={pendingType !== undefined}
        onClick={() => {
          download({ resource, type, ids, fileNameBase });
        }}
      >
        {pending ? <Spinner /> : <Download aria-hidden="true" />}
        {fastaTypeLabels[type]} FASTA
      </Button>
    );
  });
}
