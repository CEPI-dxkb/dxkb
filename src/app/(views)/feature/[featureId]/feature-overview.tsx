import Link from "next/link";
import {
  OverviewCard,
  OverviewField,
  formatOverviewValue,
} from "@/components/views";
import type { FeatureViewRecord } from "@/lib/feature-view";
import { genomeHref, taxonomyHref } from "@/lib/views/hrefs";
import { isTaxonId } from "@/lib/taxonomy-view";

interface LinkFieldProps {
  label: string;
  value: unknown;
  href?: string;
}

interface FeatureOverviewProps {
  feature: FeatureViewRecord;
}

function LinkField({ label, value, href }: LinkFieldProps) {
  return (
    <OverviewField label={label} value={value}>
      {href ? (
        <Link className="text-primary underline" href={href}>
          {formatOverviewValue(value)}
        </Link>
      ) : (
        formatOverviewValue(value)
      )}
    </OverviewField>
  );
}

export function FeatureOverview({ feature }: FeatureOverviewProps) {
  return (
    <div className="grid gap-4 pb-6 xl:grid-cols-2">
      <OverviewCard title="Genome and source">
        <dl className="grid gap-4 sm:grid-cols-2">
          <LinkField
            label="Genome"
            value={feature.genome_name ?? feature.genome_id}
            href={feature.genome_id ? genomeHref(feature.genome_id) : undefined}
          />
          <LinkField
            label="Taxon ID"
            value={feature.taxon_id}
            href={
              isTaxonId(String(feature.taxon_id))
                ? taxonomyHref(String(feature.taxon_id))
                : undefined
            }
          />
          <OverviewField label="Annotation" value={feature.annotation} />
          <OverviewField label="Feature type" value={feature.feature_type} />
        </dl>
      </OverviewCard>
      <OverviewCard title="Identifiers">
        <dl className="grid gap-4 sm:grid-cols-2">
          <OverviewField label="Feature ID" value={feature.feature_id} />
          <OverviewField label="BRC ID" value={feature.patric_id} />
          <OverviewField
            label="RefSeq locus tag"
            value={feature.refseq_locus_tag}
          />
          <OverviewField label="Protein ID" value={feature.protein_id} />
          <OverviewField label="Gene ID" value={feature.gene_id} />
          <OverviewField
            label="UniProtKB accession"
            value={feature.uniprotkb_accession}
          />
          <OverviewField label="PDB accession" value={feature.pdb_accession} />
        </dl>
      </OverviewCard>
      <OverviewCard title="Location and sequence">
        <dl className="grid gap-4 sm:grid-cols-2">
          <OverviewField label="Sequence ID" value={feature.sequence_id} />
          <OverviewField label="Accession" value={feature.accession} />
          <OverviewField label="Start" value={feature.start} />
          <OverviewField label="End" value={feature.end} />
          <OverviewField label="Strand" value={feature.strand} />
          <OverviewField label="Location" value={feature.location} />
          <OverviewField label="Codon start" value={feature.codon_start} />
          <OverviewField
            label="Nucleotide length"
            value={feature.na_length}
          />
          <OverviewField label="Amino acid length" value={feature.aa_length} />
          <OverviewField
            label="Nucleotide MD5"
            value={feature.na_sequence_md5}
          />
          <OverviewField
            label="Amino acid MD5"
            value={feature.aa_sequence_md5}
          />
        </dl>
      </OverviewCard>
      <OverviewCard title="Annotation and families">
        <dl className="grid gap-4 sm:grid-cols-2">
          <OverviewField label="Gene symbol" value={feature.gene} />
          <OverviewField label="Product" value={feature.product} />
          <OverviewField label="Local family" value={feature.plfam_id} />
          <OverviewField label="Global family" value={feature.pgfam_id} />
          <OverviewField label="SOG ID" value={feature.sog_id} />
          <OverviewField label="OG ID" value={feature.og_id} />
          <OverviewField label="GO terms" value={feature.go} />
          <OverviewField label="Properties" value={feature.property} />
          <OverviewField label="Notes" value={feature.notes} />
          <OverviewField label="Date added" value={feature.date_inserted} />
        </dl>
      </OverviewCard>
    </div>
  );
}
