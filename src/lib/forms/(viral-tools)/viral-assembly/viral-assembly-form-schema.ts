import { z } from "zod";

import { baseLibrarySchema, libraryTypeSchema } from "@/lib/forms/shared-schemas";

// -----------------------------------------------------------------------------
// Strategy - the values are the ones the ViralAssembly app takes (legacy's
// select uses "reference-guided" and sends "reference_guided")
// -----------------------------------------------------------------------------

export const strategySchema = z.enum(["irma", "reference_guided"]);
export type Strategy = z.infer<typeof strategySchema>;

export const strategyOptions: { value: Strategy; label: string }[] = [
  { value: "irma", label: "IRMA" },
  { value: "reference_guided", label: "Reference Guided Assembly" },
];

// -----------------------------------------------------------------------------
// Reference database (IRMA module) - legacy ViralAssembly.html option
// values/labels and ViralAssembly.js irmaModuleDescriptions, in legacy's order
// -----------------------------------------------------------------------------

export const moduleSchema = z.enum([
  "FLU",
  "FLU_AD",
  "FLU-alt",
  "FLU-avian",
  "FLU-avian-residual",
  "FLU-fast",
  "FLU-lowQC",
  "FLU-minion",
  "FLU-pacbio",
  "FLU-pgm",
  "FLU-roche",
  "FLU-secondary",
  "FLU-sensitive",
  "FLU-utr",
  "CoV",
  "RSV",
  "EBOLA_NON",
  "EBOLA",
]);
export type ViralAssemblyModule = z.infer<typeof moduleSchema>;

export const moduleOptions: {
  value: ViralAssemblyModule;
  label: string;
  description: string;
}[] = [
  {
    value: "FLU",
    label: "Influenza A & B",
    description: "Standard influenza assembly workflow (default)",
  },
  {
    value: "FLU_AD",
    label: "Influenza A, B, C & D",
    description: "Broad influenza workflow supporting all types (A, B, C & D)",
  },
  {
    value: "FLU-alt",
    label: "Influenza (alt config)",
    description: "Alternative parameters for difficult or atypical datasets",
  },
  {
    value: "FLU-avian",
    label: "Avian Influenza A",
    description: "Optimized for avian influenza strains",
  },
  {
    value: "FLU-avian-residual",
    label: "Avian residual reads",
    description: "Captures low-abundance or leftover avian influenza reads",
  },
  {
    value: "FLU-fast",
    label: "Influenza (fast mode)",
    description: "Faster runtime for high-quality datasets",
  },
  {
    value: "FLU-lowQC",
    label: "Influenza (low quality)",
    description: "Designed for lower-quality or noisy sequencing data",
  },
  {
    value: "FLU-minion",
    label: "Influenza Oxford Nanopore",
    description: "Optimized for ONT long-read sequencing",
  },
  {
    value: "FLU-pacbio",
    label: "Influenza PacBio",
    description: "Optimized for PacBio long-read sequencing",
  },
  {
    value: "FLU-pgm",
    label: "Influenza Ion Torrent PGM",
    description: "Optimized for Ion Torrent sequencing data",
  },
  {
    value: "FLU-roche",
    label: "Influenza Roche/454",
    description: "Legacy support for Roche/454 sequencing",
  },
  {
    value: "FLU-secondary",
    label: "Influenza post-assembly",
    description: "Secondary refinement after initial assembly",
  },
  {
    value: "FLU-sensitive",
    label: "Influenza low-frequency variants",
    description: "Increased sensitivity for minor variant detection",
  },
  {
    value: "FLU-utr",
    label: "Influenza UTR recovery",
    description: "Improved recovery of 5′ and 3′ untranslated regions",
  },
  {
    value: "CoV",
    label: "SARS-CoV-2 & MERS-CoV",
    description: "Coronavirus assembly workflows (SARS-CoV-2 & MERS-CoV)",
  },
  {
    value: "RSV",
    label: "RSV A & B groups",
    description: "Respiratory Syncytial Virus assembly (A & B groups)",
  },
  // Legacy sends "EBOLA" for this option too: the app has no EBOLA_NON module.
  {
    value: "EBOLA_NON",
    label: "Lloviu Virus and Marburg Virus",
    description: "Lloviu Virus and Marburg Virus",
  },
  {
    value: "EBOLA",
    label: "Zaire, Sudan, Bundibugyo, Reston & Taï Forest Ebolaviruses",
    description: "Zaire, Sudan, Bundibugyo, Reston & Taï Forest Ebolaviruses",
  },
];

