import { applyTaxonomyIdWithLookup } from "@/lib/forms/taxonomy-lookup";
import { createServiceDefinition } from "@/lib/services/service-definition";

import {
  defaultSarsCov2GenomeAnalysisFormValues,
  type SarsCov2GenomeAnalysisFormData,
} from "./sars-cov2-genome-analysis-form-schema";
import {
  sanitizeTaxonomyForOutputName,
  transformSarsCov2GenomeAnalysisParams,
} from "./sars-cov2-genome-analysis-form-utils";

/** The user's label from a previous job's output name ("<sanitized taxon name> <label>"). */
function labelFromOutputName(outputFile: string, taxonName: string): string {
  const prefix = `${sanitizeTaxonomyForOutputName(taxonName)} `;
  return outputFile.startsWith(prefix)
    ? outputFile.slice(prefix.length).trim()
    : "";
}

/**
 * The taxon name a rerun can restore without a lookup: `scientific_name` when it differs from the
 * output name, else the output name less `my_label`, or the form's default taxon.
 */
function knownTaxonName(
  rerunData: Record<string, unknown>,
  taxonomyId: string,
  outputFile: string,
): string {
  const jobName =
    typeof rerunData.scientific_name === "string"
      ? rerunData.scientific_name.trim()
      : "";
  if (jobName && jobName !== outputFile.trim()) return jobName;
  const labelSuffix =
    typeof rerunData.my_label === "string" && rerunData.my_label.trim()
      ? ` ${rerunData.my_label.trim()}`
      : "";
  if (labelSuffix && jobName.endsWith(labelSuffix)) {
    return jobName.slice(0, -labelSuffix.length).trim();
  }
  return taxonomyId === defaultSarsCov2GenomeAnalysisFormValues.taxonomy_id
    ? defaultSarsCov2GenomeAnalysisFormValues.scientific_name
    : "";
}

export const sarsCov2GenomeAnalysisService =
  createServiceDefinition<SarsCov2GenomeAnalysisFormData>({
    serviceName: "ComprehensiveSARS2Analysis",
    displayName: "SARS-CoV-2 Genome Analysis",
    defaultValues: defaultSarsCov2GenomeAnalysisFormValues,
    transformParams: transformSarsCov2GenomeAnalysisParams,
    rerun: {
      fields: [
        "input_type",
        "my_label",
        "output_path",
        "output_file",
        "recipe",
        "primers",
        "primer_version",
        "contigs",
      ],
      onApply: (rerunData, form) => {
        if (!rerunData.taxonomy_id) return;
        const rawTaxId = rerunData.taxonomy_id;
        const taxonomyId =
          typeof rawTaxId === "string"
            ? rawTaxId
            : typeof rawTaxId === "number"
              ? String(rawTaxId)
              : "";
        const outputFile =
          typeof rerunData.output_file === "string" ? rerunData.output_file : "";
        const hasOwnLabel =
          typeof rerunData.my_label === "string" && rerunData.my_label !== "";
        const applyLabel = (taxonName: string) => {
          if (hasOwnLabel) return;
          const label = labelFromOutputName(outputFile, taxonName);
          if (label) form.setFieldValue("my_label", label);
        };

        // Restore name and label up front so they do not wait on the taxonomy lookup.
        const knownName = knownTaxonName(rerunData, taxonomyId, outputFile);
        if (knownName) {
          form.setFieldValue("scientific_name", knownName);
          applyLabel(knownName);
        }
        applyTaxonomyIdWithLookup(taxonomyId, form, { onResolved: applyLabel });
      },
    },
  });
