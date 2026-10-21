import Link from "next/link";
import { Suspense, use, type ReactNode } from "react";
import { viewIcons } from "@/components/views/view-icons";
import {
  EntityViewShell,
  FastaDownloadButtons,
  ProteinStructureResourceCollection,
  ResourceChildCollection,
} from "@/components/views";
import {
  buildFeatureTabs,
  featureDisplayName,
  featureFastaTypes,
  featureHeaderParts,
  type FeatureTab,
  type FeatureViewRecord,
  type LineageCrumb,
} from "@/lib/feature-view";
import { featureProteinStructureRql } from "@/lib/protein-structure-view";
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
  transcriptomics: viewIcons.transcriptomics,
  interactions: viewIcons.interactions,
  domains: viewIcons.domainsAndMotifs,
  structures: viewIcons.proteinStructures,
};

interface CrumbTrailProps {
  feature: FeatureViewRecord;
  lineage: readonly LineageCrumb[];
}

/** The taxon lineage and the genome as one breadcrumb, root first. */
function CrumbTrail({ feature, lineage }: CrumbTrailProps) {
  const crumbs = lineage.map(({ taxonId, name }) => ({
    key: `taxon-${taxonId}`,
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
 * BV-BRC's Feature View header: the taxon lineage and the genome as one
 * breadcrumb, then the feature's identifiers in bold, separated by pipes.
 * The lineage is a second lookup, so it streams in: until it lands the
 * breadcrumb holds the genome alone.
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
  /**
   * The taxa leading the breadcrumb, root first (see `featureLineageCrumbs`).
   * A promise, so a slow taxonomy lookup holds the breadcrumb, not the page.
   */
  lineage: Promise<readonly LineageCrumb[]>;
  activeTab: FeatureTab;
}

export function FeatureMember({
  feature,
  lineage,
  activeTab,
}: FeatureMemberProps) {
  const content =
    activeTab === "interactions" ? (
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
  const tabs = buildFeatureTabs(feature).map((tab) => ({
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
