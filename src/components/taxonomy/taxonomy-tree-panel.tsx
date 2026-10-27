"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ResourceWorkspace } from "@/components/views/resource-workspace";
import { InfoPanel } from "@/components/detail-panel/info-panel";
import {
  SearchActionBar,
  type SearchActionId,
} from "@/components/search/search-action-bar";
import { noServicesReason } from "@/components/search/search-action-policy";
import type { OrganismTaxonomy } from "@/lib/services/organisms/types";
import { taxonomyGenomesHref } from "@/lib/taxonomy-view";

import { TaxonomyTree } from "./taxonomy-tree";
import type { TaxonRecord } from "./taxon-tree-types";

const taxonomyGuideUrl =
  "https://bv-brc.org/docs/quick_references/organisms_taxon/taxonomy.html";

interface TaxonomyTreePanelProps {
  readonly taxa: readonly OrganismTaxonomy[];
  /** Root taxa whose taxonomy page has an enabled Phylogeny tab. */
  readonly phylogenyTaxonIds: readonly number[];
}

/**
 * Client shell for the taxonomy tab: the tree plus a detail panel for the
 * selected node. Kept separate from the make…View factory so the factory module
 * stays server-callable (buildTaxonomyNavItems invokes it during SSR), and so
 * ResourceWorkspace's resizable panels (which need ResizeObserver) live outside the
 * tree's jsdom unit tests.
 */
export function TaxonomyTreePanel({
  taxa,
  phylogenyTaxonIds,
}: TaxonomyTreePanelProps) {
  const router = useRouter();
  const [selectedRows, setSelectedRows] = useState<TaxonRecord[]>([]);
  const singleRow = selectedRows.length === 1 ? selectedRows[0] : null;
  const selectedTaxonIds = selectedRows.map((row) => String(row.taxon_id));

  function handleAction(actionId: SearchActionId) {
    if (actionId === "taxonOverview" && singleRow) {
      router.push(`/taxonomy/${String(singleRow.taxon_id)}?tab=overview`);
    } else if (actionId === "genomes") {
      router.push(
        singleRow
          ? `/taxonomy/${String(singleRow.taxon_id)}?tab=genomes`
          : taxonomyGenomesHref(selectedTaxonIds),
      );
    } else if (actionId === "features" && singleRow) {
      router.push(`/taxonomy/${String(singleRow.taxon_id)}?tab=features`);
    }
  }

  // No wrapper div: the shell's fill region already bounds height
  // (flex-1 min-h-0 overflow-hidden), and ResourceWorkspace wraps its children in a
  // flex-col overflow-hidden box of its own. Extra wrappers only risk breaking
  // the min-h-0 chain.
  return (
    <ResourceWorkspace
      hasSidePanel={selectedRows.length > 0}
      actionBar={
        <SearchActionBar
          selectedCount={selectedRows.length}
          searchType="taxonomy"
          guideUrl={taxonomyGuideUrl}
          enabledActions={["genomes", "features"]}
          // Legacy's Taxa Tree runs no service, unlike the Taxa list's BLAST.
          disabledActions={{
            services: noServicesReason("Taxon", "Taxa", selectedRows.length),
          }}
          onAction={handleAction}
        />
      }
      sidePanel={
        <InfoPanel
          variant="search"
          activeTab="taxonomy"
          selectedRow={singleRow}
          selectedIds={selectedRows.map((r) => String(r.taxon_id))}
        />
      }
    >
      <TaxonomyTree
        rootTaxa={taxa}
        phylogenyTaxonIds={phylogenyTaxonIds}
        onSelect={setSelectedRows}
      />
    </ResourceWorkspace>
  );
}
