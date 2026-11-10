"use client";

import { useState } from "react";
import type { RowSelectionState, SortingState } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";
import { downloadResourceExport } from "@/components/views/resource-export";
import type { AutoGroupItem } from "@/lib/forms/(protein-tools)/meta-cats/meta-cats-form-schema";
import {
  metaCatsGroupsGridColumns,
  metaCatsGroupsGridPageSize,
  sortMetaCatsAutoGroups,
} from "@/lib/forms/(protein-tools)/meta-cats/meta-cats-form-utils";

const resource = "meta-cats-groups";
const columnIds = metaCatsGroupsGridColumns.map((column) => column.id);

interface MetaCatsGroupsGridProps {
  rows: AutoGroupItem[];
  rowSelection: RowSelectionState;
  onRowSelectionChange: (selection: RowSelectionState) => void;
}

export function MetaCatsGroupsGrid({
  rows,
  rowSelection,
  onRowSelectionChange,
}: MetaCatsGroupsGridProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pageIndex, setPageIndex] = useState(0);

  const sortedRows = sortMetaCatsAutoGroups(rows, sorting);
  const pageCount = Math.max(
    1,
    Math.ceil(sortedRows.length / metaCatsGroupsGridPageSize),
  );
  const page = Math.min(pageIndex, pageCount - 1);
  const pageRows = sortedRows.slice(
    page * metaCatsGroupsGridPageSize,
    (page + 1) * metaCatsGroupsGridPageSize,
  );
  const selectedIds = rows
    .filter((row) => row.patric_id in rowSelection)
    .map((row) => row.patric_id);

  return (
    <div className="flex h-96 flex-col">
      <DataTable
        id="meta-cats-groups-grid"
        resource={resource}
        idField="patric_id"
        columns={metaCatsGroupsGridColumns}
        data={pageRows}
        totalItems={rows.length}
        pageIndex={page}
        pageSize={metaCatsGroupsGridPageSize}
        onPageChange={setPageIndex}
        sorting={sorting}
        onSortingChange={setSorting}
        rowSelection={rowSelection}
        onRowSelectionChange={onRowSelectionChange}
        crossPageSelection={false}
        selectedIds={selectedIds}
        totalSelectedCount={selectedIds.length}
        onDownloadAll={(format, visibleColumns) => {
          downloadResourceExport(
            resource,
            sortedRows,
            metaCatsGroupsGridColumns,
            visibleColumns ?? columnIds,
            format,
          );
        }}
        onDownloadSelected={(format, ids, visibleColumns) => {
          const selected = new Set(ids);
          downloadResourceExport(
            resource,
            sortedRows.filter((row) => selected.has(row.patric_id)),
            metaCatsGroupsGridColumns,
            visibleColumns ?? columnIds,
            format,
            "selected",
          );
        }}
        scrollRegionLabel="Groups grid"
        emptyMessage="No features added. Select a feature group and click + to add."
      />
    </div>
  );
}
