import { MetadataLink } from "@/components/detail-panel/metadata-link";
import {
  OverviewSection,
  formatOverviewValue,
  type OverviewSectionField,
} from "@/components/views";
import type { FeatureViewRecord } from "@/lib/feature-view";
import { genomeHref, taxonomyHref } from "@/lib/views/hrefs";
import { isTaxonId } from "@/lib/taxonomy-view";

interface FeatureOverviewProps {
  feature: FeatureViewRecord;
}

/**
 * A field whose formatted value doubles as a link when a destination resolves,
 * and renders as plain text when none does. The destination goes through the
 * shared `MetadataLink` boundary rather than a local `<Link>`, so an unsafe
 * href renders nothing instead of an unclassified anchor.
 */
function linkField(
  label: string,
  value: unknown,
  href: string | undefined,
): OverviewSectionField {
  return {
    label,
    value,
    children: href ? (
      <MetadataLink href={href}>{formatOverviewValue(value)}</MetadataLink>
    ) : undefined,
  };
}

export function FeatureOverview({ feature }: FeatureOverviewProps) {
  const taxonId = String(feature.taxon_id);
  return (
    <div className="grid gap-4 pb-6 xl:grid-cols-2">
      <OverviewSection
        title="Genome and source"
        fields={[
          linkField(
            "Genome",
            feature.genome_name ?? feature.genome_id,
            feature.genome_id ? genomeHref(feature.genome_id) : undefined,
          ),
          linkField(
            "Taxon ID",
            feature.taxon_id,
            isTaxonId(taxonId) ? taxonomyHref(taxonId) : undefined,
          ),
          { label: "Annotation", value: feature.annotation },
          { label: "Feature type", value: feature.feature_type },
        ]}
      />
      <OverviewSection
        title="Identifiers"
        fields={[
          { label: "Feature ID", value: feature.feature_id },
          { label: "BRC ID", value: feature.patric_id },
          { label: "RefSeq locus tag", value: feature.refseq_locus_tag },
          { label: "Protein ID", value: feature.protein_id },
          { label: "Gene ID", value: feature.gene_id },
          { label: "UniProtKB accession", value: feature.uniprotkb_accession },
          { label: "PDB accession", value: feature.pdb_accession },
        ]}
      />
      <OverviewSection
        title="Location and sequence"
        fields={[
          { label: "Sequence ID", value: feature.sequence_id },
          { label: "Accession", value: feature.accession },
          { label: "Start", value: feature.start },
          { label: "End", value: feature.end },
          { label: "Strand", value: feature.strand },
          { label: "Location", value: feature.location },
          { label: "Codon start", value: feature.codon_start },
          { label: "Nucleotide length", value: feature.na_length },
          { label: "Amino acid length", value: feature.aa_length },
          { label: "Nucleotide MD5", value: feature.na_sequence_md5 },
          // `aa_sequence_md5` stays inert text. The plan forbids inventing a
          // destination for it without domain confirmation.
          { label: "Amino acid MD5", value: feature.aa_sequence_md5 },
        ]}
      />
      <OverviewSection
        title="Annotation and families"
        fields={[
          { label: "Gene symbol", value: feature.gene },
          { label: "Product", value: feature.product },
          { label: "Local family", value: feature.plfam_id },
          { label: "Global family", value: feature.pgfam_id },
          { label: "SOG ID", value: feature.sog_id },
          { label: "OG ID", value: feature.og_id },
          { label: "GO terms", value: feature.go },
          { label: "Properties", value: feature.property },
          { label: "Notes", value: feature.notes },
          { label: "Date added", value: feature.date_inserted },
        ]}
      />
    </div>
  );
}
