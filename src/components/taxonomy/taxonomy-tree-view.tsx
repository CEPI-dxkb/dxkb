"use client";

import type {
  CSSProperties,
  Dispatch,
  RefObject,
  SetStateAction,
} from "react";
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

// Column width for the `w-(--col-size)` class. A column without a size (0)
// leaves `--col-size` unset, so its width stays auto, as it did when the
// inline width was `undefined`.
function columnSize(size: number): string | undefined {
  return size ? `${String(size)}px` : undefined;
}

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
            size="xs"
            className="w-full table-auto border-collapse"
            disableScrollWrapper
          >
            <TreeTableHeader table={table} />
            <TableBody>
              {rows.length === 0 ? (
                <TableRow className="flex w-full">
                  {/* The cell stays unstyled; its HEAD border, padding and text
                      live on a block wrapper that fills it exactly. */}
                  <TableCell className="w-full p-0">
                    <div className="border-t px-2 py-8 text-center text-muted-foreground">
                      No results
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {paddingTop > 0 && (
                    <tr
                      className="h-(--spacer-height)"
                      style={
                        {
                          "--spacer-height": `${String(paddingTop)}px`,
                        } as CSSProperties
                      }
                    />
                  )}
                  {virtualItems.map((item) => (
                    <TreeBodyRow
                      key={rows[item.index].id}
                      row={rows[item.index]}
                      selected={rowSelection[rows[item.index].id] ?? false}
                      onClick={handleRowClick}
                    />
                  ))}
                  {paddingBottom > 0 && (
                    <tr
                      className="flex h-(--spacer-height)"
                      style={
                        {
                          "--spacer-height": `${String(paddingBottom)}px`,
                        } as CSSProperties
                      }
                    >
                      {table.getVisibleLeafColumns().map((column) => (
                        <td
                          key={column.id}
                          className={clsx(
                            "w-(--col-size) border-r border-border",
                            column.id === "taxon_name" && "flex-1",
                          )}
                          style={
                            {
                              "--col-size": columnSize(column.getSize()),
                            } as CSSProperties
                          }
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
    <TableHeader variant="muted" className="sticky top-0 z-30">
      {table.getHeaderGroups().map((group) => (
        <TableRow key={group.id} variant="muted-header" className="flex">
          {group.headers.map((header) => (
            <TableHead
              key={header.id}
              variant="divider"
              className={clsx(
                "flex h-8 w-(--col-size) items-center px-2 py-0",
                header.column.id === "taxon_name" && "flex-1",
                (header.column.id === "__select__" ||
                  header.column.id === "trees") &&
                  "justify-center",
                header.column.id === "genomes" && "justify-end",
              )}
              style={
                {
                  "--col-size": columnSize(header.getSize()),
                } as CSSProperties
              }
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
      style={
        {
          "--row-height": `${String(taxonomyRowHeight)}px`,
        } as CSSProperties
      }
      variant="tint"
      data-state={selected ? "selected" : undefined}
      className="flex h-(--row-height) cursor-pointer items-center"
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell
          key={cell.id}
          variant="divider"
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
            "flex h-(--row-height) w-(--col-size) items-center overflow-hidden px-2",
            cell.column.id === "__select__" && "cursor-pointer",
            cell.column.id === "taxon_name" && "flex-1",
            cell.column.id === "__select__" || cell.column.id === "trees"
              ? "justify-center"
              : cell.column.id === "genomes"
                ? "justify-end"
                : "justify-start",
          )}
          style={
            {
              "--col-size": columnSize(cell.column.getSize()),
            } as CSSProperties
          }
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
