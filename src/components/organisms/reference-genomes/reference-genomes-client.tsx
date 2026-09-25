"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { useVirtualizer } from "@tanstack/react-virtual";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const badgeVariantForType: Record<string, "default" | "secondary" | "outline"> = {
  Reference: "default",
  Representative: "secondary",
};

const rowHeight = 32; // h-8
const defaultTypeColumnWidth = 144;
const minTypeColumnWidth = 96;
const maxTypeColumnWidth = 480;
const minGenomeNameColumnWidth = 160;

function GenomeTable({ genomes }: { genomes: ReferenceGenome[] }) {
  "use no memo";
  const [sortDir, setSortDir] = useState<"asc" | "desc" | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(320); // h-80 default
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

  const sorted =
    sortDir === null
      ? genomes
      : [...genomes].sort((a, b) => {
          const cmp = a.genome_name.localeCompare(b.genome_name);
          return sortDir === "asc" ? cmp : -cmp;
        });

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

  // Cycle null → asc → desc → null so the user can return to insertion order.
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
      // Keyboard users must be able to scroll the virtualized list; a focusable
      // scroll container satisfies WCAG (axe scrollable-region-focusable).
      tabIndex={0}
      role="group"
      aria-label="Genome list (scrollable)"
      className="h-80 scrollbar-thin overflow-auto rounded-lg border xl:min-h-0 xl:flex-1"
    >
      <Table disableScrollWrapper className="table-fixed">
        <colgroup>
          <col style={{ width: typeColumnWidth }} />
          <col />
        </colgroup>
        <TableHeader className="sticky top-0 z-10 bg-muted">
          <TableRow className="h-8">
            <TableHead className="group relative h-[31.5px]! border-r border-foreground/20 px-3 py-1 text-center text-xs">
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
                      ? "bg-blue-500 opacity-100"
                      : "bg-muted-foreground opacity-0 group-hover:opacity-100",
                  )}
                />
              </div>
            </TableHead>
            <TableHead
              aria-sort={ariaSort}
              className="h-[31.5px]! overflow-hidden p-0 text-xs"
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
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 ? (
            <TableRow>
              <TableCell colSpan={2} className="py-4 text-center text-sm text-muted-foreground">
                No genomes in this category.
              </TableCell>
            </TableRow>
          ) : (
            <>
              {paddingTop > 0 && <tr style={{ height: paddingTop }} />}
              {virtualItems.map((virtualItem) => {
                const g = sorted[virtualItem.index];
                return (
                  <TableRow
                    key={g.genome_id}
                    className={cn("h-8", virtualItem.index % 2 === 1 && "bg-muted/20")}
                  >
                    <TableCell className="border-r border-foreground/20 px-3 py-1">
                      <div className="flex items-center justify-center">
                        <Badge
                          variant={badgeVariantForType[g.reference_genome] ?? "outline"}
                          className="text-2xs"
                        >
                          {g.reference_genome}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="overflow-hidden px-3 py-1">
                      <Link
                        href={`https://www.bv-brc.org/view/Genome/${g.genome_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-sm text-primary hover:underline"
                        title={g.genome_name}
                      >
                        {g.genome_name}
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
              {paddingBottom > 0 && <tr style={{ height: paddingBottom }} />}
              {Array.from({ length: fillerCount }, (_, i) => (
                <TableRow
                  key={`filler-${String(i)}`}
                  className={cn("h-8", (sorted.length + i) % 2 === 1 && "bg-muted/20")}
                >
                  <TableCell className="border-r border-foreground/20 px-3 py-1" />
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

export function ReferenceGenomesClient({ genomes }: { genomes: ReferenceGenome[] }) {
  const types = Array.from(new Set(genomes.map((g) => g.reference_genome))).sort();
  const byType = Object.fromEntries(
    types.map((t) => [t, genomes.filter((g) => g.reference_genome === t)]),
  );

  return (
    <Card className="h-full rounded-lg xl:min-h-0 xl:flex-1" size="sm">
      <Tabs defaultValue="all" className="xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
        <CardHeader className="pb-0">
          <CardTitle className="text-base!">Reference &amp; Representative Genomes</CardTitle>
          <TabsList className="mt-2 w-full">
            <TabsTrigger value="all" className="flex-1 text-xs">
              All ({genomes.length})
            </TabsTrigger>
            {types.map((type) => (
              <TabsTrigger key={type} value={type} className="flex-1 text-xs">
                {type} ({byType[type].length})
              </TabsTrigger>
            ))}
          </TabsList>
        </CardHeader>

        <CardContent className="p-0 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
          <TabsContent value="all" className="mt-0 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
            <GenomeTable genomes={genomes} />
          </TabsContent>

          {types.map((type) => (
            <TabsContent key={type} value={type} className="mt-0 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
              <GenomeTable genomes={byType[type]} />
            </TabsContent>
          ))}
        </CardContent>
      </Tabs>
    </Card>
  );
}
