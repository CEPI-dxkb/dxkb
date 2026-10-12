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
  /** Keyed by BRC ID (`patric_id`), as BV-BRC's grid selects rows. */
  rowSelection: RowSelectionState;
  onRowSelectionChange: (selection: RowSelectionState) => void;
}

/**
 * Auto Grouping's Groups Grid on the shared DataTable (sorting, paging,
 * column menu, resizing, CSV/TXT export). DataTable leaves sorting and paging
 * to its owner, so this sorts all the rows and hands it one page. Exports
 * cover every row (or every selected row) in the current sort, not just the
 * page on screen.
 */
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
  // Deleting rows can leave the stored page past the last one.
  const page = Math.min(pageIndex, pageCount - 1);
  const pageRows = sortedRows.slice(
    page * metaCatsGroupsGridPageSize,
    (page + 1) * metaCatsGroupsGridPageSize,
  );
  const selectedIds = rows
    .filter((row) => row.patric_id in rowSelection)
    .map((row) => row.patric_id);

  return (
    // DataTable fills its parent, so the grid gets a fixed height to scroll in.
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
        // Every row is already here: a selection is just the rows checked.
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
