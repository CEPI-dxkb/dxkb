import { z } from "zod";
import { defaultMetadataFields } from "@/lib/forms/genome-metadata-fields";

// Sequence type enum
export const sequenceTypeSchema = z.enum([
  "feature_group",
  "aligned_dna_fasta",
  "aligned_protein_fasta",
  "feature_dna_fasta",
  "feature_protein_fasta",
]);

// Sequence item schema
export const sequenceItemSchema = z.object({
  filename: z.string().min(1, "Sequence path is required"),
  type: sequenceTypeSchema,
});

// Main form schema
export const geneProteinTreeFormSchema = z
  .object({
    alphabet: z.enum(["DNA", "Protein"], {
      error: "Alphabet must be selected",
    }),
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
      .array(sequenceItemSchema)
      .min(1, "At least one sequence must be selected")
      .max(5000, "Maximum of 5000 sequences allowed"),
    metadata_fields: z.array(z.string()).optional(),
    output_path: z.string().min(1, "Output folder is required"),
    output_file: z.string().min(1, "Output name is required"),
  })
  .superRefine((data, ctx) => {
    // Validate that sequences match the selected alphabet
    const isDNA = data.alphabet === "DNA";
    const validTypes = new Set(
      isDNA
        ? ["feature_group", "aligned_dna_fasta", "feature_dna_fasta"]
        : ["feature_group", "aligned_protein_fasta", "feature_protein_fasta"],
    );

    data.sequences.forEach((seq, index) => {
      if (!validTypes.has(seq.type)) {
        ctx.addIssue({
          code: "custom",
          message: `Sequence type ${seq.type} does not match selected alphabet ${data.alphabet}`,
          path: ["sequences", index, "type"],
        });
      }
    });

    // Validate substitution model matches alphabet
    const dnaModels = ["GTR", "TN93", "HKY85", "F84", "F81", "K80", "JC69"];
    const proteinModels = [
      "LG",
      "WAG",
      "JTT",
      "Blosum62",
      "Dayhoff",
      "HIVw",
      "HIVb",
    ];

    const validModels = isDNA ? dnaModels : proteinModels;
    if (!validModels.includes(data.substitution_model)) {
      ctx.addIssue({
        code: "custom",
        message: `Substitution model ${data.substitution_model} is not valid for ${data.alphabet} sequences`,
        path: ["substitution_model"],
      });
    }
  });

export type GeneProteinTreeFormData = z.infer<typeof geneProteinTreeFormSchema>;
export type SequenceItem = z.infer<typeof sequenceItemSchema>;

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

export const proteinModels = [
  { value: "LG", label: "LG" },
  { value: "WAG", label: "WAG" },
  { value: "JTT", label: "JTT" },
  { value: "Blosum62", label: "Blosum62" },
  { value: "Dayhoff", label: "Dayhoff" },
  { value: "HIVw", label: "HIVw" },
  { value: "HIVb", label: "HIVb" },
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
export const defaultGeneProteinTreeFormValues: GeneProteinTreeFormData = {
  alphabet: "DNA",
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
