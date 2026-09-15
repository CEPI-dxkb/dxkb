import Link from "next/link";
import {
  OverviewCard,
  OverviewField,
  formatOverviewValue,
} from "@/components/views";
import type { GenomeViewRecord } from "@/lib/genome-view";
import { genomeFeatureRql } from "@/lib/views/child-resources";
import { featureListHref } from "@/lib/views/hrefs";

function FeatureCount({
  genomeId,
  label,
  type,
  value,
}: {
  genomeId: string;
  label: string;
  type?: string;
  value: unknown;
}) {
  return (
    <OverviewField label={label} value={value} className="mt-0.5">
      <Link
        className="text-primary underline"
        href={featureListHref({ rql: genomeFeatureRql(genomeId, type) })}
      >
        {formatOverviewValue(value)}
      </Link>
    </OverviewField>
  );
}

export function GenomeOverview({ genome }: { genome: GenomeViewRecord }) {
  const cds = genome.cds ?? genome.patric_cds;
  return (
    <div className="grid gap-4 pb-6 xl:grid-cols-2">
      <OverviewCard title="Assembly summary">
        <dl className="grid gap-4 sm:grid-cols-2">
          <OverviewField label="Genome length" value={genome.genome_length} />
          <OverviewField label="Contigs" value={genome.contigs} />
          <OverviewField label="Chromosomes" value={genome.chromosomes} />
          <OverviewField label="Plasmids" value={genome.plasmids} />
          <OverviewField label="GC content" value={genome.gc_content} />
          <OverviewField
            label="Assembly accession"
            value={genome.assembly_accession}
          />
          <OverviewField
            label="GenBank accessions"
            value={genome.genbank_accessions}
          />
        </dl>
      </OverviewCard>
      <OverviewCard title="Quality and status">
        <dl className="grid gap-4 sm:grid-cols-2">
          <OverviewField label="Genome status" value={genome.genome_status} />
          <OverviewField
            label="Genome quality"
            value={genome.genome_quality}
          />
          <OverviewField
            label="Quality flags"
            value={genome.genome_quality_flags}
          />
          <OverviewField
            label="CheckM completeness"
            value={genome.checkm_completeness}
          />
          <OverviewField
            label="CheckM contamination"
            value={genome.checkm_contamination}
          />
        </dl>
      </OverviewCard>
      <OverviewCard title="Annotation summary">
        <dl className="grid gap-4 sm:grid-cols-2">
          <FeatureCount
            genomeId={genome.genome_id}
            label="CDS"
            type="CDS"
            value={cds}
          />
          <FeatureCount
            genomeId={genome.genome_id}
            label="tRNA"
            type="tRNA"
            value={genome.trna}
          />
          <FeatureCount
            genomeId={genome.genome_id}
            label="rRNA"
            type="rRNA"
            value={genome.rrna}
          />
          <FeatureCount
            genomeId={genome.genome_id}
            label="Mature peptides"
            type="mat_peptide"
            value={genome.mat_peptide}
          />
        </dl>
      </OverviewCard>
      <OverviewCard title="Isolation and host">
        <dl className="grid gap-4 sm:grid-cols-2">
          <OverviewField label="Strain" value={genome.strain} />
          <OverviewField
            label="Collection date"
            value={genome.collection_date}
          />
          <OverviewField
            label="Collection year"
            value={genome.collection_year}
          />
          <OverviewField label="Country" value={genome.isolation_country} />
          <OverviewField
            label="Host"
            value={genome.host_common_name ?? genome.host_name}
          />
        </dl>
      </OverviewCard>
    </div>
  );
}
