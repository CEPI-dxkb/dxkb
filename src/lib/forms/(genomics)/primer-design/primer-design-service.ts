import { createServiceDefinition } from "@/lib/services/service-definition";

import {
  defaultPrimerDesignFormValues,
  primerDesignFormSchema,
  type PrimerDesignFormData,
} from "./primer-design-form-schema";
import { transformPrimerDesignParams } from "./primer-design-form-utils";

export const primerDesignService =
  createServiceDefinition<PrimerDesignFormData>({
    serviceName: "PrimerDesign",
    displayName: "Primer Design",
    schema: primerDesignFormSchema,
    defaultValues: defaultPrimerDesignFormValues,
    transformParams: transformPrimerDesignParams,
    rerun: {
      fields: ["output_path", "output_file"],
    },
  });
