import { createServiceDefinition } from "@/lib/services/service-definition";

import {
  defaultSimilarGenomeFinderFormValues,
  similarGenomeFinderFormSchema,
  type SimilarGenomeFinderFormData,
} from "./similar-genome-finder-form-schema";
import { transformSimilarGenomeFinderParams } from "./similar-genome-finder-form-utils";

export const similarGenomeFinderService =
  createServiceDefinition<SimilarGenomeFinderFormData>({
    serviceName: "SimilarGenomeFinder",
    displayName: "Similar Genome Finder",
    schema: similarGenomeFinderFormSchema,
    defaultValues: defaultSimilarGenomeFinderFormValues,
    transformParams: transformSimilarGenomeFinderParams,
    rerun: {
      fields: [
        "selectedGenomeId",
        "fasta_file",
        "output_path",
        "output_file",
      ],
      onApply: (rerunData, form) => {
        if (typeof rerunData.max_hits === "number") {
          form.setFieldValue("max_hits", rerunData.max_hits as never);
        }
        if (typeof rerunData.max_pvalue === "number") {
          form.setFieldValue("max_pvalue", rerunData.max_pvalue as never);
        }
        if (typeof rerunData.max_distance === "number") {
          form.setFieldValue("max_distance", rerunData.max_distance as never);
        }
        if (typeof rerunData.include_bacterial === "boolean") {
          form.setFieldValue(
            "include_bacterial",
            rerunData.include_bacterial as never,
          );
        }
        if (typeof rerunData.include_viral === "boolean") {
          form.setFieldValue("include_viral", rerunData.include_viral as never);
        }
        if (rerunData.scope === "reference" || rerunData.scope === "all") {
          form.setFieldValue("scope", rerunData.scope as never);
        }
      },
    },
  });
