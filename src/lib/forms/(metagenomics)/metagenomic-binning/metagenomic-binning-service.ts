import { createServiceDefinition } from "@/lib/services/service-definition";

import {
  defaultMetagenomicBinningFormValues,
  type MetagenomicBinningFormData,
} from "./metagenomic-binning-form-schema";
import { transformMetagenomicBinningParams } from "./metagenomic-binning-form-utils";

export const metagenomicBinningService =
  createServiceDefinition<MetagenomicBinningFormData>({
    serviceName: "MetagenomeBinning",
    displayName: "Metagenomic Binning",
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
        "min_contig_len",
        "min_contig_cov",
      ],
      onApply: (rerunData, form) => {
        if (rerunData.danglen === 0) {
          form.setFieldValue("disable_dangling", true);
        }
      },
    },
  });
