import { z } from "zod";

import { baseLibrarySchema } from "@/lib/forms/shared-schemas";
import {
  primersSchema,
  primerOptions,
  primerVersionOptions,
  defaultPrimerVersion,
  type Primers,
} from "@/lib/forms/(viral-tools)/sars-cov2-genome-analysis/sars-cov2-genome-analysis-form-schema";

export type { Primers };
export { primerOptions, primerVersionOptions, defaultPrimerVersion };

// Library with sample_id and optional sample_level_date for wastewater (no platform — legacy has no platform selector)
export const sarsCov2WastewaterLibrarySchema = baseLibrarySchema.extend({
  sample_id: z.string().min(1, "Sample identifier is required"),
  sample_level_date: z.string().optional(),
});
export type SarsCov2WastewaterLibraryItem = z.infer<typeof sarsCov2WastewaterLibrarySchema>;

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

export const recipeOptions: { value: Recipe; label: string }[] = [
  { value: "onecodex", label: "One Codex" },
];

const minYear = 2000;
const maxYear = 2099;

const mmDdYyyyRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/** MM/DD/YYYY with real calendar rules, years 2000-2099; the full string must match. */
export function isValidDate(dateStr: string): boolean {
  const trimmed = dateStr.trim();
  const match = trimmed.match(mmDdYyyyRegex);
  if (!match) return false;
  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  if (year < minYear || year > maxYear) return false;
  if (month < 1 || month > 12) return false;
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) return false;
  return true;
}

const invalidDateMessage =
  "Sample date must be a valid MM/DD/YYYY (year 2000–2099)";

export interface LibraryDateValidationResult {
  valid: boolean;
  message?: string;
  code?: z.core.$ZodIssueCode;
}

export function validateLibraryDate(lib: {
  sample_level_date?: string;
}): LibraryDateValidationResult {
  const d = lib.sample_level_date;
  if (!d || !d.trim()) return { valid: true };
  if (!isValidDate(d.trim())) {
    return {
      valid: false,
      message: invalidDateMessage,
      code: "custom",
    };
  }
  return { valid: true };
}

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
        code: "custom",
        message: "At least one library (paired, single, or SRA) must be provided",
        path: ["paired_end_libs"],
      });
    }
    (data.paired_end_libs ?? []).forEach((lib, i) => {
      const result = validateLibraryDate(lib);
      if (!result.valid) {
        ctx.addIssue({
          code: "custom",
          message: result.message ?? invalidDateMessage,
          path: ["paired_end_libs", i, "sample_level_date"],
        });
      }
    });
    (data.single_end_libs ?? []).forEach((lib, i) => {
      const result = validateLibraryDate(lib);
      if (!result.valid) {
        ctx.addIssue({
          code: "custom",
          message: result.message ?? invalidDateMessage,
          path: ["single_end_libs", i, "sample_level_date"],
        });
      }
    });
    (data.srr_libs ?? []).forEach((lib, i) => {
      const result = validateLibraryDate(lib);
      if (!result.valid) {
        ctx.addIssue({
          code: "custom",
          message: result.message ?? invalidDateMessage,
          path: ["srr_libs", i, "sample_level_date"],
        });
      }
    });
  });

export type SarsCov2WastewaterAnalysisFormData = z.infer<typeof sarsCov2WastewaterAnalysisFormSchema>;

export const defaultSarsCov2WastewaterAnalysisFormValues: SarsCov2WastewaterAnalysisFormData =
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
