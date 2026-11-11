"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

import { useVirtualizer } from "@tanstack/react-virtual";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { ReferenceGenome } from "@/lib/services/organisms/reference-genomes";
import { genomeHref } from "@/lib/views/hrefs";

const badgeVariantForType: Record<string, "default" | "secondary" | "outline"> = {
  Reference: "default",
  Representative: "secondary",
};

const rowHeight = 32;
const defaultTypeColumnWidth = 144;
const minTypeColumnWidth = 96;
const maxTypeColumnWidth = 480;
const minGenomeNameColumnWidth = 160;

// Exported for the test that pins its memoized sort; the card is the only user.
export function GenomeTable({
  genomes,
  count,
  sortable = true,
}: {
  genomes: ReferenceGenome[];
  /** Genomes the tab has in all; above `genomes.length` when the list is partial. */
  count?: number;
  /** False for a partial list: sorting it client-side would misorder it. */
  sortable?: boolean;
}) {
  "use no memo";
  const [storedSortDir, setSortDir] = useState<"asc" | "desc" | null>(null);
  // A list that turns partial keeps its server order: its header has no sort
  // control to undo an earlier direction.
  const sortDir = sortable ? storedSortDir : null;
  const parentRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(320);
  const [typeColumnWidth, setTypeColumnWidth] = useState(defaultTypeColumnWidth);
  const [isResizingTypeColumn, setIsResizingTypeColumn] = useState(false);

  useEffect(() => {
    const node = parentRef.current;
    if (!node) return;
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const h = entry.contentRect.height;
      if (h && h > 0) setContainerHeight(h);
    });
    ro.observe(node);
    return () => { ro.disconnect(); };
  }, []);

  // This component is opted out of the compiler, so without useMemo the sort
  // would re-run on every scroll (each virtualizer range change re-renders).
  const sorted = useMemo(
    () =>
      sortDir === null
        ? genomes
        : [...genomes].sort((a, b) => {
            const cmp = a.genome_name.localeCompare(b.genome_name);
            return sortDir === "asc" ? cmp : -cmp;
          }),
    [genomes, sortDir],
  );

  const rowVirtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 15,
  });

  const SortIcon =
    sortDir === "asc" ? ArrowUp : sortDir === "desc" ? ArrowDown : ArrowUpDown;
  const ariaSort =
    sortDir === "asc" ? "ascending" : sortDir === "desc" ? "descending" : "none";

  function cycleSort() {
    setSortDir((d) => (d === null ? "asc" : d === "asc" ? "desc" : null));
  }

  function resizeTypeColumn(nextWidth: number) {
    const tableWidth = parentRef.current?.clientWidth;
    const maxWidth = tableWidth
      ? Math.min(
          maxTypeColumnWidth,
          Math.max(minTypeColumnWidth, tableWidth - minGenomeNameColumnWidth),
        )
      : maxTypeColumnWidth;
    setTypeColumnWidth(
      Math.min(Math.max(nextWidth, minTypeColumnWidth), maxWidth),
    );
  }

  function startColumnResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = typeColumnWidth;
    setIsResizingTypeColumn(true);
    event.currentTarget.setPointerCapture(event.pointerId);

    const handle = event.currentTarget;
    const onPointerMove = (moveEvent: PointerEvent) => {
      resizeTypeColumn(startWidth + moveEvent.clientX - startX);
    };
    const onPointerUp = (upEvent: PointerEvent) => {
      setIsResizingTypeColumn(false);
      if (handle.hasPointerCapture(upEvent.pointerId)) {
        handle.releasePointerCapture(upEvent.pointerId);
      }
      handle.removeEventListener("pointermove", onPointerMove);
      handle.removeEventListener("pointerup", onPointerUp);
      handle.removeEventListener("pointercancel", onPointerUp);
    };

    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", onPointerUp);
    handle.addEventListener("pointercancel", onPointerUp);
  }

  const virtualItems = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualItems[0]?.start ?? 0;
  const paddingBottom =
    virtualItems.length > 0
      ? rowVirtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end ?? 0)
      : 0;
  const fillerCount = Math.max(0, Math.floor((containerHeight - rowHeight) / rowHeight) - sorted.length);

  return (
    <div
      ref={parentRef}
      // A focusable scroll container lets keyboard users scroll the list (axe
      // scrollable-region-focusable).
      tabIndex={0}
      role="group"
      aria-label="Genome list (scrollable)"
      className="h-80 scrollbar-thin overflow-auto rounded-lg border xl:min-h-0 xl:flex-1"
    >
      <Table disableScrollWrapper className="table-fixed">
        <colgroup>
          <col
            className="w-(--type-col-width)"
            style={{ "--type-col-width": `${String(typeColumnWidth)}px` } as CSSProperties}
          />
          <col />
        </colgroup>
        <TableHeader variant="muted" className="sticky top-0 z-10">
          <TableRow className="h-8">
            <TableHead
              variant="divider-strong"
              size="xs"
              className="group relative h-[31.5px]! px-3 py-1 text-center"
            >
              Type
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize Type column"
                aria-valuemin={minTypeColumnWidth}
                aria-valuemax={
                  parentRef.current?.clientWidth
                    ? Math.min(
                        maxTypeColumnWidth,
                        Math.max(
                          minTypeColumnWidth,
                          parentRef.current.clientWidth - minGenomeNameColumnWidth,
                        ),
                      )
                    : maxTypeColumnWidth
                }
                aria-valuenow={typeColumnWidth}
                tabIndex={0}
                onPointerDown={startColumnResize}
                onDoubleClick={() => {
                  resizeTypeColumn(defaultTypeColumnWidth);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    resizeTypeColumn(typeColumnWidth - 10);
                  } else if (event.key === "ArrowRight") {
                    event.preventDefault();
                    resizeTypeColumn(typeColumnWidth + 10);
                  }
                }}
                className="absolute top-0 right-0 z-30 flex h-full w-2 translate-x-1/2 cursor-col-resize touch-none select-none focus-visible:outline-2 focus-visible:outline-primary"
              >
                <div
                  className={cn(
                    "mx-auto h-full w-1 transition-opacity",
                    isResizingTypeColumn
                      ? "bg-info opacity-100"
                      : "bg-muted-foreground opacity-0 group-hover:opacity-100",
                  )}
                />
              </div>
            </TableHead>
            {sortable ? (
              <TableHead
                aria-sort={ariaSort}
                size="xs"
                className="h-[31.5px]! overflow-hidden p-0"
              >
                <button
                  type="button"
                  onClick={cycleSort}
                  aria-label={`Sort by genome name (${ariaSort})`}
                  className="flex size-full cursor-pointer items-center gap-1 px-3 py-1 text-left select-none"
                >
                  Genome Name
                  <SortIcon className="size-3 shrink-0" />
                </button>
              </TableHead>
            ) : (
              <TableHead size="xs" className="h-[31.5px]! px-3 py-1">
                Genome Name
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 && (count ?? 0) === 0 ? (
            <TableRow>
              <TableCell colSpan={2} className="py-4 text-center">
                <span className="text-muted-foreground">
                  No genomes in this category.
                </span>
              </TableCell>
            </TableRow>
          ) : (
            <>
              {paddingTop > 0 && (
                <tr
                  className="h-(--spacer-height)"
                  style={{ "--spacer-height": `${String(paddingTop)}px` } as CSSProperties}
                />
              )}
              {virtualItems.map((virtualItem) => {
                const g = sorted[virtualItem.index];
                return (
                  <TableRow
                    key={g.genome_id}
                    variant={virtualItem.index % 2 === 1 ? "striped" : "default"}
                    className="h-8"
                  >
                    <TableCell variant="divider-strong" className="px-3 py-1">
                      <div className="flex items-center justify-center">
                        <Badge
                          variant={badgeVariantForType[g.reference_genome] ?? "outline"}
                          size="sm"
                        >
                          {g.reference_genome}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="overflow-hidden px-3 py-1">
                      <Link
                        href={genomeHref(g.genome_id)}
                        prefetch={false}
                        className="block truncate text-sm text-primary hover:underline dark:text-link"
                        title={g.genome_name}
                      >
                        {g.genome_name}
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
              {paddingBottom > 0 && (
                <tr
                  className="h-(--spacer-height)"
                  style={{ "--spacer-height": `${String(paddingBottom)}px` } as CSSProperties}
                />
              )}
              {Array.from({ length: fillerCount }, (_, i) => (
                <TableRow
                  key={`filler-${String(i)}`}
                  variant={(sorted.length + i) % 2 === 1 ? "striped" : "default"}
                  className="h-8"
                >
                  <TableCell variant="divider-strong" className="px-3 py-1" />
                  <TableCell className="px-3 py-1" />
                </TableRow>
              ))}
            </>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

interface ReferenceGenomesHrefs {
  all?: string;
  byType: Record<string, string | undefined>;
}

/** What follows a tab's table when it lists only some of its genomes. */
function ShowingNote({
  shown,
  count,
  href,
}: {
  shown: number;
  count: number;
  href: string | undefined;
}) {
  if (shown >= count) return null;
  return (
    <p className="px-3 py-2 text-xs text-muted-foreground">
      Showing {shown.toLocaleString("en-US")} of {count.toLocaleString("en-US")}.{" "}
      {href && (
        <Link
          href={href}
          prefetch={false}
          className="text-primary hover:underline dark:text-link"
        >
          View all {count.toLocaleString("en-US")} in the Genomes tab
        </Link>
      )}
    </p>
  );
}

export function ReferenceGenomesClient({
  rows,
  counts,
  total,
  hrefs,
}: {
  rows: ReferenceGenome[];
  counts: Record<string, number>;
  total: number;
  hrefs: ReferenceGenomesHrefs;
}) {
  const types = Object.keys(counts).sort();
  const byType = Object.fromEntries(
    types.map((t) => [t, rows.filter((g) => g.reference_genome === t)]),
  );

  return (
    <Card variant="panel" className="h-full xl:min-h-0 xl:flex-1" size="sm">
      <Tabs defaultValue="all" className="xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
        <CardHeader className="pb-0">
          <h2 className="text-base leading-snug font-medium">
            Reference &amp; Representative Genomes
          </h2>
          <TabsList className="mt-2 w-full">
            <TabsTrigger value="all" size="xs" className="flex-1">
              All ({total.toLocaleString("en-US")})
            </TabsTrigger>
            {types.map((type) => (
              <TabsTrigger key={type} value={type} size="xs" className="flex-1">
                {type} ({counts[type].toLocaleString("en-US")})
              </TabsTrigger>
            ))}
          </TabsList>
        </CardHeader>

        <CardContent className="p-0 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
          <TabsContent value="all" className="mt-0 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
            <GenomeTable genomes={rows} count={total} sortable={rows.length >= total} />
            <ShowingNote shown={rows.length} count={total} href={hrefs.all} />
          </TabsContent>

          {types.map((type) => (
            <TabsContent key={type} value={type} className="mt-0 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
              <GenomeTable
                genomes={byType[type]}
                count={counts[type]}
                sortable={byType[type].length >= counts[type]}
              />
              <ShowingNote
                shown={byType[type].length}
                count={counts[type]}
                href={hrefs.byType[type]}
              />
            </TabsContent>
          ))}
        </CardContent>
      </Tabs>
    </Card>
  );
}
