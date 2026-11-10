import { z } from "zod";

import { baseLibrarySchema, type BaseLibraryItem } from "@/lib/forms/shared-schemas";

export const startWithSchema = z.enum(["reads", "contigs"]);

export const assemblyStrategySchema = z.enum(["metaspades", "megahit", "auto"]);

export const organismSchema = z.enum(["bacteria", "viral", "both"]);

export const librarySchema = baseLibrarySchema;
export type LibraryItem = BaseLibraryItem;

export const minContigLengthDefault = 300;
export const minContigLengthMin = 100;
export const minContigLengthMax = 100000;
export const minContigCoverageDefault = 5;
export const minContigCoverageMin = 0;
export const minContigCoverageMax = 100000;

export const metagenomicBinningFormSchema = z
  .object({
    start_with: startWithSchema,

    paired_end_libs: z.array(librarySchema).optional(),
    single_end_libs: z.array(librarySchema).optional(),
    srr_ids: z.array(z.string()).optional(),

    contigs: z.string().optional(),

    assembler: assemblyStrategySchema,
    organism: organismSchema,

    output_path: z.string().min(1, "Output folder is required"),
    output_file: z.string().min(1, "Output name is required"),
    genome_group: z.string().optional(),

    min_contig_len: z.number().min(minContigLengthMin).max(minContigLengthMax),
    min_contig_cov: z.number().min(minContigCoverageMin).max(minContigCoverageMax),
    disable_dangling: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.start_with === "reads") {
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
    }

    if (data.start_with === "contigs") {
      if (!data.contigs || data.contigs.trim() === "") {
        ctx.addIssue({
          code: "custom",
          message: "Contigs file is required",
          path: ["contigs"],
        });
      }
    }
  });

export type MetagenomicBinningFormData = z.infer<typeof metagenomicBinningFormSchema>;

export const defaultMetagenomicBinningFormValues: MetagenomicBinningFormData = {
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
  min_contig_len: minContigLengthDefault,
  min_contig_cov: minContigCoverageDefault,
  disable_dangling: false,
};
