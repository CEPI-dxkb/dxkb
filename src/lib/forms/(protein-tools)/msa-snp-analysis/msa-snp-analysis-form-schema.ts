import { z } from "zod";

// Input status enum
export const inputStatusSchema = z.enum(["unaligned", "aligned"]);

// Input type enum (for unaligned sequences)
export const inputTypeSchema = z.enum([
  "input_feature_group",
  "input_genome_group",
  "input_fasta",
  "input_sequence",
]);

// Alphabet enum (for feature groups)
export const alphabetSchema = z.enum(["dna", "protein"]);

// Reference type enum
export const refTypeSchema = z.enum([
  "none",
  "first",
  "feature_id",
  "genome_id",
  "string",
]);

// Aligner enum
export const alignerSchema = z.enum(["Mafft", "Muscle"]);

// Strategy enum (for Mafft only)
export const strategySchema = z.enum([
  "auto",
  "fftns1",
  "fftns2",
  "fftnsi",
  "einsi",
  "linsi",
  "ginsi",
]);

// FASTA file item schema
export const fastaFileItemSchema = z.object({
  file: z.string().min(1, "FASTA file path is required"),
  type: z.enum([
    "feature_protein_fasta",
    "feature_dna_fasta",
    "aligned_protein_fasta",
    "aligned_dna_fasta",
  ]),
});

export type FastaFileItem = z.infer<typeof fastaFileItemSchema>;

// Main form schema
export const msaSnpAnalysisFormSchema = z
  .object({
    input_status: inputStatusSchema,
    input_type: inputTypeSchema.optional(),
    alphabet: alphabetSchema.optional(),
    
    // Input sources (conditional based on input_type)
    feature_groups: z.string().optional(),
    select_genomegroup: z.array(z.string()).optional(),
    fasta_files: z.array(fastaFileItemSchema).optional(),
    fasta_keyboard_input: z.string().optional(),
    
    // Reference options
    ref_type: refTypeSchema,
    ref_string: z.string().optional(), // For feature_id, genome_id, or string reference
    
    // Alignment parameters
    aligner: alignerSchema,
    strategy: strategySchema.optional(),
    
    // Output
    output_path: z.string().min(1, "Output folder is required"),
    output_file: z.string().min(1, "Output name is required"),
  })
  .superRefine((data, ctx) => {
    // Validation for unaligned sequences
    if (data.input_status === "unaligned") {
      if (!data.input_type) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Input type is required for unaligned sequences",
          path: ["input_type"],
        });
        return;
      }

      // Validate based on input type
      if (data.input_type === "input_feature_group") {
        if (!data.feature_groups || data.feature_groups.trim() === "") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Feature group is required",
            path: ["feature_groups"],
          });
        }
        if (!data.alphabet) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Alphabet (DNA or Protein) is required for feature groups",
            path: ["alphabet"],
          });
        }
      } else if (data.input_type === "input_genome_group") {
        if (!data.select_genomegroup || data.select_genomegroup.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Genome group is required",
            path: ["select_genomegroup"],
          });
        }
      } else if (data.input_type === "input_fasta") {
        if (!data.fasta_files || data.fasta_files.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "FASTA file is required",
            path: ["fasta_files"],
          });
        }
      } else if (data.input_type === "input_sequence") {
        if (!data.fasta_keyboard_input || data.fasta_keyboard_input.trim() === "") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "FASTA sequence input is required",
            path: ["fasta_keyboard_input"],
          });
        }
      }

      // Validate reference type compatibility
      if (data.ref_type === "feature_id") {
        if (data.input_type !== "input_feature_group" && data.input_type !== "input_genome_group") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Feature ID reference is only available for feature groups or genome groups",
            path: ["ref_type"],
          });
        }
        if (!data.ref_string || data.ref_string.trim() === "") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Feature ID is required",
            path: ["ref_string"],
          });
        }
      } else if (data.ref_type === "genome_id") {
        if (data.input_type !== "input_genome_group") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Genome ID reference is only available for genome groups",
            path: ["ref_type"],
          });
        }
        if (!data.ref_string || data.ref_string.trim() === "") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Genome ID is required",
            path: ["ref_string"],
          });
        }
      } else if (data.ref_type === "first") {
        if (data.input_type !== "input_fasta" && data.input_type !== "input_sequence") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "First sequence reference is only available for FASTA files or input sequences",
            path: ["ref_type"],
          });
        }
      } else if (data.ref_type === "string") {
        if (!data.ref_string || data.ref_string.trim() === "") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Reference sequence is required",
            path: ["ref_string"],
          });
        }
      }
    } else if (data.input_status === "aligned") {
      // For aligned sequences, only fasta_files is needed
      if (!data.fasta_files || data.fasta_files.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Aligned FASTA file is required",
          path: ["fasta_files"],
        });
      }
      
      // For aligned sequences, only "none" or "first" reference types are allowed
      if (data.ref_type !== "none" && data.ref_type !== "first") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "For aligned sequences, only 'None' or 'First sequence' reference types are allowed",
          path: ["ref_type"],
        });
      }
    }

    // Validate strategy is only for Mafft
    if (data.aligner === "Muscle" && data.strategy) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Strategy is only available for Mafft aligner",
        path: ["strategy"],
      });
    }
  });

export type MsaSnpAnalysisFormData = z.infer<typeof msaSnpAnalysisFormSchema>;

// Constants
export const MAX_GENOMES = 5000;
export const MAX_GENOME_LENGTH = 250000;
export const MIN_SEQUENCES = 2;
export const MIN_SEQUENCES_WITH_REF = 1;

// Strategy options for Mafft
export const STRATEGY_OPTIONS = [
  { value: "auto", label: "Auto (FFT-NS-1, FFT-NS-2, FFT-NS-i or L-INS-i; depends on data size)" },
  { value: "fftns1", label: "FFT-NS-1 (Very fast; recommended for >2,000 sequences; progressive method)" },
  { value: "fftns2", label: "FFT-NS-2 (Fast; progressive method)" },
  { value: "fftnsi", label: "FFT-NS-i (Slow; iterative refinement method)" },
  { value: "einsi", label: "E-INS-i (Very slow; recommended for <200 sequences with multiple conserved domains and long gaps; 2 iterative cycles only)" },
  { value: "linsi", label: "L-INS-i (Very slow; recommended for <200 sequences with one conserved domain and long gaps; 2 iterative cycles only)" },
  { value: "ginsi", label: "G-INS-i (Very slow; recommended for <200 sequences with global homology; 2 iterative cycles only)" },
] as const;

// Default form values
export const DEFAULT_MSA_SNP_ANALYSIS_FORM_VALUES: MsaSnpAnalysisFormData = {
  input_status: "unaligned",
  input_type: "input_feature_group",
  alphabet: "protein",
  feature_groups: "",
  select_genomegroup: [],
  fasta_files: [],
  fasta_keyboard_input: "",
  ref_type: "none",
  ref_string: "",
  aligner: "Mafft",
  strategy: "auto",
  output_path: "",
  output_file: "",
};
