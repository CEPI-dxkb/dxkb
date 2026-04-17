import { createServiceDefinition } from "@/lib/services/service-definition";

import {
  defaultMetagenomicReadMappingFormValues,
  metagenomicReadMappingFormSchema,
  type MetagenomicReadMappingFormData,
} from "./metagenomic-read-mapping-form-schema";
import { transformMetagenomicReadMappingParams } from "./metagenomic-read-mapping-form-utils";

export const metagenomicReadMappingService =
  createServiceDefinition<MetagenomicReadMappingFormData>({
    serviceName: "MetagenomicReadMapping",
    displayName: "Metagenomic Read Mapping",
    schema: metagenomicReadMappingFormSchema,
    defaultValues: defaultMetagenomicReadMappingFormValues,
    transformParams: transformMetagenomicReadMappingParams,
    rerun: {
      fields: [
        "output_path",
        "output_file",
        "gene_set_type",
        "gene_set_name",
        "gene_set_fasta",
        "gene_set_feature_group",
      ],
    },
  });
