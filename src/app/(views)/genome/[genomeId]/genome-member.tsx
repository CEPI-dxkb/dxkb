import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  Blocks,
  Dna,
  FlaskConical,
  LayoutDashboard,
  Network,
  ScanLine,
  Shapes,
  Waypoints,
} from "lucide-react";
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
import {
  featureColumns,
  genomeDomainsRql,
  genomeFeatureRql,
  genomeProteinRql,
  genomeSequenceColumns,
  interactionColumns,
} from "@/lib/views/child-resources";
import { GenomeOverview } from "./genome-overview";

function lineage(genome: GenomeViewRecord) {
  const names = Array.isArray(genome.taxon_lineage_names)
    ? genome.taxon_lineage_names
    : genome.taxon_lineage_names?.split(",").map((name) => name.trim());
  const ids = Array.isArray(genome.taxon_lineage_ids)
    ? genome.taxon_lineage_ids
    : genome.taxon_lineage_ids == null
      ? []
      : String(genome.taxon_lineage_ids).split(",");
  if (!names?.length) return null;
  return (
    <div className="flex flex-wrap items-baseline gap-x-1 text-sm">
      <Link
        className="text-muted-foreground transition-colors hover:text-foreground"
        href="/genome"
      >
        Genomes
      </Link>
      <span className="text-muted-foreground/50 select-none">»</span>
      {names.map((name, index) => (
        <span key={ids[index] ?? name} className="contents">
          {ids[index] ? (
            <Link
              className="text-muted-foreground transition-colors hover:text-foreground"
              href={`/taxonomy/${encodeURIComponent(String(ids[index]))}`}
            >
              {name}
            </Link>
          ) : (
            <span className="text-muted-foreground">{name}</span>
          )}
          <span className="text-muted-foreground/50 select-none">»</span>
        </span>
      ))}
      <h1 className="m-0 inline text-sm leading-none font-bold text-secondary">
        {genome.genome_name ?? genome.genome_id}
      </h1>
    </div>
  );
}

const genomeTabIcons: Record<GenomeTab, ReactNode> = {
  overview: <LayoutDashboard />,
  sequences: <Dna />,
  interactions: <Network />,
  "genome-browser": <ScanLine />,
  features: <Blocks />,
  proteins: <Activity />,
  domains: <Waypoints />,
  structures: <Shapes />,
  experiments: <FlaskConical />,
};

export function GenomeMember({
  genome,
  activeTab,
}: {
  genome: GenomeViewRecord;
  activeTab: GenomeTab;
}) {
  let content = <GenomeOverview genome={genome} />;
  if (activeTab === "sequences") {
    content = (
      <ResourceChildCollection
        resource="genome_sequence"
        label="Sequences"
        idField="sequence_id"
        rql={genomeSequenceRql(genome.genome_id)}
        columns={genomeSequenceColumns}
        defaultSort="sequence_id:asc"
      />
    );
  } else if (activeTab === "interactions") {
    content = (
      <ResourceChildCollection
        resource="ppi"
        label="Interactions"
        idField="id"
        rql={genomeInteractionsRql(genome.genome_id)}
        columns={interactionColumns}
        defaultSort="id:asc"
      />
    );
  } else if (activeTab === "features" || activeTab === "proteins") {
    content = (
      <ResourceChildCollection
        resource="genome_feature"
        label={activeTab === "proteins" ? "Proteins" : "Features"}
        idField="feature_id"
        rql={
          activeTab === "proteins"
            ? genomeProteinRql(genome.genome_id)
            : genomeFeatureRql(genome.genome_id)
        }
        columns={featureColumns}
        defaultSort="patric_id:asc"
      />
    );
  } else if (activeTab === "domains") {
    content = (
      <ResourceChildCollection
        resource="protein_feature"
        label="Domains and Motifs"
        idField="id"
        rql={genomeDomainsRql(genome.genome_id)}
        defaultSort="unsorted"
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
      breadcrumbs={lineage(genome)}
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
      layout={activeTab === "overview" ? "scroll" : "fill"}
    >
      {content}
    </EntityViewShell>
  );
}
