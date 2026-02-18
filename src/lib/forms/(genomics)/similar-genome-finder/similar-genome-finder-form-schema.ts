import { z } from "zod";

const OUTPUT_NAME_INVALID_CHARS = /[\\/]/;

/** Options for Max hits dropdown */
export const maxHitsOptions = [
  { value: 1, label: "1" },
  { value: 10, label: "10" },
  { value: 50, label: "50" },
  { value: 100, label: "100" },
  { value: 500, label: "500" },
] as const;

/** Options for P-value threshold dropdown */
export const pValueOptions = [
  { value: 0.001, label: "0.001" },
  { value: 0.01, label: "0.01" },
  { value: 0.1, label: "0.1" },
  { value: 1, label: "1" },
] as const;

/** Options for Distance dropdown */
export const distanceOptions = [
  { value: 0.01, label: "0.01" },
  { value: 0.05, label: "0.05" },
  { value: 0.1, label: "0.1" },
  { value: 0.5, label: "0.5" },
  { value: 1, label: "1" },
] as const;

export const similarGenomeFinderFormSchema = z
  .object({
    // Input - either genome_id OR fasta_file (at least one required)
    selectedGenomeId: z.string(),
    fasta_file: z.string(),

    // Output (optional - removed from UI but kept in schema for backend)
    output_path: z.string().optional(),
    output_file: z
      .string()
      .refine((value) => !value || !OUTPUT_NAME_INVALID_CHARS.test(value), {
        message: "Output name cannot contain slashes",
      })
      .optional(),

    // Parameters
    max_pvalue: z.number().refine(
      (val) => [0.001, 0.01, 0.1, 1].includes(val),
      {
        message: "P-value must be one of: 0.001, 0.01, 0.1, 1",
      },
    ),
    max_distance: z.number().refine(
      (val) => [0.01, 0.05, 0.1, 0.5, 1].includes(val),
      {
        message: "Distance must be one of: 0.01, 0.05, 0.1, 0.5, 1",
      },
    ),
    max_hits: z.number().refine(
      (val) => [1, 10, 50, 100, 500].includes(val),
      {
        message: "Max hits must be one of: 1, 10, 50, 100, 500",
      },
    ),

    // Organism type
    include_bacterial: z.boolean(),
    include_viral: z.boolean(),

    // Scope
    scope: z.enum(["reference", "all"]),
  })
  .superRefine((data, ctx) => {
    // Validate that at least one input is provided
    const hasGenomeId = data.selectedGenomeId.trim().length > 0;
    const hasFastaFile = data.fasta_file.trim().length > 0;

    if (!hasGenomeId && !hasFastaFile) {
      // Only add error to selectedGenomeId field
      // The error will clear automatically when fasta_file gets a value
      // because the validation condition will no longer be true
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please provide either a genome ID/name or a FASTA file",
        path: ["selectedGenomeId"],
      });
    }

    // Validate that at least one organism type is selected
    if (!data.include_bacterial && !data.include_viral) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please select at least one organism type",
        path: ["include_bacterial"],
      });
    }
  });

export const DEFAULT_SIMILAR_GENOME_FINDER_FORM_VALUES = {
  selectedGenomeId: "",
  fasta_file: "",
  output_path: "",
  output_file: "",
  max_pvalue: 1,
  max_distance: 1,
  max_hits: 50,
  include_bacterial: true,
  include_viral: true,
  scope: "reference" as const,
} satisfies Partial<z.infer<typeof similarGenomeFinderFormSchema>>;

export type SimilarGenomeFinderFormData = z.infer<
  typeof similarGenomeFinderFormSchema
>;

