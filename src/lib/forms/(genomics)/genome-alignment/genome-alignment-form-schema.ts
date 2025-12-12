import { z } from "zod";

export const genomeAlignmentFormSchema = z
  .object({
    genome_ids: z
      .array(z.string().min(1, "Genome ID is required"))
      .min(2, "Select at least two genomes")
      .max(20, "You can add up to 20 genomes"),
    output_path: z.string().min(1, "Output folder is required"),
    output_file: z.string().min(1, "Output name is required"),
    manual_seed_weight: z.boolean(),
    seed_weight: z
      .number({
        invalid_type_error: "Seed weight must be a number",
      })
      .min(3, "Seed weight must be at least 3")
      .max(21, "Seed weight must be at most 21")
      .optional(),
    weight: z
      .number({
        invalid_type_error: "Weight must be a number",
      })
      .min(0, "Weight must be non-negative")
      .optional(),
    recipe: z.literal("progressiveMauve"),
    genome_group_path: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const uniqueIds = new Set(data.genome_ids);
    if (uniqueIds.size !== data.genome_ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate genomes are not allowed",
        path: ["genome_ids"],
      });
    }

    if (data.manual_seed_weight && (data.seed_weight === undefined || data.seed_weight === null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Seed weight is required when manual mode is enabled",
        path: ["seed_weight"],
      });
    }
  });

export type GenomeAlignmentFormData = z.infer<typeof genomeAlignmentFormSchema>;

export const DEFAULT_GENOME_ALIGNMENT_FORM_VALUES: GenomeAlignmentFormData = {
  genome_ids: [],
  output_path: "",
  output_file: "",
  manual_seed_weight: false,
  seed_weight: 15,
  weight: undefined,
  recipe: "progressiveMauve",
  genome_group_path: undefined,
};

