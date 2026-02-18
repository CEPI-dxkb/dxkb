import { z } from "zod";
import { baseLibrarySchema, libraryTypeSchema } from "../../shared-schemas";

// -----------------------------------------------------------------------------
// Strategy (legacy only exposes IRMA)
// -----------------------------------------------------------------------------

export const strategySchema = z.enum(["irma"]);
export type Strategy = z.infer<typeof strategySchema>;

export const strategyOptions: { value: Strategy; label: string }[] = [
  { value: "irma", label: "IRMA" },
];

// -----------------------------------------------------------------------------
// Reference database (module) - legacy ViralAssembly.html option values/labels
// -----------------------------------------------------------------------------

export const moduleSchema = z.enum([
  "FLU",
  "FLU_AD",
  "FLU-minion",
  "FLU-utr",
  "CoV",
  "RSV",
  "EBOLA",
]);
export type ViralAssemblyModule = z.infer<typeof moduleSchema>;

export const moduleOptions: { value: ViralAssemblyModule; label: string }[] = [
  { value: "FLU", label: "FLU" },
  { value: "FLU_AD", label: "FLU AD" },
  { value: "FLU-minion", label: "FLU ONT" },
  { value: "FLU-utr", label: "FLU UTR" },
  { value: "CoV", label: "CoV" },
  { value: "RSV", label: "RSV" },
  { value: "EBOLA", label: "EBOLA" },
];

// -----------------------------------------------------------------------------
// Library item: Viral Assembly has no platform; use base library schema as-is
// -----------------------------------------------------------------------------

export const viralAssemblyLibrarySchema = baseLibrarySchema;
export type ViralAssemblyLibraryItem = z.infer<typeof viralAssemblyLibrarySchema>;

// -----------------------------------------------------------------------------
// Main form schema
// -----------------------------------------------------------------------------

export const viralAssemblyFormSchema = z
  .object({
    input_type: libraryTypeSchema,
    paired_end_libs: z.array(viralAssemblyLibrarySchema).optional(),
    single_end_libs: z.array(viralAssemblyLibrarySchema).optional(),
    srr_ids: z.array(z.string()).optional(),
    strategy: strategySchema,
    module: moduleSchema,
    output_path: z.string().min(1, "Output folder is required"),
    output_file: z.string().min(1, "Output name is required"),
  })
  .superRefine((data, ctx) => {
    const hasPaired = data.paired_end_libs && data.paired_end_libs.length > 0;
    const hasSingle = data.single_end_libs && data.single_end_libs.length > 0;
    const hasSrr = data.srr_ids && data.srr_ids.length > 0;
    if (data.input_type === "paired" && !hasPaired) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one paired read library must be provided",
        path: ["paired_end_libs"],
      });
    } else if (data.input_type === "single" && !hasSingle) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one single read library must be provided",
        path: ["single_end_libs"],
      });
    } else if (data.input_type === "srr_accession" && !hasSrr) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one SRA run accession must be provided",
        path: ["srr_ids"],
      });
    }
  });

export type ViralAssemblyFormData = z.infer<typeof viralAssemblyFormSchema>;

const defaultModule = moduleOptions[0]?.value ?? "FLU";

export const defaultViralAssemblyFormValues: ViralAssemblyFormData = {
  input_type: "paired",
  paired_end_libs: [],
  single_end_libs: [],
  srr_ids: [],
  strategy: "irma",
  module: defaultModule,
  output_path: "",
  output_file: "",
};
