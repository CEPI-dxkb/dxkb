import { z } from "zod";

const outputNameInvalidChars = /[\\/]/;

export const variationLibrarySchema = z.object({
  _id: z.string(),
  _type: z.enum(["paired", "single", "srr_accession"]),
  read: z.string().optional(),
  read1: z.string().optional(),
  read2: z.string().optional(),
});

export type VariationLibraryItem = z.infer<typeof variationLibrarySchema>;

export const variationAnalysisFormSchema = z
  .object({
    paired_end_libs: z.array(variationLibrarySchema).optional(),
    single_end_libs: z.array(variationLibrarySchema).optional(),
    srr_ids: z.array(z.string()).optional(),

    reference_genome_id: z.string().min(1, "Target genome is required"),
    mapper: z.enum(["BWA-mem", "BWA-mem-strict", "Bowtie2", "LAST", "minimap2"], {
      error: "Aligner must be selected",
    }),
    caller: z.enum(["FreeBayes", "BCFtools"], {
      error: "SNP caller must be selected",
    }),
    output_path: z.string().min(1, "Output folder is required"),
    output_file: z
      .string()
      .min(1, "Output name is required")
      .refine((value) => !outputNameInvalidChars.test(value), {
          error: "Output name cannot contain slashes"
    }),
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
  );

export type VariationAnalysisFormData = z.infer<typeof variationAnalysisFormSchema>;

export const defaultVariationAnalysisFormValues: VariationAnalysisFormData = {
  paired_end_libs: [],
  single_end_libs: [],
  srr_ids: [],
  reference_genome_id: "",
  mapper: "BWA-mem",
  caller: "FreeBayes",
  output_path: "",
  output_file: "",
};

