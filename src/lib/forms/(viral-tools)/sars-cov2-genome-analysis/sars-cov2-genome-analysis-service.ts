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
        const outputFile = rerunData.output_file as string | undefined;
        applyTaxonomyIdWithLookup(
          String(rerunData.taxonomy_id),
          form,
          (taxonName) => {
            if (!outputFile) return;
            const prefix = `${sanitizeTaxonomyForOutputName(taxonName)} `;
            const label = outputFile.startsWith(prefix)
              ? outputFile.slice(prefix.length).trim()
              : "";
            if (label) {
              form.setFieldValue("my_label", label);
            }
          },
        );
      },
    },
  });
