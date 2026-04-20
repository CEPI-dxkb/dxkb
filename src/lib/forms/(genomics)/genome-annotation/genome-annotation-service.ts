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
        const label =
          typeof rerunData.my_label === "string" ? rerunData.my_label : "";
        if (rerunData.taxonomy_id) {
          applyTaxonomyIdWithLookup(String(rerunData.taxonomy_id), form);
          if (label) {
            form.setFieldValue("my_label", label);
          }
        } else {
          if (typeof rerunData.scientific_name === "string") {
            form.setFieldValue("scientific_name", rerunData.scientific_name);
          }
          if (label) {
            form.setFieldValue("my_label", label);
          }
        }
      },
    },
  });
