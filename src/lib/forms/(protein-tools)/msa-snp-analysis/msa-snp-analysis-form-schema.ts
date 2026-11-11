import { z } from "zod";

export const inputStatusSchema = z.enum(["unaligned", "aligned"]);

export const inputTypeSchema = z.enum([
  "input_feature_group",
  "input_genome_group",
  "input_fasta",
  "input_sequence",
]);

export const alphabetSchema = z.enum(["dna", "protein"]);

export const refTypeSchema = z.enum([
  "none",
  "first",
  "feature_id",
  "genome_id",
  "string",
]);

export const alignerSchema = z.enum(["Mafft", "Muscle"]);

export const strategySchema = z.enum([
  "auto",
  "fftns1",
  "fftns2",
  "fftnsi",
  "einsi",
  "linsi",
  "ginsi",
]);

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

export const msaSnpAnalysisFormSchema = z
  .object({
    input_status: inputStatusSchema,
    input_type: inputTypeSchema.optional(),
    alphabet: alphabetSchema.optional(),
    
    feature_groups: z.string().optional(),
    select_genomegroup: z.array(z.string()).optional(),
    fasta_files: z.array(fastaFileItemSchema).optional(),
    fasta_keyboard_input: z.string().optional(),
    
    ref_type: refTypeSchema,
    ref_string: z.string().optional(),
    
    aligner: alignerSchema,
    strategy: strategySchema.optional(),
    
    output_path: z.string().min(1, "Output folder is required"),
    output_file: z.string().min(1, "Output name is required"),
  })
  .superRefine((data, ctx) => {
    if (data.input_status === "unaligned") {
      if (!data.input_type) {
        ctx.addIssue({
          code: "custom",
          message: "Input type is required for unaligned sequences",
          path: ["input_type"],
        });
        return;
      }

      if (data.input_type === "input_feature_group") {
        if (!data.feature_groups || data.feature_groups.trim() === "") {
          ctx.addIssue({
            code: "custom",
            message: "Feature group is required",
            path: ["feature_groups"],
          });
        }
        if (!data.alphabet) {
          ctx.addIssue({
            code: "custom",
            message: "Alphabet (DNA or Protein) is required for feature groups",
            path: ["alphabet"],
          });
        }
      } else if (data.input_type === "input_genome_group") {
        if (!data.select_genomegroup || data.select_genomegroup.length === 0) {
          ctx.addIssue({
            code: "custom",
            message: "Genome group is required",
            path: ["select_genomegroup"],
          });
        }
      } else if (data.input_type === "input_fasta") {
        if (!data.fasta_files || data.fasta_files.length === 0) {
          ctx.addIssue({
            code: "custom",
            message: "FASTA file is required",
            path: ["fasta_files"],
          });
        }
      } else {
        if (!data.fasta_keyboard_input || data.fasta_keyboard_input.trim() === "") {
          ctx.addIssue({
            code: "custom",
            message: "FASTA sequence input is required",
            path: ["fasta_keyboard_input"],
          });
        }
      }

      if (data.ref_type === "feature_id") {
        if (data.input_type !== "input_feature_group" && data.input_type !== "input_genome_group") {
          ctx.addIssue({
            code: "custom",
            message: "Feature ID reference is only available for feature groups or genome groups",
            path: ["ref_type"],
          });
        }
        if (!data.ref_string || data.ref_string.trim() === "") {
          ctx.addIssue({
            code: "custom",
            message: "Feature ID is required",
            path: ["ref_string"],
          });
        }
      } else if (data.ref_type === "genome_id") {
        if (data.input_type !== "input_genome_group") {
          ctx.addIssue({
            code: "custom",
            message: "Genome ID reference is only available for genome groups",
            path: ["ref_type"],
          });
        }
        if (!data.ref_string || data.ref_string.trim() === "") {
          ctx.addIssue({
            code: "custom",
            message: "Genome ID is required",
            path: ["ref_string"],
          });
        }
      } else if (data.ref_type === "first") {
        if (data.input_type !== "input_fasta" && data.input_type !== "input_sequence") {
          ctx.addIssue({
            code: "custom",
            message: "First sequence reference is only available for FASTA files or input sequences",
            path: ["ref_type"],
          });
        }
      } else if (data.ref_type === "string") {
        if (!data.ref_string || data.ref_string.trim() === "") {
          ctx.addIssue({
            code: "custom",
            message: "Reference sequence is required",
            path: ["ref_string"],
          });
        }
      }
    } else {
      if (!data.fasta_files || data.fasta_files.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "Aligned FASTA file is required",
          path: ["fasta_files"],
        });
      }

      if (data.ref_type !== "none" && data.ref_type !== "first") {
        ctx.addIssue({
          code: "custom",
          message: "For aligned sequences, only 'None' or 'First sequence' reference types are allowed",
          path: ["ref_type"],
        });
      }
    }

    if (data.aligner === "Muscle" && data.strategy) {
      ctx.addIssue({
        code: "custom",
        message: "Strategy is only available for Mafft aligner",
        path: ["strategy"],
      });
    }
  });

export type MsaSnpAnalysisFormData = z.infer<typeof msaSnpAnalysisFormSchema>;

export const maxGenomes = 5000;
export const maxGenomeLength = 250000;
export const minSequences = 2;
export const minSequencesWithRef = 1;

export const strategyOptions = [
  { value: "auto", label: "Auto (FFT-NS-1, FFT-NS-2, FFT-NS-i or L-INS-i; depends on data size)" },
  { value: "fftns1", label: "FFT-NS-1 (Very fast; recommended for >2,000 sequences; progressive method)" },
  { value: "fftns2", label: "FFT-NS-2 (Fast; progressive method)" },
  { value: "fftnsi", label: "FFT-NS-i (Slow; iterative refinement method)" },
  { value: "einsi", label: "E-INS-i (Very slow; recommended for <200 sequences with multiple conserved domains and long gaps; 2 iterative cycles only)" },
  { value: "linsi", label: "L-INS-i (Very slow; recommended for <200 sequences with one conserved domain and long gaps; 2 iterative cycles only)" },
  { value: "ginsi", label: "G-INS-i (Very slow; recommended for <200 sequences with global homology; 2 iterative cycles only)" },
] as const;

export const defaultMsaSnpAnalysisFormValues: MsaSnpAnalysisFormData = {
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
