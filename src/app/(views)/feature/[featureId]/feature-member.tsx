import Link from "next/link";
import type { ReactNode } from "react";
import {
  Blocks,
  ChartNoAxesCombined,
  GitCompareArrows,
  LayoutDashboard,
  Network,
  ScanLine,
  Shapes,
} from "lucide-react";
import {
  EntityViewShell,
  ProteinStructureResourceCollection,
  ResourceChildCollection,
} from "@/components/views";
import {
  buildFeatureTabs,
  type FeatureTab,
  type FeatureViewRecord,
} from "@/lib/feature-view";
import { featureProteinStructureRql } from "@/lib/protein-structure-view";
import {
  featureDomainsRql,
  featureInteractionsRql,
  interactionColumns,
} from "@/lib/views/child-resources";
import { genomeHref, taxonomyHref } from "@/lib/views/hrefs";
import { isTaxonId } from "@/lib/taxonomy-view";
import { FeatureOverview } from "./feature-overview";

const featureTabIcons: Record<FeatureTab, ReactNode> = {
  overview: <LayoutDashboard />,
  "genome-browser": <ScanLine />,
  "compare-region": <GitCompareArrows />,
  transcriptomics: <ChartNoAxesCombined />,
  interactions: <Network />,
  domains: <Blocks />,
  structures: <Shapes />,
};

function breadcrumbs(feature: FeatureViewRecord) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-1 text-sm">
      <Link
        className="text-muted-foreground hover:text-foreground"
        href="/feature"
      >
        Features
      </Link>
      {feature.genome_id && (
        <>
          <span className="text-muted-foreground/50">»</span>
          <Link
            className="text-muted-foreground hover:text-foreground"
            href={genomeHref(feature.genome_id)}
          >
            {feature.genome_name ?? feature.genome_id}
          </Link>
        </>
      )}
      {isTaxonId(String(feature.taxon_id)) && (
        <>
          <span className="text-muted-foreground/50">»</span>
          <Link
            className="text-muted-foreground hover:text-foreground"
            href={taxonomyHref(String(feature.taxon_id))}
          >
            Taxonomy {feature.taxon_id}
          </Link>
        </>
      )}
      <span className="text-muted-foreground/50">»</span>
      <h1 className="m-0 inline text-sm leading-none font-bold text-secondary">
        {feature.patric_id ?? feature.feature_id}
      </h1>
    </div>
  );
}

interface FeatureMemberProps {
  feature: FeatureViewRecord;
  activeTab: FeatureTab;
}

export function FeatureMember({ feature, activeTab }: FeatureMemberProps) {
  const content =
    activeTab === "interactions" ? (
      <ResourceChildCollection
        resource="ppi"
        label="Interactions"
        idField="id"
        rql={featureInteractionsRql(feature.feature_id)}
        columns={interactionColumns}
        defaultSort="id:asc"
      />
    ) : activeTab === "domains" ? (
      <ResourceChildCollection
        resource="protein_feature"
        label="Domains and Motifs"
        idField="id"
        rql={featureDomainsRql(feature.feature_id)}
        defaultSort="unsorted"
      />
    ) : activeTab === "structures" ? (
      <ProteinStructureResourceCollection
        baseRql={featureProteinStructureRql(feature)}
        enableFacets={false}
        keywordMode="loaded"
      />
    ) : (
      <FeatureOverview feature={feature} />
    );
  const tabs = buildFeatureTabs(feature).map((tab) => ({
    ...tab,
    icon: featureTabIcons[tab.key],
  }));
  return (
    <EntityViewShell
      viewLabel="Feature View"
      title={feature.patric_id ?? feature.feature_id}
      breadcrumbs={breadcrumbs(feature)}
      headerContent={
        feature.product ??
        `${feature.feature_type ?? "Feature"} ${feature.feature_id}`
      }
      metadataSummary={
        activeTab === "overview" ? (
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 rounded-lg border bg-card px-4 py-3 text-sm">
            <span>
              <strong>Type:</strong> {feature.feature_type ?? "Not available"}
            </span>
            <span>
              <strong>Annotation:</strong>{" "}
              {feature.annotation ?? "Not available"}
            </span>
            <span>
              <strong>Location:</strong> {feature.location ?? "Not available"}
            </span>
          </div>
        ) : undefined
      }
      tabs={tabs}
      activeTab={activeTab}
      defaultTab="overview"
      layout={activeTab === "overview" ? "scroll" : "fill"}
    >
      {content}
    </EntityViewShell>
  );
}
