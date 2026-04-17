import { noop } from "@/lib/utils";
import { createServiceDefinition } from "@/lib/services/service-definition";

import {
  completeGenomeAnnotationSchema,
  defaultGenomeAnnotationFormValues,
  type GenomeAnnotationFormData,
} from "./genome-annotation-form-schema";
import { transformGenomeAnnotationParams } from "./genome-annotation-form-utils";

export const genomeAnnotationService =
  createServiceDefinition<GenomeAnnotationFormData>({
    serviceName: "GenomeAnnotation",
    displayName: "Genome Annotation",
    schema: completeGenomeAnnotationSchema,
    defaultValues: defaultGenomeAnnotationFormValues,
    transformParams: transformGenomeAnnotationParams,
    rerun: {
      fields: ["contigs", "recipe", "output_path", "output_file"],
      onApply: (rerunData, form) => {
        if (rerunData.taxonomy_id) {
          const taxonId = String(rerunData.taxonomy_id);
          form.setFieldValue("taxonomy_id", taxonId as never);
          const storedLabel = rerunData.my_label as string | undefined;
          fetch(
            `/api/services/taxonomy?q=taxon_id:${taxonId}&fl=taxon_id,taxon_name`,
          )
            .then((r) => r.json())
            .then((data) => {
              const docs = Array.isArray(data) ? data : data?.response?.docs;
              if (docs && docs.length > 0) {
                form.setFieldValue(
                  "scientific_name",
                  docs[0].taxon_name as never,
                );
              }
              if (storedLabel) {
                form.setFieldValue("my_label", storedLabel as never);
              }
            })
            .catch(noop);
        } else {
          if (rerunData.scientific_name) {
            form.setFieldValue(
              "scientific_name",
              rerunData.scientific_name as never,
            );
          }
          if (rerunData.my_label) {
            form.setFieldValue("my_label", rerunData.my_label as never);
          }
        }
      },
    },
  });
