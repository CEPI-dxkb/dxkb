import { createServiceDefinition } from "@/lib/services/service-definition";

import {
  defaultViralAssemblyFormValues,
  type ViralAssemblyFormData,
} from "./viral-assembly-form-schema";
import {
  transformViralAssemblyParams,
  viralAssemblyRerunValues,
} from "./viral-assembly-form-utils";

export const viralAssemblyService =
  createServiceDefinition<ViralAssemblyFormData>({
    serviceName: "ViralAssembly",
    displayName: "Viral Assembly",
    defaultValues: defaultViralAssemblyFormValues,
    transformParams: transformViralAssemblyParams,
    rerun: {
      fields: ["output_path", "output_file"],
      onApply: (data, form) => {
        const values = viralAssemblyRerunValues(data);
        if (values.strategy) form.setFieldValue("strategy", values.strategy);
        if (values.module) form.setFieldValue("module", values.module);
        if (values.reference_type)
          form.setFieldValue("reference_type", values.reference_type);
        if (values.reference_genbank_accession !== undefined)
          form.setFieldValue(
            "reference_genbank_accession",
            values.reference_genbank_accession,
          );
        if (values.reference_fasta_file !== undefined)
          form.setFieldValue("reference_fasta_file", values.reference_fasta_file);
      },
    },
  });
