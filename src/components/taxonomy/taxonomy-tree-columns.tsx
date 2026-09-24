"use client";

import Link from "next/link";
import {
  columnFilteringFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createExpandedRowModel,
  createFilteredRowModel,
  globalFilteringFeature,
  metaHelper,
  rowExpandingFeature,
  rowSelectionFeature,
  tableFeatures,
  type ColumnDef,
} from "@tanstack/react-table";
import { ChevronRight, Loader2, Network } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { numberFormatter } from "@/lib/services/organisms/utils";

import {
  rankBadgeDefault,
  rankConfig,
  type TaxonRecord,
} from "./taxon-tree-types";
import { clsx } from "cn";

const indentPx = 16;

export interface PlaceholderRecord extends TaxonRecord {
  __state: "error";
  __message?: string;
}

export interface TreeTableMeta {
  loadingParentIds: Set<number>;
  onCheckboxClick: (rowId: string) => void;
  clearAnchor: () => void;
}

export const taxonomyTableFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowExpandingFeature,
  rowSelectionFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  filteredRowModel: createFilteredRowModel(),
  expandedRowModel: createExpandedRowModel(),
  tableMeta: metaHelper<TreeTableMeta>(),
});

export type TaxonomyTableFeatures = typeof taxonomyTableFeatures;

export function isPlaceholder(
  record: TaxonRecord,
): record is PlaceholderRecord {
  return typeof (record as PlaceholderRecord).__state === "string";
}

export function numericId(record: TaxonRecord): number {
  return Number(record.taxon_id);
}

export const taxonomyColumns: ColumnDef<TaxonomyTableFeatures, TaxonRecord>[] =
  [
    {
      id: "__select__",
      header: ({ table }) => (
        <input
          type="checkbox"
          aria-label="Select all"
          checked={table.getIsAllRowsSelected()}
          ref={(element) => {
            if (element) {
              element.indeterminate =
                table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected();
            }
          }}
          onChange={(event) => {
            table.options.meta?.clearAnchor();
            table.getToggleAllRowsSelectedHandler()(event);
          }}
        />
      ),
      cell: ({ row, table }) =>
        isPlaceholder(row.original) ? null : (
          <input
            type="checkbox"
            aria-label={`Select ${row.original.taxon_name}`}
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onChange={() => {
              table.options.meta?.onCheckboxClick(row.id);
            }}
            onClick={(event) => {
              event.stopPropagation();
            }}
          />
        ),
      size: 36,
    },
    {
      id: "taxon_name",
      accessorKey: "taxon_name",
      header: "Name",
      cell: ({ row, table }) => {
        const record = row.original;
        if (isPlaceholder(record)) {
          return (
            <span
              style={{ paddingLeft: row.depth * indentPx }}
              className="text-xs text-red-600"
            >
              {`Error: ${record.__message ?? "failed to load sub-taxa"}`}
            </span>
          );
        }
        const loading = table.options.meta?.loadingParentIds.has(
          numericId(record),
        );
        return (
          <span
            className="flex items-center"
            style={{ paddingLeft: row.depth * indentPx }}
          >
            {row.getCanExpand() ? (
              <button
                type="button"
                aria-label={row.getIsExpanded() ? "Collapse" : "Expand"}
                className="mr-1 flex size-4 items-center justify-center text-muted-foreground hover:text-foreground"
                onClick={(event) => {
                  event.stopPropagation();
                  row.toggleExpanded();
                }}
              >
                {row.getIsExpanded() && loading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ChevronRight
                    className={clsx(
                      "size-3.5 transition-transform duration-200",
                      row.getIsExpanded() && "rotate-90",
                    )}
                  />
                )}
              </button>
            ) : (
              <span className="mr-1 inline-block size-4" />
            )}
            <Link
              href={`/taxonomy/${String(record.taxon_id)}`}
              className="truncate text-primary hover:underline dark:text-blue-400"
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              {record.taxon_name}
            </Link>
          </span>
        );
      },
    },
    {
      id: "taxon_rank",
      accessorKey: "taxon_rank",
      header: "Rank",
      cell: ({ row }) => {
        const rank = row.original.taxon_rank;
        if (isPlaceholder(row.original) || !rank) return null;
        return (
          <Badge
            variant="outline"
            className={clsx(
              "h-4 px-1.5 py-0 text-3xs leading-none font-normal",
              rankConfig[rank] ?? rankBadgeDefault,
            )}
          >
            {rank}
          </Badge>
        );
      },
      size: 120,
    },
    {
      id: "genomes",
      accessorKey: "genomes",
      header: "Genomes",
      cell: ({ row }) => {
        if (isPlaceholder(row.original)) return null;
        const genomes = row.original.genomes;
        return typeof genomes === "number"
          ? numberFormatter.format(genomes)
          : "";
      },
      size: 100,
    },
    {
      id: "trees",
      header: "Trees",
      cell: ({ row }) =>
        isPlaceholder(row.original) || row.depth !== 0 ? null : (
          <button
            type="button"
            disabled
            aria-label="View phylogenetic tree (coming soon)"
            title="Phylogenetic tree - coming soon"
            className="flex size-4 cursor-not-allowed items-center justify-center text-emerald-600 opacity-60"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <Network className="size-3.5" />
          </button>
        ),
      size: 64,
    },
  ];
