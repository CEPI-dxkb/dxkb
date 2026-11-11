import { z } from "zod";

import { baseLibrarySchema, type BaseLibraryItem } from "@/lib/forms/shared-schemas";

export const geneSetTypeSchema = z.enum(["predefined_list", "fasta_file", "feature_group"]);

export const predefinedGeneSetNameSchema = z.enum(["CARD", "VFDB"]);

export const librarySchema = baseLibrarySchema;
export type LibraryItem = BaseLibraryItem;

export const metagenomicReadMappingFormSchema = z
  .object({
    paired_end_libs: z.array(librarySchema).optional(),
    single_end_libs: z.array(librarySchema).optional(),
    srr_ids: z.array(z.string()).optional(),

    gene_set_type: geneSetTypeSchema,
    gene_set_name: predefinedGeneSetNameSchema.optional(),
    gene_set_fasta: z.string().optional(),
    gene_set_feature_group: z.string().optional(),

    output_path: z.string().min(1, "Output folder is required"),
    output_file: z.string().min(1, "Output name is required"),
  })
  .superRefine((data, ctx) => {
    const hasPaired = data.paired_end_libs && data.paired_end_libs.length > 0;
    const hasSingle = data.single_end_libs && data.single_end_libs.length > 0;
    const hasSrr = data.srr_ids && data.srr_ids.length > 0;

    if (!hasPaired && !hasSingle && !hasSrr) {
      ctx.addIssue({
        code: "custom",
        message: "At least one library (paired, single, or SRA) must be provided",
        path: ["paired_end_libs"],
      });
    }

    if (data.gene_set_type === "predefined_list") {
      if (!data.gene_set_name) {
        ctx.addIssue({
          code: "custom",
          message: "Gene Set Name is required",
          path: ["gene_set_name"],
        });
      }
    }

    if (data.gene_set_type === "fasta_file") {
      if (!data.gene_set_fasta || data.gene_set_fasta.trim() === "") {
        ctx.addIssue({
          code: "custom",
          message: "Gene Set FASTA file is required",
          path: ["gene_set_fasta"],
        });
      }
    }

    if (data.gene_set_type === "feature_group") {
      if (!data.gene_set_feature_group || data.gene_set_feature_group.trim() === "") {
        ctx.addIssue({
          code: "custom",
          message: "Gene Set Feature Group is required",
          path: ["gene_set_feature_group"],
        });
      }
    }
  });

export type MetagenomicReadMappingFormData = z.infer<typeof metagenomicReadMappingFormSchema>;

export const predefinedGeneSetOptions = [
  { value: "CARD", label: "CARD" },
  { value: "VFDB", label: "VFDB" },
] as const;

export const defaultMetagenomicReadMappingFormValues: MetagenomicReadMappingFormData = {
  paired_end_libs: [],
  single_end_libs: [],
  srr_ids: [],
  gene_set_type: "predefined_list",
  gene_set_name: "CARD",
  gene_set_fasta: "",
  gene_set_feature_group: "",
  output_path: "",
  output_file: "",
};
