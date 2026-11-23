"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { useVirtualizer } from "@tanstack/react-virtual";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

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
import type { ReferenceGenome } from "@/lib/services/organisms/reference-genomes";
import { genomeHref } from "@/lib/views/hrefs";

const rowHeight = 32;

// Exported for the test that pins its memoized sort; the card is the only user.
export function GenomeTable({
  genomes,
  count,
  sortable = true,
  showType = true,
}: {
  genomes: ReferenceGenome[];
  /** Genomes the tab has in all; above `genomes.length` when the list is partial. */
  count?: number;
  /** False for a partial list: sorting it client-side would misorder it. */
  sortable?: boolean;
  /**
   * False on a type tab (its trigger already names the type) and on All when
   * fewer than two types have genomes (every row would repeat the one type):
   * the column would only repeat it and cost Genome Name its width.
   */
  showType?: boolean;
}) {
  "use no memo";
  const [storedSortDir, setSortDir] = useState<"asc" | "desc" | null>(null);
  // A list that turns partial keeps its server order: its header has no sort
  // control to undo an earlier direction.
  const sortDir = sortable ? storedSortDir : null;
  const parentRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(320);

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
            // Equal names fall back to the id, so a re-sort is stable and the
            // GenBank/RefSeq copies of one genome always come in the same order.
            // Ids compare as strings, like the server's sort(+genome_name,
            // +genome_id), so the first client sort keeps the server's order of
            // ties instead of swapping "x.9" and "x.10".
            const cmp =
              a.genome_name.localeCompare(b.genome_name) ||
              a.genome_id.localeCompare(b.genome_id);
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
      className="@container h-80 scrollbar-thin overflow-auto rounded-lg border xl:min-h-0 xl:flex-1"
    >
      <Table disableScrollWrapper className="table-fixed">
        <colgroup>
          {showType && <col className="w-28" />}
          <col />
          {/* The accession column shows only when the scroll container above
              (not the viewport: on desktop the card sits in a narrow column,
              and the container is about 26px narrower than the card) is at
              least @md (448px) wide, so Genome Name keeps at least 160px beside
              the Type column (112px, on the All tab only) and this column
              (144px: its header label needs about 138px). One pixel wide
              below that, because WebKit treats `width: 0` on a `<col>` as
              unset under `table-layout: fixed`, and since this column's cells
              are display:none there, nothing else gives it a width: it takes
              an auto share and splits the width left over beside the Type
              column with Genome Name, while 1px is honored; and still not
              display:none on the col, because the empty row's colSpan would
              then make the table grid add an implicit extra column that takes
              half of the Genome Name column's width. */}
          <col className="w-px @md:w-36" />
        </colgroup>
        <TableHeader variant="muted" className="sticky top-0 z-10">
          <TableRow className="h-8">
            {showType && (
              <TableHead
                variant="divider-strong"
                size="xs"
                className="h-[31.5px]! px-2 py-1 text-center"
              >
                Type
              </TableHead>
            )}
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
            <TableHead
              size="xs"
              className="hidden h-[31.5px]! px-3 py-1 @md:table-cell"
            >
              <span className="block truncate">GenBank Accession</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 && (count ?? 0) === 0 ? (
            <TableRow>
              <TableCell colSpan={showType ? 3 : 2} className="py-4 text-center">
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
                    {showType && (
                      <TableCell
                        variant="divider-strong"
                        className="overflow-hidden px-2 py-1 text-center"
                      >
                        <span
                          className="block truncate text-xs text-muted-foreground"
                          title={g.reference_genome}
                        >
                          {g.reference_genome}
                        </span>
                      </TableCell>
                    )}
                    <TableCell className="overflow-hidden px-3 py-1">
                      <Link
                        href={genomeHref(g.genome_id)}
                        prefetch={false}
                        className="block truncate text-sm text-primary hover:underline dark:text-link"
                        // The accession is what tells the GenBank and RefSeq
                        // copies of one genome apart where the accession
                        // column is hidden (the narrow desktop column).
                        title={
                          g.genbank_accessions
                            ? `${g.genome_name} (${g.genbank_accessions})`
                            : g.genome_name
                        }
                      >
                        {g.genome_name}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden overflow-hidden px-3 py-1 @md:table-cell">
                      <span
                        className="block truncate text-sm text-muted-foreground"
                        title={g.genbank_accessions}
                      >
                        {g.genbank_accessions}
                      </span>
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
                  {showType && (
                    <TableCell variant="divider-strong" className="px-2 py-1" />
                  )}
                  <TableCell className="px-3 py-1" />
                  <TableCell className="hidden px-3 py-1 @md:table-cell" />
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
  // `counts` are whole-taxon totals, so a partial list still knows both types
  // are present; with fewer than two, every All row would repeat the one type.
  const showType = types.filter((type) => counts[type] > 0).length > 1;
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
            <GenomeTable
              genomes={rows}
              count={total}
              sortable={rows.length >= total}
              showType={showType}
            />
            <ShowingNote shown={rows.length} count={total} href={hrefs.all} />
          </TabsContent>

          {types.map((type) => (
            <TabsContent key={type} value={type} className="mt-0 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
              <GenomeTable
                genomes={byType[type]}
                count={counts[type]}
                sortable={byType[type].length >= counts[type]}
                showType={false}
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
