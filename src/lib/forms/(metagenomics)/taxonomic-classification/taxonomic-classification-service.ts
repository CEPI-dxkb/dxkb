import { rerunBooleanValue } from "@/lib/rerun-utility";
import { createServiceDefinition } from "@/lib/services/service-definition";

import {
  defaultTaxonomicClassificationFormValues,
  taxonomicClassificationFormSchema,
  type TaxonomicClassificationFormData,
} from "./taxonomic-classification-form-schema";
import { transformTaxonomicClassificationParams } from "./taxonomic-classification-form-utils";

interface TaxonomicClassificationRerunData extends Record<string, unknown> {
  output_path?: string;
  output_file?: string;
  analysis_type?: string;
  database?: string;
  host_genome?: string;
  confidence_interval?: number;
  sequence_type?: TaxonomicClassificationFormData["sequence_type"] | "sixteenS";
}

function normalizeRerunSequenceType(
  sequenceType: TaxonomicClassificationRerunData["sequence_type"],
): TaxonomicClassificationFormData["sequence_type"] | null {
  if (sequenceType === "sixteenS") {
    return "16s";
  }
  if (sequenceType === "16s" || sequenceType === "wgs") {
    return sequenceType;
  }
  return null;
}

export const taxonomicClassificationService =
  createServiceDefinition<
    TaxonomicClassificationFormData,
    TaxonomicClassificationRerunData
  >({
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
      onApply: (rerunData, form) => {
        const sequenceType = normalizeRerunSequenceType(
          rerunData.sequence_type,
        );
        if (sequenceType) {
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
