"use client";

import type { Dispatch, RefObject, SetStateAction } from "react";
import {
  FlexRender,
  type Row,
  type RowSelectionState,
  type Table as TableModel,
} from "@tanstack/react-table";
import { X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TaxonRecord } from "./taxon-tree-types";
import {
  isPlaceholder,
  type TaxonomyTableFeatures,
} from "./taxonomy-tree-columns";
import { clsx } from "cn";

export const taxonomyRowHeight = 24;

interface TreeTableViewProps {
  table: TableModel<TaxonomyTableFeatures, TaxonRecord>;
  rows: Row<TaxonomyTableFeatures, TaxonRecord>[];
  rowSelection: RowSelectionState;
  virtualItems: { index: number; start: number; end: number }[];
  totalSize: number;
  scrollRef: RefObject<HTMLDivElement | null>;
  globalFilter: string;
  setGlobalFilter: Dispatch<SetStateAction<string>>;
  hasSelection: boolean;
  clearSelection: () => void;
  handleRowClick: (row: Row<TaxonomyTableFeatures, TaxonRecord>) => void;
  modifierHeld: boolean;
}

export function TreeTableView({
  table,
  rows,
  rowSelection,
  virtualItems,
  totalSize,
  scrollRef,
  globalFilter,
  setGlobalFilter,
  hasSelection,
  clearSelection,
  handleRowClick,
  modifierHeld,
}: TreeTableViewProps) {
  const paddingTop = virtualItems[0]?.start ?? 0;
  const paddingBottom =
    virtualItems.length > 0
      ? totalSize - (virtualItems[virtualItems.length - 1]?.end ?? 0)
      : 0;
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden text-xs">
      <div className="flex items-center gap-2 py-2">
        <input
          type="search"
          value={globalFilter}
          onChange={(event) => {
            setGlobalFilter(event.target.value);
          }}
          placeholder="Search by taxonomy name..."
          aria-label="Search by taxonomy name"
          className="w-full max-w-96 rounded-lg border border-border bg-background px-3 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        {hasSelection && (
          <button
            type="button"
            aria-label="Clear selected"
            onClick={clearSelection}
            className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-3" /> Clear selected
          </button>
        )}
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border">
        <div
          className={clsx(
            "h-full overflow-auto",
            modifierHeld && "select-none",
          )}
          ref={scrollRef}
        >
          <Table
            className="w-full table-auto border-collapse text-xs"
            disableScrollWrapper
          >
            <TreeTableHeader table={table} />
            <TableBody>
              {rows.length === 0 ? (
                <TableRow className="flex w-full">
                  <TableCell className="w-full border-t border-border py-8 text-center text-muted-foreground">
                    No results
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {paddingTop > 0 && <tr style={{ height: paddingTop }} />}
                  {virtualItems.map((item) => (
                    <TreeBodyRow
                      key={rows[item.index].id}
                      row={rows[item.index]}
                      selected={rowSelection[rows[item.index].id] ?? false}
                      onClick={handleRowClick}
                    />
                  ))}
                  {paddingBottom > 0 && (
                    <tr style={{ display: "flex", height: paddingBottom }}>
                      {table.getVisibleLeafColumns().map((column) => (
                        <td
                          key={column.id}
                          className="border-r border-border"
                          style={{
                            width: column.getSize() || undefined,
                            flex: column.id === "taxon_name" ? 1 : undefined,
                          }}
                        />
                      ))}
                    </tr>
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function TreeTableHeader({
  table,
}: {
  table: TableModel<TaxonomyTableFeatures, TaxonRecord>;
}) {
  return (
    <TableHeader
      className="bg-muted text-foreground"
      style={{ position: "sticky", top: 0, zIndex: 30 }}
    >
      {table.getHeaderGroups().map((group) => (
        <TableRow
          key={group.id}
          className="flex border-y border-border bg-muted"
        >
          {group.headers.map((header) => (
            <TableHead
              key={header.id}
              className="flex items-center border-r border-border px-2 py-0"
              style={{
                width: header.getSize() || undefined,
                height: 32,
                flex: header.column.id === "taxon_name" ? 1 : undefined,
                justifyContent:
                  header.column.id === "__select__" ||
                  header.column.id === "trees"
                    ? "center"
                    : header.column.id === "genomes"
                      ? "flex-end"
                      : undefined,
              }}
            >
              <FlexRender header={header} />
            </TableHead>
          ))}
        </TableRow>
      ))}
    </TableHeader>
  );
}

function TreeBodyRow({
  row,
  selected,
  onClick,
}: {
  row: Row<TaxonomyTableFeatures, TaxonRecord>;
  selected: boolean;
  onClick: (row: Row<TaxonomyTableFeatures, TaxonRecord>) => void;
}) {
  return (
    <TableRow
      onClick={() => {
        onClick(row);
      }}
      style={{ display: "flex", height: taxonomyRowHeight }}
      className={clsx(
        "cursor-pointer items-center",
        selected ? "bg-primary/15 dark:bg-primary/30" : "hover:bg-muted",
      )}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell
          key={cell.id}
          onClick={
            cell.column.id === "__select__" && row.getCanSelect()
              ? (event) => {
                  event.stopPropagation();
                  if (
                    !(event.target as HTMLElement).closest(
                      'input[type="checkbox"]',
                    )
                  ) {
                    cell
                      .getContext()
                      .table.options.meta?.onCheckboxClick(row.id);
                  }
                }
              : undefined
          }
          className={clsx(
            "flex items-center overflow-hidden border-r border-border px-2",
            cell.column.id === "__select__" && "cursor-pointer",
          )}
          style={{
            width: cell.column.getSize() || undefined,
            flex: cell.column.id === "taxon_name" ? 1 : undefined,
            height: taxonomyRowHeight,
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            justifyContent:
              cell.column.id === "__select__" || cell.column.id === "trees"
                ? "center"
                : cell.column.id === "genomes"
                  ? "flex-end"
                  : "flex-start",
          }}
        >
          {cell.column.id === "__select__" && !isPlaceholder(row.original) ? (
            <input
              type="checkbox"
              aria-label={`Select ${row.original.taxon_name}`}
              checked={selected}
              disabled={!row.getCanSelect()}
              onChange={() => {
                cell.getContext().table.options.meta?.onCheckboxClick(row.id);
              }}
              onClick={(event) => {
                event.stopPropagation();
              }}
            />
          ) : (
            <FlexRender cell={cell} />
          )}
        </TableCell>
      ))}
    </TableRow>
  );
}
