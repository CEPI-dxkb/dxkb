import { applyTaxonomyIdWithLookup } from "@/lib/forms/taxonomy-lookup";
import { createServiceDefinition } from "@/lib/services/service-definition";

import {
  defaultGenomeAnnotationFormValues,
  type GenomeAnnotationFormData,
} from "./genome-annotation-form-schema";
import { transformGenomeAnnotationParams } from "./genome-annotation-form-utils";

export const genomeAnnotationService =
  createServiceDefinition<GenomeAnnotationFormData>({
    serviceName: "GenomeAnnotation",
    displayName: "Genome Annotation",
    defaultValues: defaultGenomeAnnotationFormValues,
    transformParams: transformGenomeAnnotationParams,
    rerun: {
      fields: ["contigs", "recipe", "output_path", "output_file"],
      onApply: (rerunData, form) => {
        // Restore what the job carries first, so a taxonomy outage leaves a
        // submittable form; a successful lookup then refreshes the name.
        if (typeof rerunData.scientific_name === "string") {
          form.setFieldValue("scientific_name", rerunData.scientific_name);
        }
        if (typeof rerunData.my_label === "string" && rerunData.my_label) {
          form.setFieldValue("my_label", rerunData.my_label);
        }
        const taxonomyId =
          typeof rerunData.taxonomy_id === "string"
            ? rerunData.taxonomy_id
            : typeof rerunData.taxonomy_id === "number"
              ? String(rerunData.taxonomy_id)
              : "";
        if (taxonomyId) applyTaxonomyIdWithLookup(taxonomyId, form);
      },
    },
  });
