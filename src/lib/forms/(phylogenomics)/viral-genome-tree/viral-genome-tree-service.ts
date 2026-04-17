import { createServiceDefinition } from "@/lib/services/service-definition";

import {
  defaultViralGenomeTreeFormValues,
  viralGenomeTreeFormSchema,
  type ViralGenomeTreeFormData,
} from "./viral-genome-tree-form-schema";
import { transformViralGenomeTreeParams } from "./viral-genome-tree-form-utils";

export const viralGenomeTreeService =
  createServiceDefinition<ViralGenomeTreeFormData>({
    serviceName: "GeneTree",
    displayName: "Viral Genome Tree",
    schema: viralGenomeTreeFormSchema,
    defaultValues: defaultViralGenomeTreeFormValues,
    transformParams: transformViralGenomeTreeParams,
    rerun: {
      fields: [
        "recipe",
        "substitution_model",
        "output_path",
        "output_file",
      ],
    },
  });
