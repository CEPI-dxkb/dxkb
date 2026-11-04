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
import { TaxonomyNotFoundError, fetchOrganismTaxonomy } from "@/lib/services/organisms/taxonomy";
import type { OrganismTaxonomy } from "@/lib/services/organisms/types";

import { firstSearchParam } from "@/lib/views/search-params";

import { fetchPhyloManifest } from "@/lib/taxon-view/phylo-manifest";
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

// generateMetadata and the page share one taxonomy lookup and one manifest
// fetch per request, as the genome page shares `getGenome`. Next would not
// dedupe them on its own: both fetches carry a timeout signal, which opts a
// fetch out of request memoization.
const getOrganismTaxonomy = cache((taxonId: number) =>
  fetchOrganismTaxonomy(taxonId),
);
const getPhyloManifest = cache(fetchPhyloManifest);

/** The route's taxon id, or null when it is not a positive integer. */
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

/**
 * The rail label of the view the shell opens for `tab`, picked as
 * `OrganismLandingShell` picks it: the requested view when it is enabled,
 * otherwise the default view (Overview), otherwise the first enabled one.
 */
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
 * BV-BRC's browser title for a Taxon View tab (`Taxonomy.js`, `onSetState`),
 * "Escherichia coli::Taxonomy Genomes", so a root or domain, whose trail is
 * empty, still names its taxon in the tab. It never throws: when the taxon
 * cannot be shown the root layout's title stands, and the page, awaiting the
 * same lookup, reports why (its notFound, outage page or error boundary).
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
    // Reported by the page, which awaits the same lookup.
    return {};
  }
}

export default async function TaxonomyPage({ params, searchParams }: TaxonomyPageProps) {
  const { taxonId: rawTaxonId } = await params;
  const taxonId = routeTaxonId(rawTaxonId);
  if (taxonId === null) {
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
  const phyloManifestPromise = getPhyloManifest();

  let taxon: OrganismTaxonomy;
  try {
    taxon = await getOrganismTaxonomy(taxonId);
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
