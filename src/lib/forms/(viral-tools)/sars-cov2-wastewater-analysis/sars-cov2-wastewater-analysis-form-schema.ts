import { z } from "zod";
import { baseLibrarySchema } from "../../shared-schemas";
import {
  primersSchema,
  primerOptions,
  primerVersionOptions,
  defaultPrimerVersion,
  type Primers,
} from "../sars-cov2-genome-analysis/sars-cov2-genome-analysis-form-schema";

export type { Primers };
export { primerOptions, primerVersionOptions, defaultPrimerVersion };

// Library with sample_id and optional sample_level_date for wastewater (no platform — legacy has no platform selector)
export const sarsCov2WastewaterLibrarySchema = baseLibrarySchema.extend({
  sample_id: z.string().min(1, "Sample identifier is required"),
  sample_level_date: z.string().optional(),
});
export interface SarsCov2WastewaterLibraryItem
  extends z.infer<typeof sarsCov2WastewaterLibrarySchema> {}

// SRA library item (primers/primer_version added at transform from form-level)
export const srrLibItemSchema = z.object({
  srr_accession: z.string(),
  sample_id: z.string(),
  sample_level_date: z.string().optional(),
  title: z.string().optional(),
});
export interface SrrLibItem extends z.infer<typeof srrLibItemSchema> {}

// Strategy (recipe) — legacy has only One Codex
export const recipeSchema = z.enum(["onecodex"]);
export type Recipe = z.infer<typeof recipeSchema>;

export const recipeOptions: { value: Recipe; label: string }[] = [
  { value: "onecodex", label: "One Codex" },
];

const MIN_YEAR = 2000;
const MAX_YEAR = 2099;

/** Exact MM/DD/YYYY token pattern: two digits, slash, two digits, slash, four digits. */
const MM_DD_YYYY_REGEX = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/**
 * Validates a date string in MM/DD/YYYY format with real calendar rules
 * and year range 2000–2099. Use for sample_level_date validation.
 * Requires the full string to match the exact token pattern so trailing
 * characters (e.g. "01/15/2024xyz") are rejected.
 */
export function isValidDate(dateStr: string): boolean {
  const trimmed = dateStr.trim();
  const match = trimmed.match(MM_DD_YYYY_REGEX);
  if (!match) return false;
  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  if (year < MIN_YEAR || year > MAX_YEAR) return false;
  if (month < 1 || month > 12) return false;
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) return false;
  return true;
}

const INVALID_DATE_MESSAGE =
  "Sample date must be a valid MM/DD/YYYY (year 2000–2099)";

export interface LibraryDateValidationResult {
  valid: boolean;
  message?: string;
  code?: z.ZodIssueCode;
}

/**
 * Validates sample_level_date on a library item (paired/single/SRA).
 * Returns a result that callers can use to add a schema issue when valid is false.
 */
export function validateLibraryDate(lib: {
  sample_level_date?: string;
}): LibraryDateValidationResult {
  const d = lib.sample_level_date;
  if (!d || !d.trim()) return { valid: true };
  if (!isValidDate(d.trim())) {
    return {
      valid: false,
      message: INVALID_DATE_MESSAGE,
      code: z.ZodIssueCode.invalid_date,
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
        code: z.ZodIssueCode.custom,
        message: "At least one library (paired, single, or SRA) must be provided",
        path: ["paired_end_libs"],
      });
    }
    (data.paired_end_libs ?? []).forEach((lib, i) => {
      const result = validateLibraryDate(lib);
      if (!result.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.invalid_date,
          message: result.message ?? INVALID_DATE_MESSAGE,
          path: ["paired_end_libs", i, "sample_level_date"],
        });
      }
    });
    (data.single_end_libs ?? []).forEach((lib, i) => {
      const result = validateLibraryDate(lib);
      if (!result.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.invalid_date,
          message: result.message ?? INVALID_DATE_MESSAGE,
          path: ["single_end_libs", i, "sample_level_date"],
        });
      }
    });
    (data.srr_libs ?? []).forEach((lib, i) => {
      const result = validateLibraryDate(lib);
      if (!result.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.invalid_date,
          message: result.message ?? INVALID_DATE_MESSAGE,
          path: ["srr_libs", i, "sample_level_date"],
        });
      }
    });
  });

export interface SarsCov2WastewaterAnalysisFormData
  extends z.infer<typeof sarsCov2WastewaterAnalysisFormSchema> {}

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
