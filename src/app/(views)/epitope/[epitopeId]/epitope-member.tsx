import Link from "next/link";
import type { ReactNode } from "react";
import { ExternalLink, FlaskConical, LayoutDashboard } from "lucide-react";
import { EntityViewShell, ResourceChildCollection } from "@/components/views";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  epitopeAssayColumns,
  epitopeAssayRql,
  epitopeTabs,
  type EpitopeTab,
  type EpitopeViewRecord,
} from "@/lib/epitope-view";
import { cn } from "@/lib/utils";
import { taxonomyHref } from "@/lib/views/hrefs";
import { isTaxonId } from "@/lib/taxonomy-view";
import { EpitopeOverview } from "./epitope-overview";

const icons: Record<EpitopeTab, ReactNode> = {
  overview: <LayoutDashboard />,
  assays: <FlaskConical />,
};

interface EpitopeMemberProps {
  epitope: EpitopeViewRecord;
  activeTab: EpitopeTab;
}

export function EpitopeMember({ epitope, activeTab }: EpitopeMemberProps) {
  const content = activeTab === "assays"
    ? <ResourceChildCollection resource="epitope_assay" label="Assays" idField="assay_id" rql={epitopeAssayRql(epitope.epitope_id)} columns={epitopeAssayColumns} defaultSort="assay_id:asc" />
    : <EpitopeOverview epitope={epitope} />;
  const tabs = epitopeTabs.map((tab) => ({ ...tab, icon: icons[tab.key] }));
  return (
    <EntityViewShell
      viewLabel="Epitope View"
      title={epitope.epitope_sequence ?? `Epitope ${epitope.epitope_id}`}
      breadcrumbs={<div className="flex flex-wrap items-baseline gap-x-1 text-sm"><Link className="text-muted-foreground hover:text-foreground" href="/epitope">Epitopes</Link>{isTaxonId(String(epitope.taxon_id)) && <><span className="text-muted-foreground/50">»</span><Link className="text-muted-foreground hover:text-foreground" href={taxonomyHref(String(epitope.taxon_id))}>{epitope.organism ?? `Taxonomy ${String(epitope.taxon_id)}`}</Link></>}<span className="text-muted-foreground/50">»</span><h1 className="m-0 inline text-sm leading-none font-bold text-secondary">{epitope.epitope_id}</h1></div>}
      headerContent={epitope.protein_name ?? epitope.epitope_type ?? `Epitope ${epitope.epitope_id}`}
      metadataSummary={activeTab === "overview" ? <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 rounded-lg border bg-card px-4 py-3 text-sm"><span><strong>Type:</strong> {epitope.epitope_type ?? "Not available"}</span><span><strong>Organism:</strong> {epitope.organism ?? "Not available"}</span><span><strong>Assays:</strong> {epitope.total_assays ?? "Not available"}</span></div> : undefined}
      metadataActions={<a className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2")} href={`https://www.iedb.org/epitope/${encodeURIComponent(epitope.epitope_id)}`} target="_blank" rel="noopener noreferrer">View in IEDB <ExternalLink className="size-4" aria-hidden="true" /></a>}
      tabs={tabs}
      activeTab={activeTab}
      defaultTab="overview"
      layout={activeTab === "overview" ? "scroll" : "fill"}
    >
      {content}
    </EntityViewShell>
  );
}
