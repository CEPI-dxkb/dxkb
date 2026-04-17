import { createServiceDefinition } from "@/lib/services/service-definition";

import {
  completeFormSchema,
  defaultBlastFormValues,
  type BlastFormData,
} from "./blast-form-schema";
import { transformBlastParams } from "./blast-form-utils";

export const blastService = createServiceDefinition<BlastFormData>({
  serviceName: "Homology",
  displayName: "BLAST",
  schema: completeFormSchema,
  defaultValues: defaultBlastFormValues,
  transformParams: transformBlastParams,
  rerun: {
    fields: [
      "input_source",
      "input_fasta_data",
      "input_fasta_file",
      "input_feature_group",
      "db_type",
      "db_genome_group",
      "db_feature_group",
      "db_taxon_list",
      "db_genome_list",
      "db_fasta_file",
      "output_path",
      "output_file",
    ],
  },
});
