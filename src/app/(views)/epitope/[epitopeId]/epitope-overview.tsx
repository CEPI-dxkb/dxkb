import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EpitopeViewRecord } from "@/lib/epitope-view";
import { taxonomyHref } from "@/lib/views/hrefs";
import { isTaxonId } from "@/lib/taxonomy-view";

interface FieldProps {
  label: string;
  value: unknown;
}

interface MetadataCardProps {
  title: string;
  children: React.ReactNode;
}

interface EpitopeOverviewProps {
  epitope: EpitopeViewRecord;
}

function display(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (value == null || value === "") return "Not available";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) return String(value);
  return JSON.stringify(value) || "Not available";
}

function Field({ label, value }: FieldProps) {
  if (value == null || value === "") return null;
  return <div><dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt><dd className="mt-0.5 wrap-break-word">{display(value)}</dd></div>;
}

function MetadataCard({ title, children }: MetadataCardProps) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent><dl className="grid gap-4 sm:grid-cols-2">{children}</dl></CardContent></Card>;
}

export function EpitopeOverview({ epitope }: EpitopeOverviewProps) {
  return (
    <div className="grid gap-4 pb-6 xl:grid-cols-2">
      <MetadataCard title="Identity and sequence">
        <Field label="Epitope ID" value={epitope.epitope_id} />
        <Field label="Epitope type" value={epitope.epitope_type} />
        <Field label="Sequence or structure" value={epitope.epitope_sequence} />
        <Field label="Start" value={epitope.start} />
        <Field label="End" value={epitope.end} />
      </MetadataCard>
      <MetadataCard title="Organism and protein">
        <Field label="Organism" value={epitope.organism} />
        {isTaxonId(String(epitope.taxon_id)) && <div><dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Taxon ID</dt><dd className="mt-0.5"><Link className="text-primary underline" href={taxonomyHref(String(epitope.taxon_id))}>{display(epitope.taxon_id)}</Link></dd></div>}
        <Field label="Protein name" value={epitope.protein_name} />
        <Field label="Protein ID" value={epitope.protein_id} />
        <Field label="Protein accession" value={epitope.protein_accession} />
        <Field label="Host" value={epitope.host_name} />
      </MetadataCard>
      <MetadataCard title="Assay summary">
        <Field label="Total assays" value={epitope.total_assays} />
        <Field label="Assay results" value={epitope.assay_results} />
        <Field label="B-cell assays" value={epitope.bcell_assays} />
        <Field label="T-cell assays" value={epitope.tcell_assays} />
        <Field label="MHC assays" value={epitope.mhc_assays} />
      </MetadataCard>
      <MetadataCard title="Provenance and comments">
        <Field label="Comments" value={epitope.comments} />
        <Field label="Date added" value={epitope.date_inserted} />
      </MetadataCard>
    </div>
  );
}
