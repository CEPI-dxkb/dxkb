import { z } from "zod";

const OUTPUT_NAME_INVALID_CHARS = /[\\/]/;

export const primerDesignFormSchema = z
  .object({
    output_file: z
      .string()
      .min(1, "Output name is required")
      .refine((value) => !OUTPUT_NAME_INVALID_CHARS.test(value), {
        message: "Output name cannot contain slashes",
      }),
    output_path: z.string().default(""),
    input_type: z.enum(["sequence_text", "workplace_fasta", "database_id"]),
    sequence_input: z.string().default(""),
    SEQUENCE_ID: z.string().default("").optional(),
    SEQUENCE_TARGET: z.array(z.string()).optional(),
    SEQUENCE_INCLUDED_REGION: z.array(z.string()).optional(),
    SEQUENCE_EXCLUDED_REGION: z.array(z.string()).optional(),
    SEQUENCE_OVERLAP_JUNCTION_LIST: z.array(z.string()).optional(),
    PRIMER_PICK_INTERNAL_OLIGO: z.boolean().optional(),
    PRIMER_PRODUCT_SIZE_RANGE: z.array(z.string()).optional(),
    PRIMER_NUM_RETURN: z.string().optional(),
    PRIMER_MIN_SIZE: z.string().optional(),
    PRIMER_OPT_SIZE: z.string().optional(),
    PRIMER_MAX_SIZE: z.string().optional(),
    PRIMER_MAX_TM: z.string().optional(),
    PRIMER_MIN_TM: z.string().optional(),
    PRIMER_OPT_TM: z.string().optional(),
    PRIMER_PAIR_MAX_DIFF_TM: z.string().optional(),
    PRIMER_MAX_GC: z.string().optional(),
    PRIMER_MIN_GC: z.string().optional(),
    PRIMER_OPT_GC: z.string().optional(),
    PRIMER_SALT_MONOVALENT: z.string().optional(),
    PRIMER_SALT_DIVALENT: z.string().optional(),
    PRIMER_DNA_CONC: z.string().optional(),
    PRIMER_DNTP_CONC: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.input_type === "sequence_text") {
      if (!data.sequence_input.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Sequence input is required when pasting a sequence",
          path: ["sequence_input"],
        });
      }
    }

    if (data.input_type === "workplace_fasta") {
      if (!data.sequence_input.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Select a FASTA file from the workspace",
          path: ["sequence_input"],
        });
      }
    }

    if (!data.output_path.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Output folder is required",
        path: ["output_path"],
      });
    }
  });

export const DEFAULT_PRIMER_DESIGN_FORM_VALUES = {
  output_file: "",
  output_path: "",
  input_type: "sequence_text" as const,
  sequence_input: "",
  SEQUENCE_ID: "",
  SEQUENCE_TARGET: [],
  SEQUENCE_INCLUDED_REGION: [],
  SEQUENCE_EXCLUDED_REGION: [],
  SEQUENCE_OVERLAP_JUNCTION_LIST: [],
  PRIMER_PICK_INTERNAL_OLIGO: true,
  PRIMER_PRODUCT_SIZE_RANGE: ["50-500"],
  PRIMER_MIN_SIZE: "18",
  PRIMER_OPT_SIZE: "20",
  PRIMER_MAX_SIZE: "27",
  PRIMER_MIN_TM: "57.0",
  PRIMER_OPT_TM: "60.0",
  PRIMER_MAX_TM: "63.0",
  PRIMER_PAIR_MAX_DIFF_TM: "100.0",
  PRIMER_MIN_GC: "20.0",
  PRIMER_OPT_GC: "50.0",
  PRIMER_MAX_GC: "80.0",
  PRIMER_SALT_MONOVALENT: "50.0",
  PRIMER_SALT_DIVALENT: "1.5",
  PRIMER_DNA_CONC: "50.0",
  PRIMER_DNTP_CONC: "0.6",
} satisfies Partial<z.infer<typeof primerDesignFormSchema>>;

export type PrimerDesignFormData = z.infer<typeof primerDesignFormSchema>;


