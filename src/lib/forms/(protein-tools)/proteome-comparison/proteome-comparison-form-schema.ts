import { z } from "zod";

import { countTotalComparisonGenomes } from "./proteome-comparison-form-utils";

// Constants
export const maxComparisonGenomes = 9;
export const minComparisonGenomes = 1;

// Reference source types
export const referenceSourceTypes = [
  "genome",
  "fasta",
  "feature_group",
] as const;
export type ReferenceSourceType = (typeof referenceSourceTypes)[number];

// Comparison item types
export const comparisonItemTypes = [
  "genome",
  "fasta",
  "feature_group",
  "genome_group",
] as const;
export type ComparisonItemType = (typeof comparisonItemTypes)[number];

// Comparison item schema for grid items
export const comparisonItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string().optional(), // For workspace objects
  genome_id: z.string().optional(), // For genomes
  type: z.enum(comparisonItemTypes),
  genome_ids: z.array(z.string()).optional(), // For genome groups (stores the IDs)
});

export type ComparisonItem = z.infer<typeof comparisonItemSchema>;

// Main form schema
export const proteomeComparisonFormSchema = z
  .object({
    // Reference genome fields
    ref_source_type: z.enum(referenceSourceTypes),
    ref_genome_id: z.string().optional(),
    ref_genome_name: z.string().optional(), // Display name for the genome
    ref_fasta_file: z.string().optional(),
    ref_feature_group: z.string().optional(),

    // Comparison genomes (array of items)
    comparison_items: z.array(comparisonItemSchema),

    // Advanced parameters
    min_seq_cov: z.number().min(10).max(100),
    max_e_val: z.string(),
    min_ident: z.number().min(10).max(100),

    // Output
    output_path: z.string().min(1, "Output folder is required"),
    output_file: z.string().min(1, "Output name is required"),
  })
  .superRefine((data, ctx) => {
    // Validate reference genome based on source type
    if (data.ref_source_type === "genome") {
      if (!data.ref_genome_id || data.ref_genome_id.trim() === "") {
        ctx.addIssue({
          code: "custom",
          message: "Please select a reference genome",
          path: ["ref_genome_id"],
        });
      }
    } else if (data.ref_source_type === "fasta") {
      if (!data.ref_fasta_file || data.ref_fasta_file.trim() === "") {
        ctx.addIssue({
          code: "custom",
          message: "Please select a protein FASTA file",
          path: ["ref_fasta_file"],
        });
      }
    } else {
      // data.ref_source_type === "feature_group"
      if (!data.ref_feature_group || data.ref_feature_group.trim() === "") {
        ctx.addIssue({
          code: "custom",
          message: "Please select a feature group",
          path: ["ref_feature_group"],
        });
      }
    }

    // Validate that at least 1 comparison item is added (legacy requires at least 2 total)
    if (data.comparison_items.length < 1) {
      ctx.addIssue({
        code: "custom",
        message: `At least ${String(minComparisonGenomes)} comparison genome must be added`,
        path: ["comparison_items"],
      });
    }

    // Validate max comparison genomes; a genome group counts each of its genomes
    if (
      countTotalComparisonGenomes(data.comparison_items) > maxComparisonGenomes
    ) {
      ctx.addIssue({
        code: "custom",
        message: `Maximum ${String(maxComparisonGenomes)} comparison genomes allowed`,
        path: ["comparison_items"],
      });
    }

    // Validate E-value format
    const evalPattern = /^[0-9]+(\.[0-9]+)?(e-?[0-9]+)?$/i;
    if (data.max_e_val && !evalPattern.test(data.max_e_val.trim())) {
      ctx.addIssue({
        code: "custom",
        message: "Invalid E-value format (e.g., 1e-5, 0.001)",
        path: ["max_e_val"],
      });
    }
  });

export type ProteomeComparisonFormData = z.infer<
  typeof proteomeComparisonFormSchema
>;

// Default form values
export const defaultProteomeComparisonFormValues: ProteomeComparisonFormData = {
  // Reference genome defaults
  ref_source_type: "genome",
  ref_genome_id: "",
  ref_genome_name: "",
  ref_fasta_file: "",
  ref_feature_group: "",

  // Comparison genomes
  comparison_items: [],

  // Advanced parameters (matching legacy defaults)
  min_seq_cov: 30,
  max_e_val: "1e-5",
  min_ident: 10,

  // Output
  output_path: "",
  output_file: "",
};
