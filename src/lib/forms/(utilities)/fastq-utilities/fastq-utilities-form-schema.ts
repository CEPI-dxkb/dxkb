import { z } from "zod";
import {
  libraryWithPlatformSchema,
  type LibraryWithPlatform,
  platformSchema,
  type Platform,
  PLATFORM_OPTIONS,
} from "../../shared-schemas";

// Pipeline action options
export const pipelineActionSchema = z.enum([
  "trim",
  "paired_filter",
  "fastqc",
  "align",
  "scrub_human",
]);
export type PipelineAction = z.infer<typeof pipelineActionSchema>;

// Re-export platform types from shared schemas
export { platformSchema, type Platform, PLATFORM_OPTIONS };

// Re-export shared library schema and type for use in this service
export const librarySchema = libraryWithPlatformSchema;
export type LibraryItem = LibraryWithPlatform;

// Pipeline action item with visual properties
export const pipelineActionItemSchema = z.object({
  id: z.string(),
  action: pipelineActionSchema,
  label: z.string(),
  color: z.string().optional(),
});

export type PipelineActionItem = z.infer<typeof pipelineActionItemSchema>;

// Main form schema
export const fastqUtilitiesFormSchema = z
  .object({
    // Read libraries
    paired_end_libs: z.array(librarySchema).optional(),
    single_end_libs: z.array(librarySchema).optional(),
    srr_ids: z.array(z.string()).optional(),

    // Pipeline actions (recipe)
    recipe: z.array(pipelineActionSchema).min(1, "At least one pipeline action is required"),

    // Target genome (required only when "align" is in recipe)
    reference_genome_id: z.string().optional(),

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

    // Validate that reference_genome_id is provided when align is selected
    const hasAlign = data.recipe.includes("align");
    if (hasAlign && (!data.reference_genome_id || data.reference_genome_id.trim() === "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Target Genome is required when Align action is selected",
        path: ["reference_genome_id"],
      });
    }
  });

export type FastqUtilitiesFormData = z.infer<typeof fastqUtilitiesFormSchema>;

// Pipeline action options for UI
export const PIPELINE_ACTION_OPTIONS = [
  { value: "trim", label: "Trim" },
  { value: "paired_filter", label: "Paired Filter" },
  { value: "fastqc", label: "FastQC" },
  { value: "align", label: "Align" },
  { value: "scrub_human", label: "Scrub Human" },
] as const;

// Maximum number of pipeline actions allowed
export const MAX_PIPELINE_ACTIONS = 5;

// Default form values
export const DEFAULT_FASTQ_UTILITIES_FORM_VALUES: FastqUtilitiesFormData = {
  paired_end_libs: [],
  single_end_libs: [],
  srr_ids: [],
  recipe: [],
  reference_genome_id: "",
  output_path: "",
  output_file: "",
};
