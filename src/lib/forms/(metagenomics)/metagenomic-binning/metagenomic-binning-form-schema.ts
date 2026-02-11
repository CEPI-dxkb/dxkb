import { z } from "zod";
import {
  baseLibrarySchema,
  type BaseLibraryItem,
} from "../../shared-schemas";

// Start with options
export const startWithSchema = z.enum(["reads", "contigs"]);

// Assembly strategy options (only for reads)
export const assemblyStrategySchema = z.enum(["metaspades", "megahit", "auto"]);

// Organisms of interest options
export const organismSchema = z.enum(["bacteria", "viral", "both"]);

// Re-export shared library schema and type for use in this service
export const librarySchema = baseLibrarySchema;
export type LibraryItem = BaseLibraryItem;

// Constants
export const MIN_CONTIG_LENGTH_DEFAULT = 300;
export const MIN_CONTIG_LENGTH_MIN = 100;
export const MIN_CONTIG_LENGTH_MAX = 100000;
export const MIN_CONTIG_COVERAGE_DEFAULT = 5;
export const MIN_CONTIG_COVERAGE_MIN = 0;
export const MIN_CONTIG_COVERAGE_MAX = 100000;

// Main form schema
export const metagenomicBinningFormSchema = z
  .object({
    // Start with selection
    start_with: startWithSchema,

    // Read libraries (when start_with is "reads")
    paired_end_libs: z.array(librarySchema).optional(),
    single_end_libs: z.array(librarySchema).optional(),
    srr_ids: z.array(z.string()).optional(),

    // Contigs file (when start_with is "contigs")
    contigs: z.string().optional(),

    // Parameters
    assembler: assemblyStrategySchema,
    organism: organismSchema,

    // Output configuration
    output_path: z.string().min(1, "Output folder is required"),
    output_file: z.string().min(1, "Output name is required"),
    genome_group: z.string().optional(),

    // Advanced parameters
    min_contig_len: z.number().min(MIN_CONTIG_LENGTH_MIN).max(MIN_CONTIG_LENGTH_MAX),
    min_contig_cov: z.number().min(MIN_CONTIG_COVERAGE_MIN).max(MIN_CONTIG_COVERAGE_MAX),
    disable_dangling: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    // Validate based on start_with selection
    if (data.start_with === "reads") {
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
    }

    if (data.start_with === "contigs") {
      if (!data.contigs || data.contigs.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Contigs file is required",
          path: ["contigs"],
        });
      }
    }
  });

export type MetagenomicBinningFormData = z.infer<typeof metagenomicBinningFormSchema>;

// Default form values
export const DEFAULT_METAGENOMIC_BINNING_FORM_VALUES: MetagenomicBinningFormData = {
  start_with: "reads",
  paired_end_libs: [],
  single_end_libs: [],
  srr_ids: [],
  contigs: "",
  assembler: "auto",
  organism: "both",
  output_path: "",
  output_file: "",
  genome_group: "",
  min_contig_len: MIN_CONTIG_LENGTH_DEFAULT,
  min_contig_cov: MIN_CONTIG_COVERAGE_DEFAULT,
  disable_dangling: false,
};
