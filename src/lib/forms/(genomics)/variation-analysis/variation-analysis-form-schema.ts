import { z } from "zod";

const OUTPUT_NAME_INVALID_CHARS = /[\\/]/;

// Library types for variation analysis (same as genome assembly)
export const variationLibrarySchema = z.object({
  _id: z.string(),
  _type: z.enum(["paired", "single", "srr_accession"]),
  read: z.string().optional(), // for single
  read1: z.string().optional(), // for paired
  read2: z.string().optional(), // for paired
});

export type VariationLibraryItem = z.infer<typeof variationLibrarySchema>;

// Main form schema
export const variationAnalysisFormSchema = z
  .object({
    // Libraries (required at least one)
    paired_end_libs: z.array(variationLibrarySchema).optional(),
    single_end_libs: z.array(variationLibrarySchema).optional(),
    srr_ids: z.array(z.string()).optional(),

    // Required parameters
    reference_genome_id: z.string().min(1, "Target genome is required"),
    mapper: z.enum(["BWA-mem", "BWA-mem-strict", "Bowtie2", "LAST", "minimap2"], {
      required_error: "Aligner must be selected",
    }),
    caller: z.enum(["FreeBayes", "BCFtools"], {
      required_error: "SNP caller must be selected",
    }),
    output_path: z.string().min(1, "Output folder is required"),
    output_file: z
      .string()
      .min(1, "Output name is required")
      .refine((value) => !OUTPUT_NAME_INVALID_CHARS.test(value), {
        message: "Output name cannot contain slashes",
      }),
  })
  .refine(
    (data) => {
      // At least one library source must be provided
      const hasPaired = data.paired_end_libs && data.paired_end_libs.length > 0;
      const hasSingle = data.single_end_libs && data.single_end_libs.length > 0;
      const hasSrr = data.srr_ids && data.srr_ids.length > 0;
      return hasPaired || hasSingle || hasSrr;
    },
    {
      message: "At least one library (paired, single, or SRA) must be provided",
      path: ["paired_end_libs"],
    },
  );

export type VariationAnalysisFormData = z.infer<typeof variationAnalysisFormSchema>;

// Default form values
export const DEFAULT_VARIATION_ANALYSIS_FORM_VALUES: VariationAnalysisFormData = {
  paired_end_libs: [],
  single_end_libs: [],
  srr_ids: [],
  reference_genome_id: "",
  mapper: "BWA-mem",
  caller: "FreeBayes",
  output_path: "",
  output_file: "",
};

