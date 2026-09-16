"use client";

import { useRef, useState } from "react";
import type { RowSelectionState } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { ListData } from "@/components/services/list-data";
import { ResourceWorkspace } from "@/components/views/resource-workspace";
import { GenomeDetailPanel } from "@/components/genome/genome-detail-panel";
import {
  SearchActionBar,
  notReady,
} from "@/components/search/search-action-bar";
import { VerticalMenu } from "@/components/ui/vertical-menu";
import { Button } from "@/components/ui/button";
import { searchDescriptors, searchHref } from "@/constants/search-info";
import { searchTypeMenuItems } from "@/constants/search-menu";
import { isDataResource } from "@/lib/data-api";
import type { DataResource } from "@/lib/data-api";
import { genomeHref, genomeIdFromRow } from "@/lib/views/hrefs";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface TypeSearchProps {
  /** The already-formatted search phrase, from `page.tsx`. */
  q: string;
  /** The legacy `type=` value `resolveLegacySearch` routed to this list. */
  searchtype: string;
}

/**
 * Quick-reference guides for the types that still render this list.
 * `SearchActionBar` hides its GUIDE button when there is no URL for the type,
 * so AMR Phenotypes — which has no quick reference in the BV-BRC doc set this
 * app links to anywhere else — shows no GUIDE button rather than a dead one.
 */
const guideUrls: Partial<Record<DataResource, string>> = {
  genome_sequence:
    "https://www.bv-brc.org/docs/quick_references/organisms_taxon/sequences.html",
};

/** How long an empty-selection notification waits before it is applied. */
const clearSelectionDelayMs = 120;

