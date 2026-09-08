import Link from "next/link";
import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExperimentViewRecord } from "@/lib/experiment-view";
import { experimentHref, genomeHref } from "@/lib/views/hrefs";

interface FieldProps {
  label: string;
  value: unknown;
}

interface LinkItem {
  href?: string;
  label: string;
}

interface LinkFieldProps {
  label: string;
  items: LinkItem[];
  external?: boolean;
}

interface MetadataCardProps {
  title: string;
  children: ReactNode;
}

interface ExperimentOverviewProps {
  experiment: ExperimentViewRecord;
}

function isAvailable(value: unknown): boolean {
  return (
    value != null && value !== "" && (!Array.isArray(value) || value.length > 0)
  );
}

function display(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (!isAvailable(value)) return "Not available";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  )
    return String(value);
  return JSON.stringify(value) || "Not available";
}

function Field({ label, value }: FieldProps) {
  if (!isAvailable(value)) return null;
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 wrap-break-word">{display(value)}</dd>
    </div>
  );
}

function LinkField({ label, items, external = false }: LinkFieldProps) {
  const availableItems = items.filter((item) => item.label !== "");
  if (availableItems.length === 0) return null;

  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 flex flex-wrap gap-x-2 wrap-break-word">
        {availableItems.map((item) =>
          item.href ? (
            external ? (
              <a
                key={`${item.href}-${item.label}`}
                className="inline-flex items-center gap-1 text-primary underline"
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {item.label}
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            ) : (
              <Link
                key={`${item.href}-${item.label}`}
                className="text-primary underline"
                href={item.href}
              >
                {item.label}
              </Link>
            )
          ) : (
            <span key={item.label}>{item.label}</span>
          ),
        )}
      </dd>
    </div>
  );
}

function MetadataCard({ title, children }: MetadataCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-2">{children}</dl>
      </CardContent>
    </Card>
  );
}

function repositoryHref(
  repository: string | undefined,
  identifier: string | undefined,
) {
  if (!repository || !identifier) return undefined;
  switch (repository.trim().toUpperCase()) {
    case "GEO":
      return `https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${encodeURIComponent(identifier)}`;
    case "ARRAYEXPRESS":
      return `https://www.ebi.ac.uk/biostudies/arrayexpress/studies/${encodeURIComponent(identifier)}`;
    default:
      return undefined;
  }
}

export function ExperimentOverview({ experiment }: ExperimentOverviewProps) {
  const genomeIds = (
    Array.isArray(experiment.genome_id)
      ? experiment.genome_id
      : [experiment.genome_id]
  ).filter((genomeId): genomeId is string => Boolean(genomeId));
  const publicHref = repositoryHref(
    experiment.public_repository,
    experiment.public_identifier,
  );
  return (
    <div className="grid gap-4 pb-6 xl:grid-cols-2">
      <MetadataCard title="Study">
        <Field label="Study name" value={experiment.study_name} />
        <Field label="Study title" value={experiment.study_title} />
        <Field label="Description" value={experiment.study_description} />
        <Field label="Principal investigator" value={experiment.study_pi} />
        <Field label="Institution" value={experiment.study_institution} />
      </MetadataCard>
      <MetadataCard title="Experiment">
        <Field label="Experiment ID" value={experiment.exp_id} />
        <Field label="Name" value={experiment.exp_name} />
        <Field label="Title" value={experiment.exp_title} />
        <Field label="Description" value={experiment.exp_description} />
        <Field label="Point of contact" value={experiment.exp_poc} />
        <Field label="Experimenters" value={experiment.experimenters} />
        <Field label="Type" value={experiment.exp_type} />
        <Field
          label="Measurement technique"
          value={experiment.measurement_technique}
        />
      </MetadataCard>
      <MetadataCard title="Repository and publication">
        <Field label="Public repository" value={experiment.public_repository} />
        <LinkField
          label="Public identifier"
          items={
            experiment.public_identifier
              ? [{ href: publicHref, label: experiment.public_identifier }]
              : []
          }
          external
        />
        <LinkField
          label="PubMed"
          items={
            experiment.pmid != null
              ? [
                  {
                    href: `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(String(experiment.pmid))}/`,
                    label: display(experiment.pmid),
                  },
                ]
              : []
          }
          external
        />
      </MetadataCard>
      <MetadataCard title="Organism and treatment">
        <Field label="Organism" value={experiment.organism} />
        <Field label="Strain" value={experiment.strain} />
        <LinkField
          label="Genome"
          items={genomeIds.map((genomeId) => ({
            href: genomeHref(genomeId),
            label: genomeId,
          }))}
        />
        <Field label="Treatment type" value={experiment.treatment_type} />
        <Field label="Treatment name" value={experiment.treatment_name} />
        <Field label="Treatment amount" value={experiment.treatment_amount} />
        <Field
          label="Treatment duration"
          value={experiment.treatment_duration}
        />
      </MetadataCard>
      <MetadataCard title="Samples and biosets">
        <Field label="Samples" value={experiment.samples} />
        <LinkField
          label="Biosets"
          items={
            isAvailable(experiment.biosets)
              ? [
                  {
                    href: `${experimentHref(experiment.exp_id)}?tab=biosets`,
                    label: display(experiment.biosets),
                  },
                ]
              : []
          }
        />
      </MetadataCard>
      <MetadataCard title="Additional metadata">
        <Field label="Date added" value={experiment.date_inserted} />
        <Field
          label="Additional metadata"
          value={experiment.additional_metadata}
        />
      </MetadataCard>
    </div>
  );
}
