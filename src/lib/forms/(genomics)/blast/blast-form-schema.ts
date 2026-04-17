import { z } from "zod";

// Base schema with common fields (excluding discriminators)
export const baseFormSchema = z.object({
  input_type: z.enum(["aa", "dna"]),
  db_type: z.enum(["fna", "ffn", "faa", "frn"]),
  db_source: z.enum([
    "precomputed_database",
    "genome_list",
    "genome_group",
    "feature_group",
    "taxon_list",
    "fasta_file",
  ]),
  db_precomputed_database: z.enum([
    "bacteria-archaea",
    "viral-reference",
    "selGenome",
    "selGroup",
    "selFeatureGroup",
    "selTaxon",
    "selFasta",
  ]),
  blast_program: z.enum(["blastn", "blastp", "blastx", "tblastn"]),
  output_file: z.string().min(1, "Output file name is required"),
  output_path: z.string().min(1, "Output path is required"),
  blast_max_hits: z
    .number()
    .refine((val) => [1, 10, 20, 50, 100, 500, 5000].includes(val), {
        error: "blast_max_hits must be one of: 1, 10, 20, 50, 100, 500, 5000"
    }),
  blast_evalue_cutoff: z
    .number()
    .refine(
      (val) =>
        [0.0001, 0.001, 0.01, 0.1, 1, 10, 100, 1000, 10000].includes(val),
      {
          error: "blast_evalue_cutoff must be one of: 0.0001, 0.001, 0.01, 0.1, 1, 10, 100, 1000, 10000"
    },
    ),
});

// Input source discriminated union
export const inputSourceFormSchema = z.discriminatedUnion("input_source", [
  z.object({
    input_source: z.literal("fasta_data"),
    input_fasta_data: z.string().min(1, "FASTA sequence is required"),
  }),
  z.object({
    input_source: z.literal("fasta_file"),
    input_fasta_file: z.string().min(1, "FASTA file is required"),
  }),
  z.object({
    input_source: z.literal("feature_group"),
    input_feature_group: z.string().min(1, "Feature group is required"),
  }),
]);

// Database conditional fields - optional fields that may be present based on db_precomputed_database
export const databaseConditionalFieldsSchema = z.object({
  db_genome_list: z.array(z.string()).optional(),
  db_genome_group: z.string().optional(),
  db_feature_group: z.string().optional(),
  db_taxon_list: z.array(z.string()).optional(),
  db_fasta_file: z.string().optional(),
});

// Combined schema using intersection with conditional validation
export const completeFormSchema = baseFormSchema
  .and(inputSourceFormSchema)
  .and(databaseConditionalFieldsSchema)
  .superRefine((data, ctx) => {
    // Validate conditional database fields based on db_precomputed_database
    if (data.db_precomputed_database === "selGenome") {
      if (!data.db_genome_list || data.db_genome_list.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "At least one genome must be selected",
          path: ["db_genome_list"],
        });
      }
    } else if (data.db_precomputed_database === "selGroup") {
      if (!data.db_genome_group || data.db_genome_group.trim() === "") {
        ctx.addIssue({
          code: "custom",
          message: "Genome group is required",
          path: ["db_genome_group"],
        });
      }
    } else if (data.db_precomputed_database === "selFeatureGroup") {
      if (!data.db_feature_group || data.db_feature_group.trim() === "") {
        ctx.addIssue({
          code: "custom",
          message: "Feature group is required",
          path: ["db_feature_group"],
        });
      }
    } else if (data.db_precomputed_database === "selTaxon") {
      if (!data.db_taxon_list || data.db_taxon_list.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "At least one taxon must be selected",
          path: ["db_taxon_list"],
        });
      }
    } else if (data.db_precomputed_database === "selFasta") {
      if (!data.db_fasta_file || data.db_fasta_file.trim() === "") {
        ctx.addIssue({
          code: "custom",
          message: "FASTA file is required",
          path: ["db_fasta_file"],
        });
      }
    }
  });

// Type inference for the complete form schema
export type BlastFormData = z.infer<typeof completeFormSchema>;

// Default form values constant
export const defaultBlastFormValues = {
  input_type: "dna" as const,
  input_source: "fasta_data" as const,
  input_fasta_data: "",
  db_type: "fna" as const,
  db_source: "precomputed_database" as const,
  blast_program: "blastn" as const,
  output_file: "",
  output_path: "",
  blast_max_hits: 10,
  blast_evalue_cutoff: 0.0001,
  db_precomputed_database: "bacteria-archaea" as const,
} satisfies BlastFormData;
