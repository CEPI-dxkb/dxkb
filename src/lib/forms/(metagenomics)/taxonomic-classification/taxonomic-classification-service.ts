import { extractSampleIdFromPath } from "@/lib/forms/service-library-rules";
import { rerunBooleanValue } from "@/lib/rerun-utility";
import { createServiceDefinition } from "@/lib/services/service-definition";

import {
  defaultTaxonomicClassificationFormValues,
  taxonomicClassificationFormSchema,
  type TaxonomicClassificationFormData,
} from "./taxonomic-classification-form-schema";
import { transformTaxonomicClassificationParams } from "./taxonomic-classification-form-utils";

export const taxonomicClassificationService =
  createServiceDefinition<TaxonomicClassificationFormData>({
    serviceName: "TaxonomicClassification",
    displayName: "Taxonomic Classification",
    schema: taxonomicClassificationFormSchema,
    defaultValues: defaultTaxonomicClassificationFormValues,
    transformParams: transformTaxonomicClassificationParams,
    rerun: {
      fields: [
        "output_path",
        "output_file",
        "analysis_type",
        "database",
        "host_genome",
        "confidence_interval",
      ],
      libraries: ["paired", "single", "sra"],
      getLibraryExtra: (lib, kind) => {
        if (kind === "paired") {
          return {
            sampleId:
              lib.sample_id || extractSampleIdFromPath(lib.read1, "sample"),
          };
        }
        if (kind === "single") {
          return {
            sampleId:
              lib.sample_id || extractSampleIdFromPath(lib.read, "sample"),
          };
        }
        return { sampleId: lib.sample_id || "" };
      },
      onApply: (rerunData, form) => {
        if (rerunData.sequence_type) {
          const sequenceType =
            rerunData.sequence_type === "sixteenS"
              ? "16s"
              : (rerunData.sequence_type as TaxonomicClassificationFormData["sequence_type"]);
          form.setFieldValue("sequence_type", sequenceType as never);
        }
        if (rerunData.save_classified_sequences !== undefined) {
          form.setFieldValue(
            "save_classified_sequences",
            rerunBooleanValue(rerunData.save_classified_sequences) as never,
          );
        }
        if (rerunData.save_unclassified_sequences !== undefined) {
          form.setFieldValue(
            "save_unclassified_sequences",
            rerunBooleanValue(rerunData.save_unclassified_sequences) as never,
          );
        }
      },
    },
  });
