import { z } from "zod";

// Library types for genome assembly
export const librarySchema = z.object({
  _id: z.string(),
  _type: z.enum(["paired", "single", "srr_accession"]),
  platform: z.string().optional(),
  read: z.string().optional(), // for single
  read1: z.string().optional(), // for paired
  read2: z.string().optional(), // for paired
  interleaved: z.boolean().optional(),
  read_orientation_outward: z.boolean().optional(),
});

export type LibraryItem = z.infer<typeof librarySchema>;

// Main form schema
export const genomeAssemblyFormSchema = z
  .object({
    // Libraries (required at least one)
    paired_end_libs: z.array(librarySchema).optional(),
    single_end_libs: z.array(librarySchema).optional(),
    srr_ids: z.array(z.string()).optional(),

    // Required parameters
    recipe: z.string().min(1, "Assembly strategy is required"),
    output_path: z.string().min(1, "Output folder is required"),
    output_file: z.string().min(1, "Output name is required"),

    // Optional genome size (required for canu)
    genome_size: z.number().optional(),

    // Advanced options - Read Processing
    trim: z.boolean().optional(),
    normalize: z.boolean().optional(),
    filtlong: z.boolean().optional(),

    // Advanced options - Genome Parameters
    target_depth: z.number().optional(),

    // Advanced options - Assembly Polishing
    racon_iter: z.number().min(0).max(4).optional(),
    pilon_iter: z.number().min(0).max(4).optional(),

    // Advanced options - Assembly Thresholds
    min_contig_len: z.number().min(100).max(100000).optional(),
    min_contig_cov: z.number().min(0).max(100000).optional(),
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
  )
  .refine(
    (data) => {
      // If recipe is canu, genome_size is required
      if (data.recipe === "canu") {
        return data.genome_size !== undefined && data.genome_size > 0;
      }
      return true;
    },
    {
      message: "Genome size is required when using Canu assembly strategy",
      path: ["genome_size"],
    },
  );

export type GenomeAssemblyFormData = z.infer<typeof genomeAssemblyFormSchema>;

// Default form values
export const DEFAULT_GENOME_ASSEMBLY_FORM_VALUES: GenomeAssemblyFormData = {
  paired_end_libs: [],
  single_end_libs: [],
  srr_ids: [],
  recipe: "auto",
  output_path: "",
  output_file: "",
  genome_size: 5000000,
  trim: true,
  normalize: true,
  filtlong: true,
  target_depth: 200,
  racon_iter: 2,
  pilon_iter: 2,
  min_contig_len: 300,
  min_contig_cov: 5,
};
