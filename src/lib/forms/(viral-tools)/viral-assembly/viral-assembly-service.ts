import { createServiceDefinition } from "@/lib/services/service-definition";

import {
  defaultViralAssemblyFormValues,
  viralAssemblyFormSchema,
  type ViralAssemblyFormData,
} from "./viral-assembly-form-schema";
import { transformViralAssemblyParams } from "./viral-assembly-form-utils";

export const viralAssemblyService =
  createServiceDefinition<ViralAssemblyFormData>({
    serviceName: "ViralAssembly",
    displayName: "Viral Assembly",
    schema: viralAssemblyFormSchema,
    defaultValues: defaultViralAssemblyFormValues,
    transformParams: transformViralAssemblyParams,
    rerun: {
      fields: ["strategy", "module", "output_path", "output_file"],
    },
  });
