import Link from "next/link";
import { ExternalLink } from "lucide-react";
import {
  OverviewCard,
  OverviewField,
  formatOverviewValue,
  isOverviewValueAvailable,
} from "@/components/views";
import type { ExperimentViewRecord } from "@/lib/experiment-view";
import { experimentHref, genomeHref } from "@/lib/views/hrefs";

interface LinkItem {
  href?: string;
  label: string;
}

interface LinkFieldProps {
  label: string;
  items: LinkItem[];
  external?: boolean;
}

interface ExperimentOverviewProps {
  experiment: ExperimentViewRecord;
}

function LinkField({ label, items, external = false }: LinkFieldProps) {
  const availableItems = items.filter((item) => item.label !== "");

  return (
    <OverviewField
      label={label}
      available={availableItems.length > 0}
      className="mt-0.5 flex flex-wrap gap-x-2 wrap-break-word"
    >
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
    </OverviewField>
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
      <OverviewCard title="Study">
        <dl className="grid gap-4 sm:grid-cols-2">
          <OverviewField label="Study name" value={experiment.study_name} />
          <OverviewField label="Study title" value={experiment.study_title} />
          <OverviewField
            label="Description"
            value={experiment.study_description}
          />
          <OverviewField
            label="Principal investigator"
            value={experiment.study_pi}
          />
          <OverviewField
            label="Institution"
            value={experiment.study_institution}
          />
        </dl>
      </OverviewCard>
      <OverviewCard title="Experiment">
        <dl className="grid gap-4 sm:grid-cols-2">
          <OverviewField label="Experiment ID" value={experiment.exp_id} />
          <OverviewField label="Name" value={experiment.exp_name} />
          <OverviewField label="Title" value={experiment.exp_title} />
          <OverviewField
            label="Description"
            value={experiment.exp_description}
          />
          <OverviewField
            label="Point of contact"
            value={experiment.exp_poc}
          />
          <OverviewField
            label="Experimenters"
            value={experiment.experimenters}
          />
          <OverviewField label="Type" value={experiment.exp_type} />
          <OverviewField
            label="Measurement technique"
            value={experiment.measurement_technique}
          />
        </dl>
      </OverviewCard>
      <OverviewCard title="Repository and publication">
        <dl className="grid gap-4 sm:grid-cols-2">
          <OverviewField
            label="Public repository"
            value={experiment.public_repository}
          />
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
                      label: formatOverviewValue(experiment.pmid),
                    },
                  ]
                : []
            }
            external
          />
        </dl>
      </OverviewCard>
      <OverviewCard title="Organism and treatment">
        <dl className="grid gap-4 sm:grid-cols-2">
          <OverviewField label="Organism" value={experiment.organism} />
          <OverviewField label="Strain" value={experiment.strain} />
          <LinkField
            label="Genome"
            items={genomeIds.map((genomeId) => ({
              href: genomeHref(genomeId),
              label: genomeId,
            }))}
          />
          <OverviewField
            label="Treatment type"
            value={experiment.treatment_type}
          />
          <OverviewField
            label="Treatment name"
            value={experiment.treatment_name}
          />
          <OverviewField
            label="Treatment amount"
            value={experiment.treatment_amount}
          />
          <OverviewField
            label="Treatment duration"
            value={experiment.treatment_duration}
          />
        </dl>
      </OverviewCard>
      <OverviewCard title="Samples and biosets">
        <dl className="grid gap-4 sm:grid-cols-2">
          <OverviewField label="Samples" value={experiment.samples} />
          <LinkField
            label="Biosets"
            items={
              isOverviewValueAvailable(experiment.biosets)
                ? [
                    {
                      href: `${experimentHref(experiment.exp_id)}?tab=biosets`,
                      label: formatOverviewValue(experiment.biosets),
                    },
                  ]
                : []
            }
          />
        </dl>
      </OverviewCard>
      <OverviewCard title="Additional metadata">
        <dl className="grid gap-4 sm:grid-cols-2">
          <OverviewField label="Date added" value={experiment.date_inserted} />
          <OverviewField
            label="Additional metadata"
            value={experiment.additional_metadata}
          />
        </dl>
      </OverviewCard>
    </div>
  );
}
