import { createServiceDefinition } from "@/lib/services/service-definition";

import {
  defaultSimilarGenomeFinderFormValues,
  type SimilarGenomeFinderFormData,
} from "./similar-genome-finder-form-schema";
import { transformSimilarGenomeFinderParams } from "./similar-genome-finder-form-utils";

export const similarGenomeFinderService =
  createServiceDefinition<SimilarGenomeFinderFormData>({
    serviceName: "SimilarGenomeFinder",
    displayName: "Similar Genome Finder",
    defaultValues: defaultSimilarGenomeFinderFormValues,
    transformParams: transformSimilarGenomeFinderParams,
    rerun: {
      fields: ["selectedGenomeId", "fasta_file", "output_path", "output_file"],
      onApply: (rerunData, form) => {
        if (typeof rerunData.max_hits === "number") {
          form.setFieldValue("max_hits", rerunData.max_hits);
        }
        if (typeof rerunData.max_pvalue === "number") {
          form.setFieldValue("max_pvalue", rerunData.max_pvalue);
        }
        if (typeof rerunData.max_distance === "number") {
          form.setFieldValue("max_distance", rerunData.max_distance);
        }
        if (
          typeof rerunData.include_bacterial === "boolean" ||
          rerunData.include_bacterial === 0 ||
          rerunData.include_bacterial === 1
        ) {
          form.setFieldValue(
            "include_bacterial",
            Boolean(rerunData.include_bacterial),
          );
        }
        if (
          typeof rerunData.include_viral === "boolean" ||
          rerunData.include_viral === 0 ||
          rerunData.include_viral === 1
        ) {
          form.setFieldValue("include_viral", Boolean(rerunData.include_viral));
        }
        if (rerunData.scope === "reference" || rerunData.scope === "all") {
          form.setFieldValue("scope", rerunData.scope);
        }
      },
    },
  });
