import { z } from "zod";

export const libraryTypeSchema = z.enum(["paired", "single", "srr_accession"]);
export type LibraryType = z.infer<typeof libraryTypeSchema>;

export const platformSchema = z.enum(["illumina", "pacbio", "nanopore"]);
export type Platform = z.infer<typeof platformSchema>;

export const platformOptions = [
  { value: "illumina", label: "Illumina" },
  { value: "pacbio", label: "PacBio" },
  { value: "nanopore", label: "Nanopore" },
] as const;

/** Base library schema; `.extend()` it with service-specific optional fields. */
export const baseLibrarySchema = z.object({
  _id: z.string(),
  _type: libraryTypeSchema,
  read: z.string().optional(),
  read1: z.string().optional(),
  read2: z.string().optional(),
});

export type BaseLibraryItem = z.infer<typeof baseLibrarySchema>;

export const libraryWithSampleIdSchema = baseLibrarySchema.extend({
  sample_id: z.string().optional(),
});
export type LibraryWithSampleId = z.infer<typeof libraryWithSampleIdSchema>;

export const libraryWithPlatformSchema = baseLibrarySchema.extend({
  platform: platformSchema.optional(),
});
export type LibraryWithPlatform = z.infer<typeof libraryWithPlatformSchema>;

export const libraryWithAssemblyOptionsSchema = baseLibrarySchema.extend({
  platform: z.string().optional(),
  interleaved: z.boolean().optional(),
  read_orientation_outward: z.boolean().optional(),
});
export type LibraryWithAssemblyOptions = z.infer<typeof libraryWithAssemblyOptionsSchema>;

export const libraryTypeLabels: Record<string, string> = {
  paired: "Paired Read",
  single: "Single Read",
  sra: "SRA Accession",
} as const;

export function getLibraryTypeLabel(type: string): string {
  return libraryTypeLabels[type] ?? type;
}
