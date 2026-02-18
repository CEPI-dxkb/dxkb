import { z } from "zod";
import { baseLibrarySchema, libraryTypeSchema } from "../../shared-schemas";

// SARS-CoV-2–specific platform enum (includes iontorrent, infer; not in shared-schemas)
export const sarsCov2PlatformSchema = z.enum([
  "illumina",
  "iontorrent",
  "pacbio",
  "nanopore",
  "infer",
]);
export type SarsCov2Platform = z.infer<typeof sarsCov2PlatformSchema>;

export const sarsCov2SinglePlatformOptions: { value: SarsCov2Platform; label: string }[] = [
  { value: "illumina", label: "Illumina" },
  { value: "iontorrent", label: "Ion Torrent" },
  { value: "infer", label: "Infer Platform" },
];

export const sarsCov2PairedPlatformOptions: { value: SarsCov2Platform; label: string }[] = [
  { value: "illumina", label: "Illumina" },
  { value: "iontorrent", label: "Ion Torrent" },
  { value: "pacbio", label: "PacBio" },
  { value: "nanopore", label: "Nanopore" },
  { value: "infer", label: "Infer Platform" },
];

// Library with platform for SARS-CoV-2 (platform required for paired/single)
export const sarsCov2LibrarySchema = baseLibrarySchema
  .extend({
    platform: sarsCov2PlatformSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (
      (data._type === "paired" || data._type === "single") &&
      data.platform === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Platform is required for paired and single library types",
        path: ["platform"],
      });
    }
  });
export interface SarsCov2LibraryItem extends z.infer<typeof sarsCov2LibrarySchema> {}

// Input type
export const inputTypeSchema = z.enum(["reads", "contigs"]);
export type InputType = z.infer<typeof inputTypeSchema>;

// Recipe (strategy)
export const recipeSchema = z.enum([
  "onecodex",
  "cdc-illumina",
  "cdc-nanopore",
  "artic-nanopore",
  "auto",
]);
export type Recipe = z.infer<typeof recipeSchema>;

export const recipeOptions: { value: Recipe; label: string }[] = [
  { value: "onecodex", label: "One Codex" },
  { value: "cdc-illumina", label: "CDC-Illumina" },
  { value: "cdc-nanopore", label: "CDC-Nanopore" },
  { value: "artic-nanopore", label: "ARTIC-Nanopore" },
  { value: "auto", label: "Auto" },
];

// Primers (only used when recipe === onecodex)
export const primersSchema = z.enum([
  "ARTIC",
  "midnight",
  "qiagen",
  "swift",
  "varskip",
  "varskip-long",
]);
export type Primers = z.infer<typeof primersSchema>;

export const primerOptions: { value: Primers; label: string }[] = [
  { value: "ARTIC", label: "ARTIC" },
  { value: "midnight", label: "midnight" },
  { value: "qiagen", label: "qiagen" },
  { value: "swift", label: "swift" },
  { value: "varskip", label: "varskip" },
  { value: "varskip-long", label: "varskip-long" },
];

// Primer version options per primer (legacy onPrimersChange)
export const primerVersionOptions: Record<Primers, { value: string; label: string }[]> = {
  ARTIC: [
    { value: "V5.3.2", label: "V5.3.2" },
    { value: "V4.1", label: "V4.1" },
    { value: "V4", label: "V4" },
    { value: "V3", label: "V3" },
    { value: "V2", label: "V2" },
    { value: "V1", label: "V1" },
  ],
  midnight: [{ value: "V1", label: "V1" }],
  qiagen: [{ value: "V1", label: "V1" }],
  swift: [{ value: "V1", label: "V1" }],
  varskip: [
    { value: "V2", label: "V2" },
    { value: "V1a", label: "V1a" },
  ],
  "varskip-long": [{ value: "V1a", label: "V1a" }],
};

export const defaultPrimerVersion: Record<Primers, string> = {
  ARTIC: "V5.3.2",
  midnight: "V1",
  qiagen: "V1",
  swift: "V1",
  varskip: "V2",
  "varskip-long": "V1a",
};

// Main form schema
export const sarsCov2GenomeAnalysisFormSchema = z
  .object({
    input_type: inputTypeSchema,
    paired_end_libs: z.array(sarsCov2LibrarySchema).optional(),
    single_end_libs: z.array(sarsCov2LibrarySchema).optional(),
    srr_ids: z.array(z.string()).optional(),
    contigs: z.string().optional(),
    recipe: recipeSchema,
    primers: primersSchema,
    primer_version: z.string(),
    scientific_name: z.string().min(1, "Taxonomy name is required"),
    taxonomy_id: z.string().min(1, "Taxonomy ID is required"),
    my_label: z.string().min(1, "My Label is required"),
    output_path: z.string().min(1, "Output folder is required"),
    output_file: z.string().min(1, "Output name is required"),
  })
  .superRefine((data, ctx) => {
    if (data.input_type === "reads") {
      const hasPaired = data.paired_end_libs && data.paired_end_libs.length > 0;
      const hasSingle = data.single_end_libs && data.single_end_libs.length > 0;
      const hasSrr = data.srr_ids && data.srr_ids.length > 0;
      if (!hasPaired && !hasSingle && !hasSrr) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one library (paired, single, or SRA) must be provided",
          path: ["paired_end_libs"],
        });
      }
    } else {
      if (!data.contigs || data.contigs.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Contigs file is required when starting with Assembled Contigs",
          path: ["contigs"],
        });
      }
    }
    if (data.my_label && (data.my_label.includes("/") || data.my_label.includes("\\"))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Slashes are not allowed in My Label",
        path: ["my_label"],
      });
    }
  });

export interface SarsCov2GenomeAnalysisFormData
  extends z.infer<typeof sarsCov2GenomeAnalysisFormSchema> {}

export const defaultSarsCov2GenomeAnalysisFormValues: SarsCov2GenomeAnalysisFormData = {
  input_type: "reads",
  paired_end_libs: [],
  single_end_libs: [],
  srr_ids: [],
  contigs: "",
  recipe: "onecodex",
  primers: "ARTIC",
  primer_version: "V5.3.2",
  scientific_name: "Severe acute respiratory syndrome coronavirus 2",
  taxonomy_id: "2697049",
  my_label: "",
  output_path: "",
  output_file: "Severe acute respiratory syndrome coronavirus 2",
};
