import { createServiceDefinition } from "@/lib/services/service-definition";

import {
  defaultSubspeciesClassificationFormValues,
  type SubspeciesClassificationFormData,
} from "./subspecies-classification-form-schema";
import { transformSubspeciesClassificationParams } from "./subspecies-classification-form-utils";

export const subspeciesClassificationService =
  createServiceDefinition<SubspeciesClassificationFormData>({
    serviceName: "SubspeciesClassification",
    displayName: "Subspecies Classification",
    defaultValues: defaultSubspeciesClassificationFormValues,
    transformParams: transformSubspeciesClassificationParams,
    rerun: {
      fields: [
        "input_source",
        "input_fasta_data",
        "input_fasta_file",
        "virus_type",
        "output_path",
        "output_file",
      ],
    },
  });
