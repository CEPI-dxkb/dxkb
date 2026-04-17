import { createServiceDefinition } from "@/lib/services/service-definition";

import {
  defaultGenomeAlignmentFormValues,
  genomeAlignmentFormSchema,
  type GenomeAlignmentFormData,
} from "./genome-alignment-form-schema";
import { transformGenomeAlignmentParams } from "./genome-alignment-form-utils";

export const genomeAlignmentService =
  createServiceDefinition<GenomeAlignmentFormData>({
    serviceName: "GenomeAlignment",
    displayName: "Genome Alignment",
    schema: genomeAlignmentFormSchema,
    defaultValues: defaultGenomeAlignmentFormValues,
    transformParams: transformGenomeAlignmentParams,
    rerun: {
      fields: ["output_path", "output_file"],
    },
  });
