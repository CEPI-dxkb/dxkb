import { z } from "zod";
import { baseLibrarySchema } from "../../shared-schemas";
import {
  primersSchema,
  PRIMER_OPTIONS,
  PRIMER_VERSION_OPTIONS,
  DEFAULT_PRIMER_VERSION,
  type Primers,
} from "../sars-cov2-genome-analysis/sars-cov2-genome-analysis-form-schema";

export type { Primers };
export { PRIMER_OPTIONS, PRIMER_VERSION_OPTIONS, DEFAULT_PRIMER_VERSION };

// Library with sample_id and optional sample_level_date for wastewater (no platform — legacy has no platform selector)
export const sarsCov2WastewaterLibrarySchema = baseLibrarySchema.extend({
  sample_id: z.string().min(1, "Sample identifier is required"),
  sample_level_date: z.string().optional(),
});
export type SarsCov2WastewaterLibraryItem = z.infer<
  typeof sarsCov2WastewaterLibrarySchema
>;

// SRA library item (primers/primer_version added at transform from form-level)
export const srrLibItemSchema = z.object({
  srr_accession: z.string(),
  sample_id: z.string(),
  sample_level_date: z.string().optional(),
  title: z.string().optional(),
});
export type SrrLibItem = z.infer<typeof srrLibItemSchema>;

// Strategy (recipe) — legacy has only One Codex
export const recipeSchema = z.enum(["onecodex"]);
export type Recipe = z.infer<typeof recipeSchema>;

export const RECIPE_OPTIONS: { value: Recipe; label: string }[] = [
  { value: "onecodex", label: "One Codex" },
];

// MM/DD/YYYY optional date string for validation
const sampleLevelDateRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/(1000|1\d{3}|2[0-9]{3})$/;

export const sarsCov2WastewaterAnalysisFormSchema = z
  .object({
    paired_end_libs: z.array(sarsCov2WastewaterLibrarySchema).optional(),
    single_end_libs: z.array(sarsCov2WastewaterLibrarySchema).optional(),
    srr_libs: z.array(srrLibItemSchema).optional(),
    primers: primersSchema,
    primer_version: z.string(),
    recipe: recipeSchema,
    output_path: z.string().min(1, "Output folder is required"),
    output_file: z.string().min(1, "Output name is required"),
  })
  .superRefine((data, ctx) => {
    const hasPaired = data.paired_end_libs && data.paired_end_libs.length > 0;
    const hasSingle = data.single_end_libs && data.single_end_libs.length > 0;
    const hasSrr = data.srr_libs && data.srr_libs.length > 0;
    if (!hasPaired && !hasSingle && !hasSrr) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one library (paired, single, or SRA) must be provided",
        path: ["paired_end_libs"],
      });
    }
    // Optional: validate sample_level_date format when present
    (data.paired_end_libs ?? []).forEach((lib, i) => {
      const d = lib.sample_level_date;
      if (d && d.trim() && !sampleLevelDateRegex.test(d.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Sample date must be MM/DD/YYYY",
          path: ["paired_end_libs", i, "sample_level_date"],
        });
      }
    });
    (data.single_end_libs ?? []).forEach((lib, i) => {
      const d = lib.sample_level_date;
      if (d && d.trim() && !sampleLevelDateRegex.test(d.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Sample date must be MM/DD/YYYY",
          path: ["single_end_libs", i, "sample_level_date"],
        });
      }
    });
    (data.srr_libs ?? []).forEach((lib, i) => {
      const d = lib.sample_level_date;
      if (d && d.trim() && !sampleLevelDateRegex.test(d.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Sample date must be MM/DD/YYYY",
          path: ["srr_libs", i, "sample_level_date"],
        });
      }
    });
  });

export type SarsCov2WastewaterAnalysisFormData = z.infer<
  typeof sarsCov2WastewaterAnalysisFormSchema
>;

export const DEFAULT_SARS_COV2_WASTEWATER_ANALYSIS_FORM_VALUES: SarsCov2WastewaterAnalysisFormData =
  {
    paired_end_libs: [],
    single_end_libs: [],
    srr_libs: [],
    primers: "ARTIC",
    primer_version: "V5.3.2",
    recipe: "onecodex",
    output_path: "",
    output_file: "",
  };
