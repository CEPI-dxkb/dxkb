import { createServiceDefinition } from "@/lib/services/service-definition";
import { rerunBooleanValue } from "@/lib/rerun-utility";

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
        if (rerunData.include_bacterial != null) {
          form.setFieldValue(
            "include_bacterial",
            rerunBooleanValue(rerunData.include_bacterial),
          );
        }
        if (rerunData.include_viral != null) {
          form.setFieldValue(
            "include_viral",
            rerunBooleanValue(rerunData.include_viral),
          );
        }
        if (rerunData.scope === "reference" || rerunData.scope === "all") {
          form.setFieldValue("scope", rerunData.scope);
        }
      },
    },
  });
