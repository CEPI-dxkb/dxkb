import { z } from "zod";
import {
  baseLibrarySchema,
  type BaseLibraryItem,
} from "../../shared-schemas";

// Gene set type options
export const geneSetTypeSchema = z.enum(["predefined_list", "fasta_file", "feature_group"]);

// Predefined gene set name options
export const predefinedGeneSetNameSchema = z.enum(["CARD", "VFDB"]);

// Re-export shared library schema and type for use in this service
export const librarySchema = baseLibrarySchema;
export type LibraryItem = BaseLibraryItem;

// Main form schema
export const metagenomicReadMappingFormSchema = z
  .object({
    // Read libraries
    paired_end_libs: z.array(librarySchema).optional(),
    single_end_libs: z.array(librarySchema).optional(),
    srr_ids: z.array(z.string()).optional(),

    // Gene set configuration
    gene_set_type: geneSetTypeSchema,
    gene_set_name: predefinedGeneSetNameSchema.optional(),
    gene_set_fasta: z.string().optional(),
    gene_set_feature_group: z.string().optional(),

    // Output configuration
    output_path: z.string().min(1, "Output folder is required"),
    output_file: z.string().min(1, "Output name is required"),
  })
  .superRefine((data, ctx) => {
    // Validate that at least one library is provided
    const hasPaired = data.paired_end_libs && data.paired_end_libs.length > 0;
    const hasSingle = data.single_end_libs && data.single_end_libs.length > 0;
    const hasSrr = data.srr_ids && data.srr_ids.length > 0;

    if (!hasPaired && !hasSingle && !hasSrr) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one library (paired, single, or SRA) must be provided",
        path: ["paired_end_libs"],
      });
    }

    // Validate gene set based on type selection
    if (data.gene_set_type === "predefined_list") {
      if (!data.gene_set_name) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Gene Set Name is required",
          path: ["gene_set_name"],
        });
      }
    }

    if (data.gene_set_type === "fasta_file") {
      if (!data.gene_set_fasta || data.gene_set_fasta.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Gene Set FASTA file is required",
          path: ["gene_set_fasta"],
        });
      }
    }

    if (data.gene_set_type === "feature_group") {
      if (!data.gene_set_feature_group || data.gene_set_feature_group.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Gene Set Feature Group is required",
          path: ["gene_set_feature_group"],
        });
      }
    }
  });

export type MetagenomicReadMappingFormData = z.infer<typeof metagenomicReadMappingFormSchema>;

// Predefined gene set options for UI
export const predefinedGeneSetOptions = [
  { value: "CARD", label: "CARD" },
  { value: "VFDB", label: "VFDB" },
] as const;

// Default form values
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
