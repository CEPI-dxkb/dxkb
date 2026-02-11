import { z } from "zod";

// -----------------------------------------------------------------------------
// Core Types
// -----------------------------------------------------------------------------

/**
 * Shared library type enum used across all service forms
 */
export const libraryTypeSchema = z.enum(["paired", "single", "srr_accession"]);
export type LibraryType = z.infer<typeof libraryTypeSchema>;

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

// -----------------------------------------------------------------------------
// Base Library Schema
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// Common Library Variants
// -----------------------------------------------------------------------------

/**
 * Library schema with sample_id field.
 * Used by: Taxonomic Classification
 */
export const libraryWithSampleIdSchema = baseLibrarySchema.extend({
  sample_id: z.string().optional(),
});
export type LibraryWithSampleId = z.infer<typeof libraryWithSampleIdSchema>;

/**
 * Library schema with platform field.
 * Used by: FASTQ Utilities
 */
export const libraryWithPlatformSchema = baseLibrarySchema.extend({
  platform: platformSchema.optional(),
});
export type LibraryWithPlatform = z.infer<typeof libraryWithPlatformSchema>;

/**
 * Library schema with genome assembly options.
 * Used by: Genome Assembly
 */
export const libraryWithAssemblyOptionsSchema = baseLibrarySchema.extend({
  platform: z.string().optional(),
  interleaved: z.boolean().optional(),
  read_orientation_outward: z.boolean().optional(),
});
export type LibraryWithAssemblyOptions = z.infer<typeof libraryWithAssemblyOptionsSchema>;

// -----------------------------------------------------------------------------
// Display Utilities
// -----------------------------------------------------------------------------

/**
 * Library type labels for display in UI components like SelectedItemsTable
 */
export const LIBRARY_TYPE_LABELS: Record<string, string> = {
  paired: "Paired Read",
  single: "Single Read",
  sra: "SRA Accession",
} as const;

/**
 * Get human-readable label for a library type
 */
export function getLibraryTypeLabel(type: string): string {
  return LIBRARY_TYPE_LABELS[type] ?? type;
}
