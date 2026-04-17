import { createServiceDefinition } from "@/lib/services/service-definition";

import {
  defaultGeneProteinTreeFormValues,
  geneProteinTreeFormSchema,
  type GeneProteinTreeFormData,
} from "./gene-protein-tree-form-schema";
import { transformGeneProteinTreeParams } from "./gene-protein-tree-form-utils";

export const geneProteinTreeService =
  createServiceDefinition<GeneProteinTreeFormData>({
    serviceName: "GeneTree",
    displayName: "Gene/Protein Tree",
    schema: geneProteinTreeFormSchema,
    defaultValues: defaultGeneProteinTreeFormValues,
    transformParams: transformGeneProteinTreeParams,
    rerun: {
      fields: [
        "recipe",
        "substitution_model",
        "output_path",
        "output_file",
      ],
    },
  });
