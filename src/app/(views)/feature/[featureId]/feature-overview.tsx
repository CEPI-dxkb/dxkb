import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FeatureViewRecord } from "@/lib/feature-view";
import { genomeHref, taxonomyHref } from "@/lib/views/hrefs";
import { isTaxonId } from "@/lib/taxonomy-view";

interface FieldProps {
  label: string;
  value: unknown;
}

interface LinkFieldProps extends FieldProps {
  href?: string;
}

interface MetadataCardProps {
  title: string;
  children: React.ReactNode;
}

interface FeatureOverviewProps {
  feature: FeatureViewRecord;
}

function display(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (value == null || value === "") return "Not available";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }
  const stringify: (input: unknown) => string | undefined = JSON.stringify;
  return stringify(value) ?? "Not available";
}

function Field({ label, value }: FieldProps) {
  if (value == null || value === "") return null;
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-0.5 wrap-break-word">{display(value)}</dd>
    </div>
  );
}

function LinkField({ label, value, href }: LinkFieldProps) {
  if (value == null || value === "") return null;
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-0.5 wrap-break-word">
        {href ? <Link className="text-primary underline" href={href}>{display(value)}</Link> : display(value)}
      </dd>
    </div>
  );
}

function MetadataCard({ title, children }: MetadataCardProps) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent><dl className="grid gap-4 sm:grid-cols-2">{children}</dl></CardContent>
    </Card>
  );
}

export function FeatureOverview({ feature }: FeatureOverviewProps) {
  return (
    <div className="grid gap-4 pb-6 xl:grid-cols-2">
      <MetadataCard title="Genome and source">
        <LinkField label="Genome" value={feature.genome_name ?? feature.genome_id} href={feature.genome_id ? genomeHref(feature.genome_id) : undefined} />
        <LinkField label="Taxon ID" value={feature.taxon_id} href={isTaxonId(String(feature.taxon_id)) ? taxonomyHref(String(feature.taxon_id)) : undefined} />
        <Field label="Annotation" value={feature.annotation} />
        <Field label="Feature type" value={feature.feature_type} />
      </MetadataCard>
      <MetadataCard title="Identifiers">
        <Field label="Feature ID" value={feature.feature_id} />
        <Field label="BRC ID" value={feature.patric_id} />
        <Field label="RefSeq locus tag" value={feature.refseq_locus_tag} />
        <Field label="Protein ID" value={feature.protein_id} />
        <Field label="Gene ID" value={feature.gene_id} />
        <Field label="UniProtKB accession" value={feature.uniprotkb_accession} />
        <Field label="PDB accession" value={feature.pdb_accession} />
      </MetadataCard>
      <MetadataCard title="Location and sequence">
        <Field label="Sequence ID" value={feature.sequence_id} />
        <Field label="Accession" value={feature.accession} />
        <Field label="Start" value={feature.start} />
        <Field label="End" value={feature.end} />
        <Field label="Strand" value={feature.strand} />
        <Field label="Location" value={feature.location} />
        <Field label="Codon start" value={feature.codon_start} />
        <Field label="Nucleotide length" value={feature.na_length} />
        <Field label="Amino acid length" value={feature.aa_length} />
        <Field label="Nucleotide MD5" value={feature.na_sequence_md5} />
        <Field label="Amino acid MD5" value={feature.aa_sequence_md5} />
      </MetadataCard>
      <MetadataCard title="Annotation and families">
        <Field label="Gene symbol" value={feature.gene} />
        <Field label="Product" value={feature.product} />
        <Field label="Local family" value={feature.plfam_id} />
        <Field label="Global family" value={feature.pgfam_id} />
        <Field label="SOG ID" value={feature.sog_id} />
        <Field label="OG ID" value={feature.og_id} />
        <Field label="GO terms" value={feature.go} />
        <Field label="Properties" value={feature.property} />
        <Field label="Notes" value={feature.notes} />
        <Field label="Date added" value={feature.date_inserted} />
      </MetadataCard>
    </div>
  );
}
