import { z } from "zod";

export const inputSourceSchema = z.enum([
  "fasta_data",
  "fasta_file",
  "feature_group",
]);
export type InputSource = z.infer<typeof inputSourceSchema>;

export const influenzaHaSubtypeFormSchema = z
  .object({
    input_source: inputSourceSchema,
    input_fasta_data: z.string(),
    input_fasta_file: z.string(),
    input_feature_group: z.string(),
    types: z
      .array(z.string())
      .min(1, "Select at least one numbering scheme"),
    output_path: z.string().trim().min(1, "Output folder is required"),
    output_file: z.string().trim().min(1, "Output name is required"),
  })
  .superRefine((data, ctx) => {
    if (data.input_source === "fasta_data") {
      if (!data.input_fasta_data?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter at least one protein sequence in FASTA format",
          path: ["input_fasta_data"],
        });
      }
    } else if (data.input_source === "fasta_file") {
      if (!data.input_fasta_file?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Select a FASTA file from your workspace",
          path: ["input_fasta_file"],
        });
      }
    } else if (data.input_source === "feature_group") {
      if (!data.input_feature_group?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Select a feature group from your workspace",
          path: ["input_feature_group"],
        });
      }
    }
  });

  export interface InfluenzaHaSubtypeFormData
    extends z.infer<typeof influenzaHaSubtypeFormSchema> {}
  
export const defaultInfluenzaHaSubtypeFormValues: InfluenzaHaSubtypeFormData =
  {
    input_source: "fasta_data",
    input_fasta_data: "",
    input_fasta_file: "",
    input_feature_group: "",
    types: ["H1N1pdm"],
    output_path: "",
    output_file: "",
  };
