import { normalizeToArray } from "@/lib/rerun-utility";
import { createServiceDefinition } from "@/lib/services/service-definition";

import {
  defaultInfluenzaHaSubtypeFormValues,
  influenzaHaSubtypeFormSchema,
  type InfluenzaHaSubtypeFormData,
} from "./influenza-ha-subtype-form-schema";
import { transformHaSubtypeParams } from "./influenza-ha-subtype-form-utils";

export const influenzaHaSubtypeService =
  createServiceDefinition<InfluenzaHaSubtypeFormData>({
    serviceName: "HASubtypeNumberingConversion",
    displayName: "HA Subtype Numbering Conversion",
    schema: influenzaHaSubtypeFormSchema,
    defaultValues: defaultInfluenzaHaSubtypeFormValues,
    transformParams: transformHaSubtypeParams,
    rerun: {
      fields: [
        "input_source",
        "input_fasta_data",
        "input_fasta_file",
        "input_feature_group",
        "output_path",
        "output_file",
      ],
      onApply: (rerunData, form) => {
        if (rerunData.types != null) {
          form.setFieldValue("types", normalizeToArray(rerunData.types) as never);
        }
      },
    },
  });
