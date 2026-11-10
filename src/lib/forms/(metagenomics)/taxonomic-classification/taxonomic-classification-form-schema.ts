import { z } from "zod";

import { libraryWithSampleIdSchema, type LibraryWithSampleId } from "@/lib/forms/shared-schemas";

export const sequencingTypeSchema = z.enum(["wgs", "16s"]);

export const analysisTypeSchema = z.enum(["microbiome", "pathogen", "default"]);

export const databaseSchema = z.enum(["bvbrc", "standard", "SILVA", "Greengenes"]);

export const hostGenomeSchema = z.enum([
  "no_host",
  "homo_sapiens",
  "mus_musculus",
  "rattus_norvegicus",
  "caenorhabditis_elegans",
  "drosophila_melanogaster_strain",
  "danio_rerio_strain_tuebingen",
  "gallus_gallus",
  "macaca_mulatta",
  "mustela_putorius_furo",
  "sus_scrofa",
]);

export const librarySchema = libraryWithSampleIdSchema;
export type LibraryItem = LibraryWithSampleId;

export const srrLibItemSchema = z.object({
  srr_accession: z.string(),
  sample_id: z.string(),
  title: z.string().optional(),
});

export const confidenceIntervalOptions = [
  { value: "0", label: "0" },
  { value: "0.1", label: "0.1" },
  { value: "0.2", label: "0.2" },
  { value: "0.3", label: "0.3" },
  { value: "0.4", label: "0.4" },
  { value: "0.5", label: "0.5" },
  { value: "0.6", label: "0.6" },
  { value: "0.7", label: "0.7" },
  { value: "0.8", label: "0.8" },
  { value: "0.9", label: "0.9" },
  { value: "1", label: "1" },
] as const;

export const taxonomicClassificationFormSchema = z
  .object({
    paired_end_libs: z.array(librarySchema).optional(),
    single_end_libs: z.array(librarySchema).optional(),
    srr_libs: z.array(srrLibItemSchema).optional(),

    sequence_type: sequencingTypeSchema,
    analysis_type: analysisTypeSchema,
    database: databaseSchema,
    host_genome: hostGenomeSchema,
    confidence_interval: z.string(),
    save_classified_sequences: z.boolean(),
    save_unclassified_sequences: z.boolean(),

    paired_sample_id: z.string().optional(),
    single_sample_id: z.string().optional(),
    srr_sample_id: z.string().optional(),

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

    if (data.sequence_type === "16s" && data.analysis_type !== "default") {
      ctx.addIssue({
        code: "custom",
        message: "16S sequencing only supports Default analysis type",
        path: ["analysis_type"],
      });
    }

    if (data.sequence_type === "wgs" && data.analysis_type === "default") {
      ctx.addIssue({
        code: "custom",
        message: "WGS sequencing does not support Default analysis type",
        path: ["analysis_type"],
      });
    }

    const wgsDatabases = ["bvbrc", "standard"];
    const sixteenSDatabases = ["SILVA", "Greengenes"];

    if (data.sequence_type === "wgs" && !wgsDatabases.includes(data.database)) {
      ctx.addIssue({
        code: "custom",
        message: "WGS sequencing requires BV-BRC or Kraken2 Standard database",
        path: ["database"],
      });
    }

    if (data.sequence_type === "16s" && !sixteenSDatabases.includes(data.database)) {
      ctx.addIssue({
        code: "custom",
        message: "16S sequencing requires SILVA or Greengenes database",
        path: ["database"],
      });
    }
  });

export type TaxonomicClassificationFormData = z.infer<typeof taxonomicClassificationFormSchema>;

export const wgsAnalysisTypeOptions = [
  { value: "microbiome", label: "Microbiome Analysis" },
  { value: "pathogen", label: "Species Identification" },
] as const;

export const sixteenSAnalysisTypeOptions = [
  { value: "default", label: "Default" },
] as const;

export const wgsDatabaseOptions = [
  { value: "bvbrc", label: "BV-BRC Database" },
  { value: "standard", label: "Kraken2 Standard Database" },
] as const;

export const sixteenSDatabaseOptions = [
  { value: "SILVA", label: "SILVA" },
  { value: "Greengenes", label: "Greengenes" },
] as const;

export const hostGenomeOptions = [
  { value: "no_host", label: "None" },
  { value: "homo_sapiens", label: "Homo sapiens" },
  { value: "mus_musculus", label: "Mus musculus" },
  { value: "rattus_norvegicus", label: "Rattus norvegicus" },
  { value: "caenorhabditis_elegans", label: "Caenorhabditis elegans" },
  { value: "drosophila_melanogaster_strain", label: "Drosophila melanogaster strain y" },
  { value: "danio_rerio_strain_tuebingen", label: "Danio rerio strain tuebingen" },
  { value: "gallus_gallus", label: "Gallus gallus" },
  { value: "macaca_mulatta", label: "Macaca mulatta" },
  { value: "mustela_putorius_furo", label: "Mustela putorius furo" },
  { value: "sus_scrofa", label: "Sus scrofa" },
] as const;

export const defaultTaxonomicClassificationFormValues: TaxonomicClassificationFormData = {
  paired_end_libs: [],
  single_end_libs: [],
  srr_libs: [],
  sequence_type: "wgs",
  analysis_type: "microbiome",
  database: "bvbrc",
  host_genome: "no_host",
  confidence_interval: "0.1",
  save_classified_sequences: false,
  save_unclassified_sequences: false,
  paired_sample_id: "",
  single_sample_id: "",
  srr_sample_id: "",
  output_path: "",
  output_file: "",
};
