import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache, Suspense } from "react";

import { upstreamOutageMessage } from "@/components/errors/record-load-failure";
import { TaxonBreadcrumb } from "@/components/organisms/taxon-breadcrumb";
import { TaxonGenomeCount } from "@/components/organisms/taxon-genome-count";
import { upstreamServices } from "@/lib/api/upstream-failure";
import { OrganismLandingShell } from "@/components/organisms/landing-shell/landing-shell";
import { buildTaxonViews } from "@/components/organisms/taxon-views";
import type {
  OrganismLandingConfig,
  OrganismLandingView,
} from "@/components/organisms/types";
import { TaxonomyNotFoundError, getSharedOrganismTaxonomy } from "@/lib/services/organisms/taxonomy";
import type { OrganismTaxonomy } from "@/lib/services/organisms/types";

import { firstSearchParam } from "@/lib/views/search-params";

import { getSharedPhyloManifest } from "@/lib/taxon-view/phylo-manifest";
import type { PhyloManifest } from "@/lib/taxon-view/tab-context";

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

// The shared cache does not hold an uncached failure and is bypassed in E2E,
// so `cache()` still gives generateMetadata and the page one promise per request.
const getOrganismTaxonomy = cache(getSharedOrganismTaxonomy);
const getPhyloManifest = cache(getSharedPhyloManifest);

function routeTaxonId(rawTaxonId: string): number | null {
  const taxonId = Number(rawTaxonId);
  return Number.isInteger(taxonId) && taxonId > 0 ? taxonId : null;
}

function taxonomyViews(
  taxonId: number,
  taxon: OrganismTaxonomy,
  phyloManifest: PhyloManifest | null,
): { config: OrganismLandingConfig; navItems: OrganismLandingView[] } {
  const config = buildTaxonomyConfig(taxonId, taxon);
  const navItems = buildTaxonViews({
    config,
    scope: { kind: "lineage", taxon },
    taxon,
    phyloManifest,
    surface: "taxonomy",
  });
  return { config, navItems };
}

function activeTabLabel(
  config: OrganismLandingConfig,
  navItems: readonly OrganismLandingView[],
  tab: string | undefined,
): string | undefined {
  const defaultView = config.defaultView ?? "overview";
  const enabled = navItems.filter((view) => view.enabled !== false);
  return (
    enabled.find((view) => view.key === tab) ??
    enabled.find((view) => view.key === defaultView) ??
    enabled.at(0)
  )?.label;
}

/**
 * Never throws: when the taxon cannot be shown the root layout's title stands
 * and the page reports why.
 */
export async function generateMetadata({
  params,
  searchParams,
}: TaxonomyPageProps): Promise<Metadata> {
  const [{ taxonId: rawTaxonId }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const taxonId = routeTaxonId(rawTaxonId);
  if (taxonId === null) return {};
  try {
    const [taxon, phyloManifest] = await Promise.all([
      getOrganismTaxonomy(taxonId),
      getPhyloManifest(),
    ]);
    const { config, navItems } = taxonomyViews(taxonId, taxon, phyloManifest);
    const label = activeTabLabel(config, navItems, firstSearchParam(query, "tab"));
    return label ? { title: `${taxon.taxonName}::Taxonomy ${label}` } : {};
  } catch {
    return {};
  }
}

export default async function TaxonomyPage({ params, searchParams }: TaxonomyPageProps) {
  const { taxonId: rawTaxonId } = await params;
  const taxonId = routeTaxonId(rawTaxonId);
  if (taxonId === null) {
    notFound();
  }

  // No legacy `view` param: the raw `tab` both picks the view and matches the
  // shell's tab content.
  const tab = firstSearchParam(await searchParams, "tab");

  // Started before the try so notFound/unavailable control flow is unchanged;
  // the manifest read never rejects, so a broken manifest only disables the
  // Phylogeny tab.
  const phyloManifestPromise = getPhyloManifest();

  let taxon: OrganismTaxonomy;
  try {
    taxon = await getOrganismTaxonomy(taxonId);
  } catch (err) {
    if (err instanceof TaxonomyNotFoundError) {
      notFound();
    }
    // Only an outage is rendered; anything else is thrown to the boundary
    // because its message can name server configuration.
    const unavailable = upstreamOutageMessage(err, upstreamServices.dataApi, {
      fallback: taxonomyUnavailableFallback,
    });
    if (unavailable === null) throw err;
    return <TaxonUnavailable taxonId={taxonId} tab={tab} message={unavailable} />;
  }
  const phyloManifest = await phyloManifestPromise;

  const { config, navItems } = taxonomyViews(taxonId, taxon, phyloManifest);

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
