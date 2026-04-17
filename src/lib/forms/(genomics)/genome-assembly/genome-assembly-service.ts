import { createServiceDefinition } from "@/lib/services/service-definition";

import {
  defaultGenomeAssemblyFormValues,
  genomeAssemblyFormSchema,
  type GenomeAssemblyFormData,
} from "./genome-assembly-form-schema";
import { transformGenomeAssemblyParams } from "./genome-assembly-form-utils";

export const genomeAssemblyService =
  createServiceDefinition<GenomeAssemblyFormData>({
    serviceName: "GenomeAssembly2",
    displayName: "Genome Assembly",
    schema: genomeAssemblyFormSchema,
    defaultValues: defaultGenomeAssemblyFormValues,
    transformParams: transformGenomeAssemblyParams,
    rerun: {
      fields: ["output_path", "output_file", "recipe"],
      libraries: ["paired", "single", "sra"],
      getLibraryExtra: (lib, kind) => {
        if (kind === "paired") {
          return {
            platform: lib.platform || "infer",
            interleaved: !!lib.interleaved,
            read_orientation_outward: !!lib.read_orientation_outward,
          };
        }
        if (kind === "single") {
          return { platform: lib.platform || "infer" };
        }
        return {};
      },
    },
  });
