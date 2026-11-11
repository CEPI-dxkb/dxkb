import { z } from "zod";

import {
  libraryWithPlatformSchema,
  type LibraryWithPlatform,
  platformSchema,
  type Platform,
  platformOptions,
} from "@/lib/forms/shared-schemas";

export const pipelineActionSchema = z.enum([
  "trim",
  "paired_filter",
  "fastqc",
  "align",
  "scrub_human",
]);
export type PipelineAction = z.infer<typeof pipelineActionSchema>;

export { platformSchema, type Platform, platformOptions };

export const librarySchema = libraryWithPlatformSchema;
export type LibraryItem = LibraryWithPlatform;

export const pipelineActionItemSchema = z.object({
  id: z.string(),
  action: pipelineActionSchema,
  label: z.string(),
  color: z.string().optional(),
});

export type PipelineActionItem = z.infer<typeof pipelineActionItemSchema>;

export const fastqUtilitiesFormSchema = z
  .object({
    paired_end_libs: z.array(librarySchema).optional(),
    single_end_libs: z.array(librarySchema).optional(),
    srr_ids: z.array(z.string()).optional(),

    recipe: z.array(pipelineActionSchema).min(1, "At least one pipeline action is required"),

    reference_genome_id: z.string().optional(),

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

    const hasAlign = data.recipe.includes("align");
    if (hasAlign && (!data.reference_genome_id || data.reference_genome_id.trim() === "")) {
      ctx.addIssue({
        code: "custom",
        message: "Target Genome is required when Align action is selected",
        path: ["reference_genome_id"],
      });
    }
  });

export type FastqUtilitiesFormData = z.infer<typeof fastqUtilitiesFormSchema>;

export const pipelineActionOptions = [
  { value: "trim", label: "Trim" },
  { value: "paired_filter", label: "Paired Filter" },
  { value: "fastqc", label: "FastQC" },
  { value: "align", label: "Align" },
  { value: "scrub_human", label: "Scrub Human" },
] as const;

export const maxPipelineActions = 5;

export const defaultFastqUtilitiesFormValues: FastqUtilitiesFormData = {
  paired_end_libs: [],
  single_end_libs: [],
  srr_ids: [],
  recipe: [],
  reference_genome_id: "",
  output_path: "",
  output_file: "",
};
