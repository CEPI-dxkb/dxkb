import Link from "next/link";
import { Suspense, use, type ReactNode } from "react";
import { CircularViewerPanel } from "@/components/circular-viewer";
import { GenomeBrowserPanel } from "@/components/genome-browser";
import { viewIcons } from "@/components/views/view-icons";
import {
  EntityViewShell,
  ExperimentResourceCollection,
  ProteinStructureResourceCollection,
  ResourceChildCollection,
} from "@/components/views";
import { genomeExperimentRql } from "@/lib/experiment-view";
import {
  buildGenomeTabs,
  genomeInteractionsRql,
  genomeSequenceRql,
  type GenomeTab,
  type GenomeViewRecord,
} from "@/lib/genome-view";
import { eq } from "@/lib/data-api";
import { featureListDefaultFilters } from "@/lib/feature-view";
import type { LineageCrumb } from "@/lib/taxonomy-view";
import { taxonomyHref } from "@/lib/views/hrefs";
import {
  genomeDomainsRql,
  genomeFeatureRql,
  genomeProteinRql,
  interactionColumns,
} from "@/lib/views/child-resources";
import { genomeChildCollections } from "../child-tabs";
import { GenomeOverview } from "./genome-overview";

interface CrumbTrailProps {
  genome: GenomeViewRecord;
  lineage: readonly LineageCrumb[];
}

function CrumbTrail({ genome, lineage }: CrumbTrailProps) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-1 text-sm">
      {lineage.map(({ taxonId, name }, index) => (
        <span key={`${String(index)}-${taxonId}`} className="contents">
          <Link
            className="text-muted-foreground transition-colors hover:text-foreground"
            href={taxonomyHref(taxonId)}
          >
            {name}
          </Link>
          <span className="text-muted-foreground/50 select-none">»</span>
        </span>
      ))}
      <h1 className="m-0 inline text-sm leading-none font-bold text-secondary">
        {genome.genome_name ?? genome.genome_id}
      </h1>
    </div>
  );
}

function LineageCrumbTrail({
  genome,
  lineage,
}: {
  genome: GenomeViewRecord;
  lineage: Promise<readonly LineageCrumb[]>;
}) {
  return <CrumbTrail genome={genome} lineage={use(lineage)} />;
}

/**
 * The lineage is a second lookup, so it streams in; the breadcrumb holds the
 * genome name alone until it lands.
 */
function breadcrumbs(
  genome: GenomeViewRecord,
  lineage: Promise<readonly LineageCrumb[]>,
) {
  return (
    <Suspense fallback={<CrumbTrail genome={genome} lineage={[]} />}>
      <LineageCrumbTrail genome={genome} lineage={lineage} />
    </Suspense>
  );
}

const genomeTabIcons: Record<GenomeTab, ReactNode> = {
  overview: viewIcons.overview,
  sequences: viewIcons.sequences,
  interactions: viewIcons.interactions,
  "genome-browser": viewIcons.genomeBrowser,
  "circular-viewer": viewIcons.circularViewer,
  features: viewIcons.features,
  proteins: viewIcons.proteins,
  domains: viewIcons.domainsAndMotifs,
  structures: viewIcons.proteinStructures,
  experiments: viewIcons.experiments,
};

export function GenomeMember({
  genome,
  lineage,
  activeTab,
}: {
  genome: GenomeViewRecord;
  lineage: Promise<readonly LineageCrumb[]>;
  activeTab: GenomeTab;
}) {
  let content = <GenomeOverview genome={genome} />;
  if (activeTab === "sequences") {
    content = (
      <ResourceChildCollection
        {...genomeChildCollections.sequences}
        rql={genomeSequenceRql(genome.genome_id)}
      />
    );
  } else if (activeTab === "genome-browser") {
    content = <GenomeBrowserPanel genomeId={genome.genome_id} />;
  } else if (activeTab === "circular-viewer") {
    content = <CircularViewerPanel genomeId={genome.genome_id} />;
  } else if (activeTab === "interactions") {
    content = (
      <ResourceChildCollection
        urlKey="interactions"
        resource="ppi"
        label="Interactions"
        idField="id"
        rql={genomeInteractionsRql(genome.genome_id)}
        columns={interactionColumns}
        defaultSort="id:asc"
      />
    );
  } else if (activeTab === "features") {
    content = (
      <ResourceChildCollection
        {...genomeChildCollections.features}
        rql={genomeFeatureRql(genome.genome_id)}
        defaultFilters={featureListDefaultFilters}
      />
    );
  } else if (activeTab === "proteins") {
    // `genomeProteinRql` pins PATRIC itself, so this tab has no default.
    content = (
      <ResourceChildCollection
        {...genomeChildCollections.proteins}
        rql={genomeProteinRql(genome.genome_id)}
      />
    );
  } else if (activeTab === "domains") {
    content = (
      <ResourceChildCollection
        {...genomeChildCollections.domains}
        rql={genomeDomainsRql(genome.genome_id)}
      />
    );
  } else if (activeTab === "structures") {
    content = (
      <ProteinStructureResourceCollection
        baseRql={eq("protein_structure", "genome_id", genome.genome_id)}
        enableFacets={false}
        keywordMode="loaded"
      />
    );
  } else if (activeTab === "experiments") {
    content = (
      <ExperimentResourceCollection
        baseRql={genomeExperimentRql(genome.genome_id)}
        enableFacets={false}
        keywordMode="loaded"
      />
    );
  }
  const tabs = buildGenomeTabs(genome).map((tab) => ({
    ...tab,
    icon: genomeTabIcons[tab.key],
  }));

  return (
    <EntityViewShell
      viewLabel="Genome View"
      title={genome.genome_name ?? genome.genome_id}
      breadcrumbs={breadcrumbs(genome, lineage)}
      headerContent={`Genome ${genome.genome_id}`}
      metadataSummary={
        activeTab === "overview" ? (
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 rounded-lg border bg-card px-4 py-3 text-sm">
            <span>
              <strong>Length:</strong> {genome.genome_length ?? "Not available"}
            </span>
            <span>
              <strong>Contigs:</strong> {genome.contigs ?? "Not available"}
            </span>
            <span>
              <strong>Status:</strong> {genome.genome_status ?? "Not available"}
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
