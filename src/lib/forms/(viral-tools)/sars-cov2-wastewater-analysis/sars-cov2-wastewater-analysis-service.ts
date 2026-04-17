import { createServiceDefinition } from "@/lib/services/service-definition";

import {
  defaultSarsCov2WastewaterAnalysisFormValues,
  sarsCov2WastewaterAnalysisFormSchema,
  type SarsCov2WastewaterAnalysisFormData,
} from "./sars-cov2-wastewater-analysis-form-schema";
import { transformSarsCov2WastewaterParams } from "./sars-cov2-wastewater-analysis-form-utils";

export const sarsCov2WastewaterAnalysisService =
  createServiceDefinition<SarsCov2WastewaterAnalysisFormData>({
    serviceName: "SARS2Wastewater",
    displayName: "SARS-CoV-2 Wastewater Analysis",
    schema: sarsCov2WastewaterAnalysisFormSchema,
    defaultValues: defaultSarsCov2WastewaterAnalysisFormValues,
    transformParams: transformSarsCov2WastewaterParams,
    rerun: {
      fields: [
        "recipe",
        "primers",
        "primer_version",
        "output_path",
        "output_file",
      ],
    },
  });
