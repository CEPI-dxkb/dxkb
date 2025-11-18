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
    PRIMER_PICK_INTERNAL_OLIGO: z.number().optional(),
    PRIMER_PRODUCT_SIZE_RANGE: z.array(z.string()).optional(),
    PRIMER_NUM_RETURN: z.number().optional(),
    PRIMER_MIN_SIZE: z.number().optional(),
    PRIMER_OPT_SIZE: z.string().default(""),
    PRIMER_MAX_SIZE: z.number().optional(),
    PRIMER_MAX_TM: z.number().optional(),
    PRIMER_MIN_TM: z.number().optional(),
    PRIMER_OPT_TM: z.number().optional(),
    PRIMER_PAIR_MAX_DIFF_TM: z.number().optional(),
    PRIMER_MAX_GC: z.number().optional(),
    PRIMER_MIN_GC: z.number().optional(),
    PRIMER_OPT_GC: z.number().optional(),
    PRIMER_SALT_MONOVALENT: z.number().optional(),
    PRIMER_SALT_DIVALENT: z.number().optional(),
    PRIMER_DNA_CONC: z.number().optional(),
    PRIMER_DNTP_CONC: z.number().optional(),
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
  PRIMER_PICK_INTERNAL_OLIGO: 1,
  PRIMER_PRODUCT_SIZE_RANGE: ["50-500"],
  PRIMER_NUM_RETURN: undefined,
  PRIMER_MIN_SIZE: undefined,
  PRIMER_OPT_SIZE: "20",
  PRIMER_MAX_SIZE: undefined,
  PRIMER_MAX_TM: undefined,
  PRIMER_MIN_TM: undefined,
  PRIMER_OPT_TM: undefined,
  PRIMER_PAIR_MAX_DIFF_TM: undefined,
  PRIMER_MAX_GC: undefined,
  PRIMER_MIN_GC: undefined,
  PRIMER_OPT_GC: undefined,
  PRIMER_SALT_MONOVALENT: undefined,
  PRIMER_SALT_DIVALENT: undefined,
  PRIMER_DNA_CONC: undefined,
  PRIMER_DNTP_CONC: undefined,
} satisfies Partial<z.infer<typeof primerDesignFormSchema>>;

export type PrimerDesignFormData = z.infer<typeof primerDesignFormSchema>;


