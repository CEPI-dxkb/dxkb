import { noop } from "@/lib/utils";
import { createServiceDefinition } from "@/lib/services/service-definition";

import {
  defaultSarsCov2GenomeAnalysisFormValues,
  sarsCov2GenomeAnalysisFormSchema,
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
    schema: sarsCov2GenomeAnalysisFormSchema,
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

        const taxonId = String(rerunData.taxonomy_id);
        form.setFieldValue("taxonomy_id", taxonId as never);
        const outputFile = rerunData.output_file as string | undefined;
        fetch(
          `/api/services/taxonomy?q=taxon_id:${taxonId}&fl=taxon_id,taxon_name`,
        )
          .then((r) => r.json())
          .then((data) => {
            const docs = Array.isArray(data) ? data : data?.response?.docs;
            if (docs && docs.length > 0) {
              const taxonName: string = docs[0].taxon_name;
              form.setFieldValue("scientific_name", taxonName as never);
              if (outputFile) {
                const sanitized = sanitizeTaxonomyForOutputName(taxonName);
                const prefix = `${sanitized} `;
                const label = outputFile.startsWith(prefix)
                  ? outputFile.slice(prefix.length).trim()
                  : "";
                if (label) {
                  form.setFieldValue("my_label", label as never);
                }
              }
            }
          })
          .catch(noop);
      },
    },
  });