// -----------------------------------------------------------------------------
// Reference (reference-guided strategy). The app also takes "genome" and
// "auto" (Minhash), which legacy's form hides.
// -----------------------------------------------------------------------------

export const referenceTypeSchema = z.enum(["genbank", "fasta"]);
export type ReferenceType = z.infer<typeof referenceTypeSchema>;

export const referenceTypeOptions: { value: ReferenceType; label: string }[] = [
  { value: "genbank", label: "GenBank Accession" },
  { value: "fasta", label: "Upload FASTA" },
];

/** Legacy ViralAssembly.js's accession pattern, matched in upper case. */
const genbankAccessionPattern = /^[A-Z]{1,4}_?[A-Z]{0,4}\d+(?:\.\d+)?$/;

/**
 * The accessions in a GenBank reference field. Legacy's placeholder separates
 * them with commas and its check with semicolons, so both are accepted.
 */
export function genbankAccessions(value: string): string[] {
  return value
    .split(/[,;]/)
    .map((accession) => accession.trim())
    .filter(Boolean);
}

function isGenbankAccessionList(value: string): boolean {
  const accessions = genbankAccessions(value);
  return (
    accessions.length > 0 &&
    accessions.every((accession) =>
      genbankAccessionPattern.test(accession.toUpperCase()),
    )
  );
}

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
    reference_type: referenceTypeSchema,
    reference_genbank_accession: z.string(),
    reference_fasta_file: z.string(),
    output_path: z.string().min(1, "Output folder is required"),
    output_file: z.string().min(1, "Output name is required"),
  })
  .superRefine((data, ctx) => {
    const hasPaired = data.paired_end_libs && data.paired_end_libs.length > 0;
    const hasSingle = data.single_end_libs && data.single_end_libs.length > 0;
    const hasSrr = data.srr_ids && data.srr_ids.length > 0;
    if (data.input_type === "paired" && !hasPaired) {
      ctx.addIssue({
        code: "custom",
        message: "At least one paired read library must be provided",
        path: ["paired_end_libs"],
      });
    } else if (data.input_type === "single" && !hasSingle) {
      ctx.addIssue({
        code: "custom",
        message: "At least one single read library must be provided",
        path: ["single_end_libs"],
      });
    } else if (data.input_type === "srr_accession" && !hasSrr) {
      ctx.addIssue({
        code: "custom",
        message: "At least one SRA run accession must be provided",
        path: ["srr_ids"],
      });
    }

    if (data.strategy !== "reference_guided") return;
    if (data.reference_type === "genbank") {
      const accession = data.reference_genbank_accession.trim();
      if (!accession || !isGenbankAccessionList(accession)) {
        ctx.addIssue({
          code: "custom",
          message: accession
            ? "Enter GenBank accessions such as NC_045512.2, separated by commas"
            : "GenBank accession is required",
          path: ["reference_genbank_accession"],
        });
      }
    } else if (!data.reference_fasta_file) {
      ctx.addIssue({
        code: "custom",
        message: "Reference FASTA file is required",
        path: ["reference_fasta_file"],
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
  reference_type: "genbank",
  reference_genbank_accession: "",
  reference_fasta_file: "",
  output_path: "",
  output_file: "",
};
