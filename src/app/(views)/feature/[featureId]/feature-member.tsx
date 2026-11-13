import Link from "next/link";
import { Suspense, use, type ReactNode } from "react";
import { CompareRegionPanel } from "@/components/compare-region";
import { GenomeBrowserPanel } from "@/components/genome-browser";
import { viewIcons } from "@/components/views/view-icons";
import {
  EntityViewShell,
  FastaDownloadButtons,
  ProteinStructureResourceCollection,
  ResourceChildCollection,
} from "@/components/views";
import {
  buildFeatureTabs,
  type CompareRegionAvailability,
  featureDisplayName,
  featureFastaTypes,
  featureGenomeBrowserTarget,
  featureHeaderParts,
  type FeatureTab,
  type FeatureViewRecord,
} from "@/lib/feature-view";
import { featureProteinStructureRql } from "@/lib/protein-structure-view";
import type { LineageCrumb } from "@/lib/taxonomy-view";
import {
  featureDomainsRql,
  featureInteractionsRql,
  interactionColumns,
} from "@/lib/views/child-resources";
import { genomeHref, taxonomyHref } from "@/lib/views/hrefs";
import { FeatureOverview } from "./feature-overview";

const featureTabIcons: Record<FeatureTab, ReactNode> = {
  overview: viewIcons.overview,
  "genome-browser": viewIcons.genomeBrowser,
  "compare-region": viewIcons.compareRegion,
  interactions: viewIcons.interactions,
  domains: viewIcons.domainsAndMotifs,
  structures: viewIcons.proteinStructures,
};

interface CrumbTrailProps {
  feature: FeatureViewRecord;
  lineage: readonly LineageCrumb[];
}

function CrumbTrail({ feature, lineage }: CrumbTrailProps) {
  const crumbs = lineage.map(({ taxonId, name }, index) => ({
    key: `taxon-${String(index)}-${taxonId}`,
    href: taxonomyHref(taxonId),
    label: name,
  }));
  if (feature.genome_id) {
    crumbs.push({
      key: "genome",
      href: genomeHref(feature.genome_id),
      label: feature.genome_name ?? feature.genome_id,
    });
  }
  if (crumbs.length === 0) return null;
  return (
    <div className="flex flex-wrap items-baseline gap-x-1 text-sm">
      {crumbs.map(({ key, href, label }, index) => (
        <span key={key} className="contents">
          {index > 0 && (
            <span className="text-muted-foreground/50 select-none">»</span>
          )}
          <Link
            className="text-muted-foreground transition-colors hover:text-foreground"
            href={href}
          >
            {label}
          </Link>
        </span>
      ))}
    </div>
  );
}

function LineageCrumbTrail({
  feature,
  lineage,
}: {
  feature: FeatureViewRecord;
  lineage: Promise<readonly LineageCrumb[]>;
}) {
  return <CrumbTrail feature={feature} lineage={use(lineage)} />;
}

/**
 * Feature View header; the lineage streams in, so the breadcrumb holds the
 * genome alone until it lands.
 */
function breadcrumbs(
  feature: FeatureViewRecord,
  lineage: Promise<readonly LineageCrumb[]>,
) {
  const { name, details } = featureHeaderParts(feature);
  return (
    <>
      <Suspense fallback={<CrumbTrail feature={feature} lineage={[]} />}>
        <LineageCrumbTrail feature={feature} lineage={lineage} />
      </Suspense>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-sm font-bold">
        <h1 className="m-0 inline text-sm leading-none font-bold text-secondary">
          {name}
        </h1>
        {details.map((detail, index) => (
          <span key={`${String(index)}:${detail}`} className="contents">
            <span className="font-normal text-muted-foreground/50 select-none">
              |
            </span>
            <span>{detail}</span>
          </span>
        ))}
      </div>
    </>
  );
}

interface FeatureMemberProps {
  feature: FeatureViewRecord;
  /** The Compare Region tab's gene (the feature's own BRC ID or its PATRIC counterpart's), or why there is none. */
  compare: CompareRegionAvailability;
  /** A promise, so a slow taxonomy lookup holds the breadcrumb, not the page. */
  lineage: Promise<readonly LineageCrumb[]>;
  activeTab: FeatureTab;
}

export function FeatureMember({
  feature,
  compare,
  lineage,
  activeTab,
}: FeatureMemberProps) {
  const browserTarget = featureGenomeBrowserTarget(feature);
  const comparePeg = compare.peg;
  const content =
    activeTab === "genome-browser" && browserTarget ? (
      <GenomeBrowserPanel
        genomeId={browserTarget.genomeId}
        focus={browserTarget.focus}
      />
    ) : activeTab === "compare-region" && comparePeg ? (
      <CompareRegionPanel patricId={comparePeg} />
    ) : activeTab === "interactions" ? (
      <ResourceChildCollection
        urlKey="interactions"
        resource="ppi"
        label="Interactions"
        idField="id"
        rql={featureInteractionsRql(feature.feature_id)}
        columns={interactionColumns}
        defaultSort="id:asc"
      />
    ) : activeTab === "domains" ? (
      <ResourceChildCollection
        urlKey="domains"
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
  const tabs = buildFeatureTabs(feature, compare).map((tab) => ({
    ...tab,
    icon: featureTabIcons[tab.key],
  }));
  const displayName = featureDisplayName(feature);
  const fastaTypes = featureFastaTypes(feature);
  return (
    <EntityViewShell
      viewLabel="Feature View"
      title={displayName}
      breadcrumbs={breadcrumbs(feature, lineage)}
      metadataActions={
        fastaTypes.length > 0 ? (
          <FastaDownloadButtons
            resource="genome_feature"
            ids={[feature.feature_id]}
            types={fastaTypes}
            fileNameBase={displayName}
          />
        ) : undefined
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
      serverTab
      layout={activeTab === "overview" ? "scroll" : "fill"}
    >
      {content}
    </EntityViewShell>
  );
}
