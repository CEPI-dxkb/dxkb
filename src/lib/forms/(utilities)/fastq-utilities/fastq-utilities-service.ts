import { createServiceDefinition } from "@/lib/services/service-definition";

import {
  defaultFastqUtilitiesFormValues,
  fastqUtilitiesFormSchema,
  type FastqUtilitiesFormData,
} from "./fastq-utilities-form-schema";
import { transformFastqUtilitiesParams } from "./fastq-utilities-form-utils";

export const fastqUtilitiesService =
  createServiceDefinition<FastqUtilitiesFormData>({
    serviceName: "FastqUtils",
    displayName: "FASTQ Utilities",
    schema: fastqUtilitiesFormSchema,
    defaultValues: defaultFastqUtilitiesFormValues,
    transformParams: transformFastqUtilitiesParams,
    rerun: {
      fields: ["output_path", "output_file", "reference_genome_id"],
    },
  });
