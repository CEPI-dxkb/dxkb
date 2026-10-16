import { redirect } from "next/navigation";

import { OrganismLandingShell } from "@/components/organisms/landing-shell/landing-shell";
import { buildTaxonViews } from "@/components/organisms/taxon-views";
import { fetchOrganismTaxonomy } from "@/lib/services/organisms/taxonomy";
import { resolveLandingTab } from "@/lib/taxon-view/landing-request";

import { bacteriaLandingConfig } from "./_config";
import { OverviewView } from "./views/overview";

export const dynamic = "force-dynamic";

interface BacteriaPageProps {
  searchParams?: Promise<{
    tab?: string | string[];
    view?: string | string[];
  }>;
}

export default async function BacteriaPage({ searchParams }: BacteriaPageProps) {
  const [resolvedParams, taxon] = await Promise.all([
    searchParams,
    fetchOrganismTaxonomy(bacteriaLandingConfig.taxonId),
  ]);
  const views = buildTaxonViews({
    config: bacteriaLandingConfig,
    scope: { kind: "lineage", taxon },
    taxon,
    OverviewComponent: OverviewView,
    surface: "landing",
  });
  const request = resolveLandingTab(resolvedParams, views);
  if (request.redirectToOverview) redirect("/organisms/bacteria");

  return (
    <OrganismLandingShell
      config={bacteriaLandingConfig}
      views={views}
      activeViewKey={request.activeViewKey}
      tabParam={request.tabParam}
    />
  );
}
