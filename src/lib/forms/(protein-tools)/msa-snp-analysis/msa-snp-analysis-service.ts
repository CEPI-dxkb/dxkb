import { createServiceDefinition } from "@/lib/services/service-definition";

import {
  defaultMsaSnpAnalysisFormValues,
  msaSnpAnalysisFormSchema,
  type MsaSnpAnalysisFormData,
} from "./msa-snp-analysis-form-schema";
import { transformMsaSnpAnalysisParams } from "./msa-snp-analysis-form-utils";

export const msaSnpAnalysisService =
  createServiceDefinition<MsaSnpAnalysisFormData>({
    serviceName: "MSA",
    displayName: "MSA SNP Analysis",
    schema: msaSnpAnalysisFormSchema,
    defaultValues: defaultMsaSnpAnalysisFormValues,
    transformParams: transformMsaSnpAnalysisParams,
    rerun: {
      fields: [
        "input_status",
        "alphabet",
        "ref_type",
        "aligner",
        "output_path",
        "output_file",
      ],
    },
  });
