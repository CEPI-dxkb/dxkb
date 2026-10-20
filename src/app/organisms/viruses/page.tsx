import { redirect } from "next/navigation";

import { OrganismLandingShell } from "@/components/organisms/landing-shell/landing-shell";
import { buildTaxonViews } from "@/components/organisms/taxon-views";
import { fetchLandingRootTaxonomy } from "@/lib/services/organisms/taxonomy";
import { resolveLandingTab } from "@/lib/taxon-view/landing-request";

import { virusesLandingConfig } from "./_config";
import { OverviewView } from "./views/overview";

export const dynamic = "force-dynamic";

interface VirusesPageProps {
  searchParams?: Promise<{
    tab?: string | string[];
    view?: string | string[];
  }>;
}

export default async function VirusesPage({ searchParams }: VirusesPageProps) {
  const [resolvedParams, taxon] = await Promise.all([
    searchParams,
    // Falls back to the static root during an outage, so the shell, rail and
    // static sections still render and only the data sections fail.
    fetchLandingRootTaxonomy(virusesLandingConfig.taxonId),
  ]);
  const views = buildTaxonViews({
    config: virusesLandingConfig,
    scope: { kind: "lineage", taxon },
    taxon,
    OverviewComponent: OverviewView,
    surface: "landing",
  });
  const request = resolveLandingTab(resolvedParams, views);
  if (request.redirectToOverview) redirect("/organisms/viruses");

  return (
    <OrganismLandingShell
      config={virusesLandingConfig}
      views={views}
      activeViewKey={request.activeViewKey}
      tabParam={request.tabParam}
    />
  );
}
