import { createServiceDefinition } from "@/lib/services/service-definition";

import {
  defaultMetaCatsFormValues,
  metaCatsFormSchema,
  type MetaCatsFormData,
} from "./meta-cats-form-schema";
import { transformMetaCatsParams } from "./meta-cats-form-utils";

export const metaCatsService = createServiceDefinition<MetaCatsFormData>({
  serviceName: "MetaCATS",
  displayName: "Meta-CATS",
  schema: metaCatsFormSchema,
  defaultValues: defaultMetaCatsFormValues,
  transformParams: transformMetaCatsParams,
  rerun: {
    fields: [
      "output_path",
      "output_file",
      "input_type",
      "metadata_group",
      "auto_alphabet",
      "group_alphabet",
      "alignment_type",
    ],
  },
});
