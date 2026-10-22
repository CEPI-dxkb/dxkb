import { notFound } from "next/navigation";
import { Suspense } from "react";

import { upstreamOutageMessage } from "@/components/errors/record-load-failure";
import { TaxonBreadcrumb } from "@/components/organisms/taxon-breadcrumb";
import { TaxonGenomeCount } from "@/components/organisms/taxon-genome-count";
import { upstreamServices } from "@/lib/api/upstream-failure";
import { OrganismLandingShell } from "@/components/organisms/landing-shell/landing-shell";
import { buildTaxonViews } from "@/components/organisms/taxon-views";
import { TaxonomyNotFoundError, fetchOrganismTaxonomy } from "@/lib/services/organisms/taxonomy";
import type { OrganismTaxonomy } from "@/lib/services/organisms/types";

import { firstSearchParam } from "@/lib/views/search-params";

import { fetchPhyloManifest } from "@/lib/taxon-view/phylo-manifest";

import { buildTaxonomyConfig } from "./_config";
import { TaxonUnavailable } from "./taxon-unavailable";

export const dynamic = "force-dynamic";

const taxonomyUnavailableFallback =
  "The taxonomy service did not respond. This is usually temporary; please try again.";

interface TaxonomyPageProps {
  params: Promise<{ taxonId: string }>;
  searchParams?: Promise<{
    tab?: string | string[];
  }>;
}

export default async function TaxonomyPage({ params, searchParams }: TaxonomyPageProps) {
  const { taxonId: rawTaxonId } = await params;
  const taxonId = Number(rawTaxonId);
  if (!Number.isInteger(taxonId) || taxonId <= 0) {
    notFound();
  }

  // No legacy `view` param here: the raw `tab` both picks the view and is what
  // the shell's tab content matches against the URL.
  const tab = firstSearchParam(await searchParams, "tab");

  // Kick off the manifest fetch in parallel with the taxonomy fetch — they are
  // independent. Started before the try so taxonomy's notFound/unavailable control
  // flow is unchanged; fetchPhyloManifest is fail-open (never rejects), so a
  // missing/broken manifest can't block the page — it only disables the viral
  // Phylogeny tab.
  const phyloManifestPromise = fetchPhyloManifest();

  let taxon: OrganismTaxonomy;
  try {
    taxon = await fetchOrganismTaxonomy(taxonId);
  } catch (err) {
    if (err instanceof TaxonomyNotFoundError) {
      notFound();
    }
    // Only an outage is rendered: anything else (a missing env var, a
    // malformed payload, a bug) is thrown to the boundary and the server log,
    // because its message can name server configuration.
    const unavailable = upstreamOutageMessage(err, upstreamServices.dataApi, {
      fallback: taxonomyUnavailableFallback,
    });
    if (unavailable === null) throw err;
    // Rendered, not thrown: production replaces a thrown server error's
    // message with a digest, and the boundary would drop the shell with it.
    console.error(`taxonomy/${String(taxonId)}: taxonomy lookup failed`, err);
    return <TaxonUnavailable taxonId={taxonId} tab={tab} message={unavailable} />;
  }
  const phyloManifest = await phyloManifestPromise;

  const config = buildTaxonomyConfig(taxonId, taxon);
  const navItems = buildTaxonViews({
    config,
    scope: { kind: "lineage", taxon },
    taxon,
    phyloManifest,
    surface: "taxonomy",
  });

  return (
    <OrganismLandingShell
      config={config}
      views={navItems}
      activeViewKey={tab}
      tabParam={tab ?? null}
      headerContent={
        <TaxonBreadcrumb
          taxon={taxon}
          displayName={config.displayName}
          genomeCount={
            <Suspense fallback={null}>
              <TaxonGenomeCount taxonId={taxon.taxonId} />
            </Suspense>
          }
        />
      }
    />
  );
}
