import { z } from "zod";

const outputNameInvalidChars = /[\\/]/;

export const maxHitsOptions = [
  { value: 1, label: "1" },
  { value: 10, label: "10" },
  { value: 50, label: "50" },
  { value: 100, label: "100" },
  { value: 500, label: "500" },
] as const;

export const pValueOptions = [
  { value: 0.001, label: "0.001" },
  { value: 0.01, label: "0.01" },
  { value: 0.1, label: "0.1" },
  { value: 1, label: "1" },
] as const;

export const distanceOptions = [
  { value: 0.01, label: "0.01" },
  { value: 0.05, label: "0.05" },
  { value: 0.1, label: "0.1" },
  { value: 0.5, label: "0.5" },
  { value: 1, label: "1" },
] as const;

export const similarGenomeFinderFormSchema = z
  .object({
    selectedGenomeId: z.string(),
    fasta_file: z.string(),

    // Output (always provided by form as "" when not filled in)
    output_path: z.string(),
    output_file: z
      .string()
      .refine((value) => !value || !outputNameInvalidChars.test(value), {
          error: "Output name cannot contain slashes"
    }),

    max_pvalue: z.number().refine(
      (val) => [0.001, 0.01, 0.1, 1].includes(val),
      {
          error: "P-value must be one of: 0.001, 0.01, 0.1, 1"
    },
    ),
    max_distance: z.number().refine(
      (val) => [0.01, 0.05, 0.1, 0.5, 1].includes(val),
      {
          error: "Distance must be one of: 0.01, 0.05, 0.1, 0.5, 1"
    },
    ),
    max_hits: z.number().refine(
      (val) => [1, 10, 50, 100, 500].includes(val),
      {
          error: "Max hits must be one of: 1, 10, 50, 100, 500"
    },
    ),

    include_bacterial: z.boolean(),
    include_viral: z.boolean(),

    scope: z.enum(["reference", "all"]),
  })
  .superRefine((data, ctx) => {
    const hasGenomeId = data.selectedGenomeId.trim().length > 0;
    const hasFastaFile = data.fasta_file.trim().length > 0;

    if (!hasGenomeId && !hasFastaFile) {
      ctx.addIssue({
        code: "custom",
        message: "Please provide either a genome ID/name or a FASTA file",
        path: ["selectedGenomeId"],
      });
    }

    if (!data.include_bacterial && !data.include_viral) {
      ctx.addIssue({
        code: "custom",
        message: "Please select at least one organism type",
        path: ["include_bacterial"],
      });
    }
  });

export const defaultSimilarGenomeFinderFormValues = {
  selectedGenomeId: "",
  fasta_file: "",
  output_path: "",
  output_file: "",
  max_pvalue: 1,
  max_distance: 1,
  max_hits: 50,
  include_bacterial: true as boolean,
  include_viral: true as boolean,
  scope: "reference" as "reference" | "all",
} satisfies Partial<z.infer<typeof similarGenomeFinderFormSchema>>;

export type SimilarGenomeFinderFormData = z.infer<
  typeof similarGenomeFinderFormSchema
>;

