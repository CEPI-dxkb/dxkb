import { createServiceDefinition } from "@/lib/services/service-definition";

import {
  defaultMetagenomicBinningFormValues,
  metagenomicBinningFormSchema,
  type MetagenomicBinningFormData,
} from "./metagenomic-binning-form-schema";
import { transformMetagenomicBinningParams } from "./metagenomic-binning-form-utils";

export const metagenomicBinningService =
  createServiceDefinition<MetagenomicBinningFormData>({
    serviceName: "MetagenomeBinning",
    displayName: "Metagenomic Binning",
    schema: metagenomicBinningFormSchema,
    defaultValues: defaultMetagenomicBinningFormValues,
    transformParams: transformMetagenomicBinningParams,
    rerun: {
      fields: [
        "output_path",
        "output_file",
        "start_with",
        "assembler",
        "organism",
        "contigs",
        "genome_group",
      ],
      libraries: ["paired", "single", "sra"],
    },
  });
