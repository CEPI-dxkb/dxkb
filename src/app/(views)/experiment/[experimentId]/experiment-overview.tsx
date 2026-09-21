import { ExternalLink } from "lucide-react";
import { MetadataLink } from "@/components/detail-panel/metadata-link";
import {
  OverviewSection,
  formatOverviewValue,
  isOverviewValueAvailable,
  type OverviewSectionField,
} from "@/components/views";
import type { ExperimentViewRecord } from "@/lib/experiment-view";
import { experimentHref, genomeHref } from "@/lib/views/hrefs";

interface LinkItem {
  href?: string;
  label: string;
}

interface ExperimentOverviewProps {
  experiment: ExperimentViewRecord;
}

/**
 * A field holding zero or more links laid out inline. Each destination goes
 * through the shared `MetadataLink` boundary, which decides internal versus
 * external and renders the new-tab icon only for a destination it classified
 * as external — this field no longer carries its own `external` flag, so a
 * caller cannot disagree with the classifier about what a URL is.
 */
function linkListField(
  label: string,
  items: readonly LinkItem[],
): OverviewSectionField {
  const availableItems = items.filter((item) => item.label !== "");
  return {
    label,
    value: availableItems,
    available: availableItems.length > 0,
    className: "mt-0.5 flex flex-wrap gap-x-2 wrap-break-word",
    children: availableItems.map((item) =>
      item.href ? (
        <MetadataLink
          key={`${item.href}-${item.label}`}
          href={item.href}
          className="inline-flex items-center gap-1"
          externalIndicator={
            <ExternalLink className="size-3" aria-hidden="true" />
          }
        >
          {item.label}
        </MetadataLink>
      ) : (
        <span key={item.label}>{item.label}</span>
      ),
    ),
  };
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
      <OverviewSection
        title="Study"
        fields={[
          { label: "Study name", value: experiment.study_name },
          { label: "Study title", value: experiment.study_title },
          { label: "Description", value: experiment.study_description },
          { label: "Principal investigator", value: experiment.study_pi },
          { label: "Institution", value: experiment.study_institution },
        ]}
      />
      <OverviewSection
        title="Experiment"
        fields={[
          { label: "Experiment ID", value: experiment.exp_id },
          { label: "Name", value: experiment.exp_name },
          { label: "Title", value: experiment.exp_title },
          { label: "Description", value: experiment.exp_description },
          { label: "Point of contact", value: experiment.exp_poc },
          { label: "Experimenters", value: experiment.experimenters },
          { label: "Type", value: experiment.exp_type },
          {
            label: "Measurement technique",
            value: experiment.measurement_technique,
          },
        ]}
      />
      <OverviewSection
        title="Repository and publication"
        fields={[
          { label: "Public repository", value: experiment.public_repository },
          linkListField(
            "Public identifier",
            experiment.public_identifier
              ? [{ href: publicHref, label: experiment.public_identifier }]
              : [],
          ),
          linkListField(
            "PubMed",
            experiment.pmid != null
              ? [
                  {
                    href: `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(String(experiment.pmid))}/`,
                    label: formatOverviewValue(experiment.pmid),
                  },
                ]
              : [],
          ),
        ]}
      />
      <OverviewSection
        title="Organism and treatment"
        fields={[
          { label: "Organism", value: experiment.organism },
          { label: "Strain", value: experiment.strain },
          linkListField(
            "Genome",
            genomeIds.map((genomeId) => ({
              href: genomeHref(genomeId),
              label: genomeId,
            })),
          ),
          { label: "Treatment type", value: experiment.treatment_type },
          { label: "Treatment name", value: experiment.treatment_name },
          { label: "Treatment amount", value: experiment.treatment_amount },
          { label: "Treatment duration", value: experiment.treatment_duration },
        ]}
      />
      <OverviewSection
        title="Samples and biosets"
        fields={[
          { label: "Samples", value: experiment.samples },
          linkListField(
            "Biosets",
            isOverviewValueAvailable(experiment.biosets)
              ? [
                  {
                    href: `${experimentHref(experiment.exp_id)}?tab=biosets`,
                    label: formatOverviewValue(experiment.biosets),
                  },
                ]
              : [],
          ),
        ]}
      />
      <OverviewSection
        title="Additional metadata"
        fields={[
          { label: "Date added", value: experiment.date_inserted },
          {
            label: "Additional metadata",
            value: experiment.additional_metadata,
          },
        ]}
      />
    </div>
  );
}
