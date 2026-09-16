"use client";

import { useQuery } from "@tanstack/react-query";
import { InfoPanel } from "@/components/detail-panel/info-panel";
import { getIdField } from "@/constants/resources";
import { formatUserFacingErrorMessage } from "@/lib/utils";
import { DataRepository } from "@/lib/data-api";
import type { DataResource } from "@/lib/data-api";
import { projectedFields } from "@/components/services/list-data-utils";
import { detailPanelQueryKey } from "./genome-detail-panel-utils";

// Same-origin Data API entrypoint (`/api/data/<resource>`). Stateless wrapper
// around fetch, so one module-level instance is the established pattern.
const dataRepository = new DataRepository();

interface GenomeDetailPanelProps {
  genomeId: string | null;
  /** The resource the selected row belongs to. */
  resource: DataResource;
  selectedIds: string[];
  isAllPagesSelected?: boolean;
  totalItems?: number;
}

export function GenomeDetailPanel({
  genomeId,
  resource,
  selectedIds,
  isAllPagesSelected,
  totalItems,
}: GenomeDetailPanelProps) {
  const hasSelection = selectedIds.length > 0;
  const idField = getIdField(resource);

  // Only fetch when exactly ONE row is selected.
  //
  // The key is `detailPanelQueryKey`, not `dataQueryKeys.member`, because
  // `ListData` pre-populates this exact entry from the page it already loaded
  // (see its `handleRowSelectionChange`); reading a different key would turn
  // every selection into a network round-trip. That shared key is why the
  // request below projects the same field set the list projects — a cache-miss
  // row then has the same shape as the cache-populated one.
  const {
    data: selectedRow,
    isLoading,
    error,
  } = useQuery({
    queryKey: detailPanelQueryKey(resource, genomeId ?? ""),
    enabled: !!genomeId && selectedIds.length === 1,
    staleTime: 5 * 60 * 1000,

    queryFn: async ({ signal }) => {
      if (!genomeId) return null;
      const result = await dataRepository.member(
        resource,
        {
          id: genomeId,
          idField,
          fields: projectedFields(resource, idField),
        },
        signal,
      );
      // `null`, never `undefined`: TanStack Query rejects an undefined result,
      // and an id that matches no row in this resource is a legitimate miss.
      return result.row;
    },
  });

  if (!hasSelection) {
    return (
      <div className="p-4 text-sm text-muted-foreground">No rows selected</div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-destructive">
        {formatUserFacingErrorMessage(
          error,
          "Failed to load the selected row.",
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto bg-background text-foreground shadow-md">
        <InfoPanel
          variant="search"
          activeTab={resource}
          selectedIds={selectedIds}
          selectedRow={selectedRow}
          isLoading={isLoading}
          isAllPagesSelected={isAllPagesSelected}
          totalItems={totalItems}
        />
      </div>
    </div>
  );
}
