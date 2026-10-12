import { z } from "zod";
import { defaultMetadataFields } from "@/lib/forms/genome-metadata-fields";

// Sequence type enum for viral genome tree (genome groups and FASTA files)
export const viralGenomeSequenceTypeSchema = z.enum([
  "genome_group",
  "aligned_dna_fasta",
  "feature_dna_fasta",
]);

// Sequence item schema
export const viralGenomeSequenceItemSchema = z.object({
  filename: z.string().min(1, "Sequence path is required"),
  type: viralGenomeSequenceTypeSchema,
});

// Main form schema
export const viralGenomeTreeFormSchema = z
  .object({
    recipe: z.enum(["RAxML", "PhyML", "FastTree"], {
      error: "Recipe must be selected",
    }),
    substitution_model: z.string().min(1, "Substitution model is required"),
    trim_threshold: z.string().refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num >= 0 && num <= 1;
      },
      {
        error: "Trim threshold must be a number between 0 and 1",
      },
    ),
    gap_threshold: z.string().refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num >= 0 && num <= 1;
      },
      {
        error: "Gap threshold must be a number between 0 and 1",
      },
    ),
    sequences: z
      .array(viralGenomeSequenceItemSchema)
      .min(1, "At least one sequence must be selected")
      .max(5000, "Maximum of 5000 sequences allowed"),
    metadata_fields: z.array(z.string()).optional(),
    output_path: z.string().min(1, "Output folder is required"),
    output_file: z.string().min(1, "Output name is required"),
  })
  .superRefine((data, ctx) => {
    // Validate substitution model (DNA models only for genomes)
    const dnaModels = ["GTR", "TN93", "HKY85", "F84", "F81", "K80", "JC69"];

    if (!dnaModels.includes(data.substitution_model)) {
      ctx.addIssue({
        code: "custom",
        message: `Substitution model ${data.substitution_model} is not valid for genome sequences`,
        path: ["substitution_model"],
      });
    }
  });

export type ViralGenomeTreeFormData = z.infer<typeof viralGenomeTreeFormSchema>;
export type ViralGenomeSequenceItem = z.infer<
  typeof viralGenomeSequenceItemSchema
>;

// Constants
export const maxSequences = 5000;

export const dnaModels = [
  { value: "GTR", label: "GTR" },
  { value: "TN93", label: "TN93" },
  { value: "HKY85", label: "HKY85" },
  { value: "F84", label: "F84" },
  { value: "F81", label: "F81" },
  { value: "K80", label: "K80" },
  { value: "JC69", label: "JC69" },
] as const;

export const thresholdOptions = [
  "0",
  "0.1",
  "0.2",
  "0.3",
  "0.4",
  "0.5",
  "0.6",
  "0.7",
  "0.8",
  "0.9",
  "1.0",
] as const;

// Default form values
export const defaultViralGenomeTreeFormValues: ViralGenomeTreeFormData = {
  recipe: "RAxML",
  substitution_model: "GTR",
  trim_threshold: "0",
  gap_threshold: "0",
  sequences: [],
  metadata_fields: defaultMetadataFields
    .filter((f) => f.selected)
    .map((f) => f.id),
  output_path: "",
  output_file: "",
};