function TypeSearchList({
  q,
  resource,
}: {
  q: string;
  resource: DataResource;
}) {
  const router = useRouter();
  const clearTimeoutRef = useRef<number | null>(null);

  const [menuCollapsed, setMenuCollapsed] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedGenomeId, setSelectedGenomeId] = useState<string | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pageIndex, setPageIndex] = useState(0);
  const [isAllPagesSelected, setIsAllPagesSelected] = useState(false);
  const [totalItems, setTotalItems] = useState(0);

  const urlKey = `${resource}::${q}`;
  const [prevUrlKey, setPrevUrlKey] = useState(urlKey);
  if (prevUrlKey !== urlKey) {
    setPrevUrlKey(urlKey);
    setRowSelection({});
    setSelectedIds([]);
    setSelectedGenomeId(null);
    setPageIndex(0);
    setIsAllPagesSelected(false);
    setTotalItems(0);
  }

  // Keep the side panel open for multi-selection: use the last selected id
  // as the active row shown in the panel. This prevents the panel from
  // collapsing whenever the user selects an additional row while already
  // viewing details.
  const activeRowId =
    selectedIds.length > 0 ? selectedIds[selectedIds.length - 1] : null;

  const menuItems = searchTypeMenuItems.map((item) => ({
    icon: item.icon,
    label: item.label,
    isActive: item.key === resource,
    onClick: () => {
      // Canonical types go straight to their own route; the legacy types left
      // in this menu stay on `/search`, where `page.tsx` renders them here.
      const descriptor = searchDescriptors.find(
        (searchType) => searchType.id === item.key,
      );
      if (descriptor?.route.status === "canonical") {
        router.push(searchHref(descriptor, q));
        return;
      }
      const params = new URLSearchParams();
      params.set("type", item.key);
      if (q) params.set("q", q);
      router.push(`/search?${params.toString()}`);
    },
  }));

  return (
    // Ensure this container fills the available height so child panels using
    // h-full can correctly constrain their inner scroll areas. Without an
    // explicit h-full some descendants may compute height auto and allow
    // children to expand the page (pushing the footer).
    <div className="flex h-full min-h-0 flex-1">
      {/* Left collapsible nav — compact card, self-sized like LandingNav */}
      <div className="shrink-0 scrollbar-none overflow-y-auto p-2 [&::-webkit-scrollbar]:hidden">
        <div className="w-fit rounded-lg border bg-card shadow-sm">
          <div className="flex items-center justify-end p-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setMenuCollapsed((c) => !c);
              }}
              title={
                menuCollapsed ? "Expand navigation" : "Collapse navigation"
              }
            >
              {menuCollapsed ? (
                <ChevronRight className="size-4" />
              ) : (
                <ChevronLeft className="size-4" />
              )}
            </Button>
          </div>
          <div className="p-2 pt-0">
            <VerticalMenu items={menuItems} isCollapsed={menuCollapsed} />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ResourceWorkspace
          hasSidePanel={!!activeRowId}
          actionBar={
            <SearchActionBar
              selectedCount={
                isAllPagesSelected ? totalItems : selectedIds.length
              }
              searchType={resource}
              guideUrl={guideUrls[resource]}
              disabledActions={{
                // Exports live with the collection views; the action bar has no
                // handler here. The table's own toolbar owns the working
                // downloads for this list.
                download: notReady,
                // GENOME opens the genome behind the selected row, so it needs
                // a genome id on that row. Disabling with a reason is what
                // keeps it from being an enabled button that does nothing.
                genome:
                  selectedGenomeId === null
                    ? "No genome is associated with this row."
                    : undefined,
              }}
              onAction={(actionId) => {
                if (actionId === "genome" && selectedGenomeId) {
                  window.open(
                    genomeHref(selectedGenomeId),
                    "_blank",
                    "noopener,noreferrer",
                  );
                }
              }}
            />
          }
          sidePanel={
            <GenomeDetailPanel
              genomeId={activeRowId}
              activeTab={resource}
              selectedIds={selectedIds}
              isAllPagesSelected={isAllPagesSelected}
              totalItems={totalItems}
            />
          }
        >
          <ListData
            resource={resource}
            q={`keyword(${encodeURIComponent(q)})`}
            selectedIds={selectedIds}
            onSelectionChange={(ids) => {
              if (!Array.isArray(ids)) return;

              // Debounce handling of empty selection notifications. Some
              // interactions/firehose events can emit a transient empty
              // selection which would immediately clear the user's
              // cross-page selection; to avoid that we wait briefly before
              // clearing so a follow-up selection can cancel the clear.

              // If there is a pending clear, cancel it whenever we get a new event
              if (clearTimeoutRef.current) {
                window.clearTimeout(clearTimeoutRef.current);
                clearTimeoutRef.current = null;
              }

              if (ids.length === 0) {
                // Schedule clearing after a short delay unless another
                // selection arrives.
                clearTimeoutRef.current = window.setTimeout(() => {
                  setSelectedIds([]);
                  clearTimeoutRef.current = null;
                }, clearSelectionDelayMs);
                return;
              }

              // Immediate merge for non-empty updates
              setSelectedIds((prev) => {
                const next = new Set(prev);
                const selectedIdSet = new Set(ids);

                // Add new ones
                selectedIdSet.forEach((id) => {
                  if (id) next.add(id);
                });

                // Remove ones that are no longer selected on this page
                prev.forEach((id) => {
                  if (!selectedIdSet.has(id)) {
                    next.delete(id);
                  }
                });

                return Array.from(next);
              });
            }}
            onSelectedRowChange={(row) => {
              setSelectedGenomeId(genomeIdFromRow(row));
            }}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            pageIndex={pageIndex}
            onPageChange={setPageIndex}
            isAllPagesSelected={isAllPagesSelected}
            onAllPagesSelectionChange={setIsAllPagesSelected}
            onTotalItemsChange={setTotalItems}
          />
        </ResourceWorkspace>
      </div>
    </div>
  );
}

export function TypeSearch({ q, searchtype }: TypeSearchProps) {
  // `page.tsx` renders this only for a descriptor `resolveLegacySearch`
  // classified as `typeSearch`, and `search-type-routing.test.ts` asserts every
  // such type is a registered `DataResource` named exactly like its one tab.
  // A type that is not one has no list to render; saying so is what the
  // `?? "genome"` fallbacks this replaces did not do — they rendered the Genome
  // tab group under another type's name.
  if (!isDataResource(searchtype)) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        There is no result list for &ldquo;{searchtype}&rdquo;.
      </div>
    );
  }
  return <TypeSearchList q={q} resource={searchtype} />;
}
