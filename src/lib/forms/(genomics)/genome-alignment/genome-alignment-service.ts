import { createServiceDefinition } from "@/lib/services/service-definition";

import {
  defaultGenomeAlignmentFormValues,
  type GenomeAlignmentFormData,
} from "./genome-alignment-form-schema";
import { transformGenomeAlignmentParams } from "./genome-alignment-form-utils";

export const genomeAlignmentService =
  createServiceDefinition<GenomeAlignmentFormData>({
    serviceName: "GenomeAlignment",
    displayName: "Genome Alignment",
    defaultValues: defaultGenomeAlignmentFormValues,
    transformParams: transformGenomeAlignmentParams,
    rerun: {
      fields: ["output_path", "output_file"],
    },
  });
