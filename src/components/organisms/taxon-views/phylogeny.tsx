import "@/styles/archaeopteryx-theme.css";

import type { OrganismTaxonomy } from "@/lib/services/organisms/types";

import {
  LazyBacterialPhylogenyPanel,
  LazyViralPhylogenyPanel,
} from "./lazy-tab-roots";

export function makePhylogenyView({
  taxon,
}: {
  taxon: OrganismTaxonomy | null;
}) {
  function PhylogenyView() {
    if (!taxon) return null;
    // Border and radius live here so every phylogeny state is framed identically;
    // overflow-hidden clips children to the rounded corner.
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-tl-lg border">
        {taxon.lineageNames.includes("Bacteria") ? (
          <LazyBacterialPhylogenyPanel
            key={taxon.taxonId}
            taxonId={taxon.taxonId}
            taxonName={taxon.taxonName}
          />
        ) : (
          <LazyViralPhylogenyPanel
            key={taxon.taxonId}
            taxonId={taxon.taxonId}
            taxonName={taxon.taxonName}
          />
        )}
      </div>
    );
  }
  return PhylogenyView;
}
