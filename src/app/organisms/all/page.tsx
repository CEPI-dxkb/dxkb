import { redirect } from "next/navigation";

import { OrganismLandingShell } from "@/components/organisms/landing-shell/landing-shell";
import { buildTaxonViews } from "@/components/organisms/taxon-views";
import { fetchLandingRootTaxonomy } from "@/lib/services/organisms/taxonomy";
import { resolveLandingTab } from "@/lib/taxon-view/landing-request";

import { allOrganismsLandingConfig } from "./_config";
import { OverviewView } from "./views/overview";

export const dynamic = "force-dynamic";

const allOrganismRootIds = [131567, 10239] as const;

interface AllOrganismsPageProps {
  searchParams?: Promise<{
    tab?: string | string[];
    view?: string | string[];
  }>;
}

export default async function AllOrganismsPage({ searchParams }: AllOrganismsPageProps) {
  const [resolvedParams, roots] = await Promise.all([
    searchParams,
    // Each root falls back to its static record during an outage, so one
    // failing root no longer takes the whole page down.
    Promise.all(allOrganismRootIds.map((taxonId) => fetchLandingRootTaxonomy(taxonId))),
  ]);
  const scope = { kind: "composite" as const, displayName: "All Organisms", roots };
  const views = buildTaxonViews({
    config: allOrganismsLandingConfig,
    scope,
    taxon: roots[0],
    OverviewComponent: OverviewView,
    surface: "landing",
  });
  const request = resolveLandingTab(resolvedParams, views);
  if (request.redirectToOverview) redirect("/organisms/all");

  return (
    <OrganismLandingShell
      config={allOrganismsLandingConfig}
      views={views}
      activeViewKey={request.activeViewKey}
      tabParam={request.tabParam}
    />
  );
}
