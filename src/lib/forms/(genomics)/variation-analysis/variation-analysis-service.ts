import { createServiceDefinition } from "@/lib/services/service-definition";

import {
  defaultVariationAnalysisFormValues,
  type VariationAnalysisFormData,
} from "./variation-analysis-form-schema";
import { transformVariationAnalysisParams } from "./variation-analysis-form-utils";

export const variationAnalysisService =
  createServiceDefinition<VariationAnalysisFormData>({
    serviceName: "Variation",
    displayName: "Variation Analysis",
    defaultValues: defaultVariationAnalysisFormValues,
    transformParams: transformVariationAnalysisParams,
    rerun: {
      fields: [
        "output_path",
        "output_file",
        "reference_genome_id",
        "mapper",
        "caller",
      ],
    },
  });
