import type { OrganismViewKey } from "@/components/organisms/types";
import type { OrganismTaxonomy } from "@/lib/services/organisms/types";

import type { CuratedLists } from "./curated-lists";

export interface PhyloManifest {
  trees: Record<string, unknown>;
}

/** `absent` is a definite zero; a read that failed or came back malformed is `unknown`, which never disables a tab. */
export type TabDataStatus = "present" | "absent" | "unknown";

export type TabAvailability = Partial<Record<OrganismViewKey, TabDataStatus>>;

export interface TabContext {
  taxonomy: {
    taxonId: number;
    lineageNames: readonly string[];
    lineageIds: readonly number[];
    scopeRootIds: readonly number[];
    scopeLineageNames: readonly string[];
    scopeLineageIds: readonly number[];
  };
  phyloManifest: PhyloManifest | null; // null ⇒ fetch failed → fail-open
  curatedLists: CuratedLists;
}

export function buildTabContext(
  taxon: OrganismTaxonomy | null,
  manifest: PhyloManifest | null,
  lists: CuratedLists,
  scopeRoots: readonly OrganismTaxonomy[] = taxon ? [taxon] : [],
): TabContext {
  return {
    taxonomy: {
      taxonId: taxon?.taxonId ?? 0,
      lineageNames: taxon?.lineageNames ?? [],
      lineageIds: taxon?.lineageIds ?? [],
      scopeRootIds: scopeRoots.map((root) => root.taxonId),
      scopeLineageNames: scopeRoots.flatMap((root) => root.lineageNames),
      scopeLineageIds: scopeRoots.flatMap((root) => root.lineageIds),
    },
    phyloManifest: manifest,
    curatedLists: lists,
  };
}
