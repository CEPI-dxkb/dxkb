import { z } from "zod";

/**
 * Shared library type enum used across all service forms
 */
export const libraryTypeSchema = z.enum(["paired", "single", "srr_accession"]);
export type LibraryType = z.infer<typeof libraryTypeSchema>;

/**
 * Base library schema with common fields shared across all service forms.
 * Use `.extend()` to add service-specific optional fields.
 *
 * @example
 * // For services that need sample_id:
 * const libraryWithSampleId = baseLibrarySchema.extend({
 *   sample_id: z.string().optional(),
 * });
 *
 * // For services that need platform info:
 * const libraryWithPlatform = baseLibrarySchema.extend({
 *   platform: z.string().optional(),
 * });
 */
export const baseLibrarySchema = z.object({
  _id: z.string(),
  _type: libraryTypeSchema,
  read: z.string().optional(), // for single
  read1: z.string().optional(), // for paired
  read2: z.string().optional(), // for paired
});

export type BaseLibraryItem = z.infer<typeof baseLibrarySchema>;

/**
 * Platform options schema for services that support sequencing platform selection
 */
export const platformSchema = z.enum(["illumina", "pacbio", "nanopore"]);
export type Platform = z.infer<typeof platformSchema>;

/**
 * Platform options for UI dropdowns
 */
export const PLATFORM_OPTIONS = [
  { value: "illumina", label: "Illumina" },
  { value: "pacbio", label: "PacBio" },
  { value: "nanopore", label: "Nanopore" },
] as const;
