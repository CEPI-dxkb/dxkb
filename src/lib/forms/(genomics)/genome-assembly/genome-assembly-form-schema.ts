import { z } from "zod";
import {
  libraryWithAssemblyOptionsSchema,
  type LibraryWithAssemblyOptions,
} from "@/lib/forms/shared-schemas";

export const librarySchema = libraryWithAssemblyOptionsSchema;
export type LibraryItem = LibraryWithAssemblyOptions;

export const genomeAssemblyFormSchema = z
  .object({
    paired_end_libs: z.array(librarySchema).optional(),
    single_end_libs: z.array(librarySchema).optional(),
    srr_ids: z.array(z.string()).optional(),

    recipe: z.string().min(1, "Assembly strategy is required"),
    output_path: z.string().min(1, "Output folder is required"),
    output_file: z.string().min(1, "Output name is required"),

    genome_size: z.number().optional(),

    trim: z.boolean().optional(),
    normalize: z.boolean().optional(),
    filtlong: z.boolean().optional(),

    target_depth: z.number().optional(),

    racon_iter: z.number().min(0).max(4).optional(),
    pilon_iter: z.number().min(0).max(4).optional(),

    min_contig_len: z.number().min(100).max(100000).optional(),
    min_contig_cov: z.number().min(0).max(100000).optional(),
  })
  .refine(
    (data) => {
      const hasPaired = data.paired_end_libs && data.paired_end_libs.length > 0;
      const hasSingle = data.single_end_libs && data.single_end_libs.length > 0;
      const hasSrr = data.srr_ids && data.srr_ids.length > 0;
      return hasPaired || hasSingle || hasSrr;
    },
    {
      path: ["paired_end_libs"],
        error: "At least one library (paired, single, or SRA) must be provided"
    },
  )
  .refine(
    (data) => {
      if (data.recipe === "canu") {
        return data.genome_size !== undefined && data.genome_size > 0;
      }
      return true;
    },
    {
      path: ["genome_size"],
        error: "Genome size is required when using Canu assembly strategy"
    },
  );

export type GenomeAssemblyFormData = z.infer<typeof genomeAssemblyFormSchema>;

export const defaultGenomeAssemblyFormValues: GenomeAssemblyFormData = {
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
